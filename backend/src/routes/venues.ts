import { Router, Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/venues — list all venues
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(`
      SELECT v.*, u.name as created_by_name,
             COUNT(DISTINCT sc.id) as category_count,
             COUNT(DISTINCT vs.id) as seat_count
      FROM venues v
      LEFT JOIN users u ON u.id = v.created_by
      LEFT JOIN seat_categories sc ON sc.venue_id = v.id
      LEFT JOIN venue_seats vs ON vs.venue_id = v.id
      GROUP BY v.id, u.name
      ORDER BY v.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/venues/:id — venue detail with categories and layout
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const venue = await pool.query('SELECT * FROM venues WHERE id = $1', [id]);
    if (!venue.rows.length) { res.status(404).json({ error: 'Venue not found' }); return; }

    const categories = await pool.query(
      'SELECT * FROM seat_categories WHERE venue_id = $1', [id]
    );
    const seats = await pool.query(`
      SELECT vs.*, sc.name as category_name, sc.color
      FROM venue_seats vs
      LEFT JOIN seat_categories sc ON sc.id = vs.category_id
      WHERE vs.venue_id = $1
      ORDER BY vs.row_num, vs.col_num
    `, [id]);

    res.json({ ...venue.rows[0], categories: categories.rows, seats: seats.rows });
  } catch (err) { next(err); }
});

// POST /api/venues — create venue (admin)
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, address, city, total_rows, total_cols, categories } = req.body;
    if (!name || !total_rows || !total_cols) {
      res.status(400).json({ error: 'name, total_rows, total_cols required' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const venueResult = await client.query(`
        INSERT INTO venues (name, address, city, total_rows, total_cols, created_by)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [name, address, city, total_rows, total_cols, req.user!.id]);

      const venue = venueResult.rows[0];

      // Create seat categories
      const createdCategories: any[] = [];
      if (categories && Array.isArray(categories)) {
        for (const cat of categories) {
          const catResult = await client.query(`
            INSERT INTO seat_categories (venue_id, name, color, description)
            VALUES ($1, $2, $3, $4) RETURNING *
          `, [venue.id, cat.name, cat.color || '#4CAF50', cat.description]);
          createdCategories.push(catResult.rows[0]);
        }
      }

      // Auto-generate seats based on layout
      // Categories are applied by row ranges if provided
      const rowCategoryMap: Record<number, string | null> = {};
      if (categories && Array.isArray(categories)) {
        let rowStart = 1;
        for (let i = 0; i < categories.length; i++) {
          const cat = categories[i];
          const rowsForCat = cat.rows || Math.ceil(total_rows / categories.length);
          for (let r = rowStart; r < rowStart + rowsForCat && r <= total_rows; r++) {
            rowCategoryMap[r] = createdCategories[i]?.id || null;
          }
          rowStart += rowsForCat;
        }
      }

      for (let r = 1; r <= total_rows; r++) {
        const rowLetter = String.fromCharCode(64 + r); // A, B, C...
        for (let c = 1; c <= total_cols; c++) {
          const label = `${rowLetter}${c}`;
          const categoryId = rowCategoryMap[r] || null;
          await client.query(`
            INSERT INTO venue_seats (venue_id, row_num, col_num, label, category_id)
            VALUES ($1, $2, $3, $4, $5)
          `, [venue.id, r, c, label, categoryId]);
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ ...venue, categories: createdCategories });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// PATCH /api/venues/:id — update venue (admin)
router.patch('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, address, city } = req.body;
    const result = await pool.query(
      'UPDATE venues SET name = COALESCE($1, name), address = COALESCE($2, address), city = COALESCE($3, city) WHERE id = $4 RETURNING *',
      [name, address, city, id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

export default router;
