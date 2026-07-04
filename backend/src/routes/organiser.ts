import { Router, Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/organiser/events/:id/summary — booking summary and revenue
router.get('/events/:id/summary', authenticate, requireRole('organiser', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const event = await pool.query(
      'SELECT * FROM events WHERE id = $1 AND (organiser_id = $2 OR $3 = $4)',
      [id, req.user!.id, req.user!.role, 'admin']
    );
    if (!event.rows.length) { res.status(404).json({ error: 'Event not found' }); return; }

    const [bookingStats, seatStats, categoryRevenue, recentBookings] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          COALESCE(SUM(total_price) FILTER (WHERE status = 'confirmed'), 0) as total_revenue
        FROM bookings WHERE event_id = $1
      `, [id]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'available') as available,
          COUNT(*) FILTER (WHERE status = 'held') as held,
          COUNT(*) FILTER (WHERE status = 'booked') as booked,
          COUNT(*) as total
        FROM show_seats WHERE event_id = $1
      `, [id]),
      pool.query(`
        SELECT sc.name, sc.color,
               COUNT(DISTINCT bs.id) as tickets_sold,
               COALESCE(SUM(ss.price), 0) as revenue
        FROM booking_seats bs
        JOIN show_seats ss ON bs.show_seat_id = ss.id
        JOIN venue_seats vs ON ss.venue_seat_id = vs.id
        JOIN seat_categories sc ON sc.id = vs.category_id
        JOIN bookings b ON bs.booking_id = b.id
        WHERE ss.event_id = $1 AND b.status = 'confirmed'
        GROUP BY sc.name, sc.color
      `, [id]),
      pool.query(`
        SELECT b.booking_ref, b.total_price, b.created_at, b.status,
               u.name as customer_name, u.email as customer_email
        FROM bookings b JOIN users u ON b.user_id = u.id
        WHERE b.event_id = $1
        ORDER BY b.created_at DESC LIMIT 10
      `, [id]),
    ]);

    res.json({
      event: event.rows[0],
      booking_stats: bookingStats.rows[0],
      seat_stats: seatStats.rows[0],
      category_revenue: categoryRevenue.rows,
      recent_bookings: recentBookings.rows,
    });
  } catch (err) { next(err); }
});

// GET /api/organiser/events — organiser's own events
router.get('/events', authenticate, requireRole('organiser', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
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
