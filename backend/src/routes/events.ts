import { Router, Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/events — browse all upcoming events (public)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, city, search, page = '1', limit = '12' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = `
      SELECT e.*, v.name as venue_name, v.city,
             u.name as organiser_name,
             COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'available') as available_seats,
             COUNT(DISTINCT ss.id) as total_seats
      FROM events e
      JOIN venues v ON e.venue_id = v.id
      JOIN users u ON e.organiser_id = u.id
      LEFT JOIN show_seats ss ON ss.event_id = e.id
      WHERE e.status = 'upcoming' AND e.date_time > NOW()
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (type) { query += ` AND e.type = $${paramIdx++}`; params.push(type); }
    if (city) { query += ` AND v.city ILIKE $${paramIdx++}`; params.push(`%${city}%`); }
    if (search) { query += ` AND e.title ILIKE $${paramIdx++}`; params.push(`%${search}%`); }

    query += ` GROUP BY e.id, v.name, v.city, u.name ORDER BY e.date_time ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);

    // count
    let countQuery = `SELECT COUNT(*) FROM events e JOIN venues v ON e.venue_id = v.id WHERE e.status = 'upcoming' AND e.date_time > NOW()`;
    const countParams: any[] = [];
    let ci = 1;
    if (type) { countQuery += ` AND e.type = $${ci++}`; countParams.push(type); }
    if (city) { countQuery += ` AND v.city ILIKE $${ci++}`; countParams.push(`%${city}%`); }
    if (search) { countQuery += ` AND e.title ILIKE $${ci++}`; countParams.push(`%${search}%`); }
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      events: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (err) { next(err); }
});

// GET /api/events/:id — event detail
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT e.*, v.name as venue_name, v.city, v.address, v.total_rows, v.total_cols,
             u.name as organiser_name,
             COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'available') as available_seats,
             COUNT(DISTINCT ss.id) as total_seats
      FROM events e
      JOIN venues v ON e.venue_id = v.id
      JOIN users u ON e.organiser_id = u.id
      LEFT JOIN show_seats ss ON ss.event_id = e.id
      WHERE e.id = $1
      GROUP BY e.id, v.name, v.city, v.address, v.total_rows, v.total_cols, u.name
    `, [id]);

    if (!result.rows.length) { res.status(404).json({ error: 'Event not found' }); return; }

    // Fetch category prices
    const prices = await pool.query(`
      SELECT ecp.*, sc.name as category_name, sc.color
      FROM event_category_prices ecp
      JOIN seat_categories sc ON sc.id = ecp.category_id
      WHERE ecp.event_id = $1
    `, [id]);

    res.json({ ...result.rows[0], category_prices: prices.rows });
  } catch (err) { next(err); }
});

// POST /api/events — create event (organiser)
router.post('/', authenticate, requireRole('organiser', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, type, description, poster_url, venue_id, date_time, duration_minutes, category_prices } = req.body;
    if (!title || !type || !venue_id || !date_time) {
      res.status(400).json({ error: 'title, type, venue_id, date_time required' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const eventResult = await client.query(`
        INSERT INTO events (title, type, description, poster_url, organiser_id, venue_id, date_time, duration_minutes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [title, type, description, poster_url, req.user!.id, venue_id, date_time, duration_minutes || 120]);

      const event = eventResult.rows[0];

      // Fetch venue seats and create show_seats
      const venueSeats = await client.query(
        'SELECT vs.*, ecp.price FROM venue_seats vs LEFT JOIN event_category_prices ecp ON ecp.category_id = vs.category_id AND ecp.event_id = $1 WHERE vs.venue_id = $2 AND vs.is_active = true',
        [event.id, venue_id]
      );

      // Insert category prices
      if (category_prices && Array.isArray(category_prices)) {
        for (const cp of category_prices) {
          await client.query(
            'INSERT INTO event_category_prices (event_id, category_id, price) VALUES ($1, $2, $3)',
            [event.id, cp.category_id, cp.price]
          );
        }
      }

      // Re-fetch seats with prices
      const seatsWithPrices = await client.query(`
        SELECT vs.*, ecp.price
        FROM venue_seats vs
        LEFT JOIN event_category_prices ecp ON ecp.category_id = vs.category_id AND ecp.event_id = $1
        WHERE vs.venue_id = $2 AND vs.is_active = true
      `, [event.id, venue_id]);

      // Create show_seats for each venue seat
      for (const seat of seatsWithPrices.rows) {
        await client.query(`
          INSERT INTO show_seats (event_id, venue_seat_id, price)
          VALUES ($1, $2, $3)
          ON CONFLICT (event_id, venue_seat_id) DO NOTHING
        `, [event.id, seat.id, seat.price || 0]);
      }

      await client.query('COMMIT');
      res.status(201).json(event);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// GET /api/events/:id/seats — seat map for an event
router.get('/:id/seats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT ss.id, ss.status, ss.price, ss.held_until,
             vs.row_num, vs.col_num, vs.label,
             sc.name as category_name, sc.color as category_color, sc.id as category_id
      FROM show_seats ss
      JOIN venue_seats vs ON ss.venue_seat_id = vs.id
      LEFT JOIN seat_categories sc ON vs.category_id = sc.id
      WHERE ss.event_id = $1
      ORDER BY vs.row_num, vs.col_num
    `, [id]);

    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/events/organiser/my — organiser's events
router.get('/organiser/my', authenticate, requireRole('organiser', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(`
      SELECT e.*, v.name as venue_name,
             COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'confirmed') as confirmed_bookings,
             COALESCE(SUM(b.total_price) FILTER (WHERE b.status = 'confirmed'), 0) as total_revenue
      FROM events e
      JOIN venues v ON e.venue_id = v.id
      LEFT JOIN bookings b ON b.event_id = e.id
      WHERE e.organiser_id = $1
      GROUP BY e.id, v.name
      ORDER BY e.created_at DESC
    `, [req.user!.id]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

export default router;
