import { Router, Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/admin/users — list all users
router.get('/users', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, is_verified, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// PATCH /api/admin/users/:id/role — change user role
router.patch('/users/:id/role', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['customer', 'organiser', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/admin/stats — platform statistics
router.get('/stats', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [users, events, bookings, revenue] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query("SELECT COUNT(*) FROM events WHERE status = 'upcoming'"),
      pool.query("SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'"),
      pool.query("SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE status = 'confirmed'"),
    ]);
    res.json({
      total_users: parseInt(users.rows[0].count),
      upcoming_events: parseInt(events.rows[0].count),
      total_bookings: parseInt(bookings.rows[0].count),
      total_revenue: parseFloat(revenue.rows[0].coalesce),
    });
  } catch (err) { next(err); }
});

// GET /api/admin/events — all events with details
router.get('/events', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(`
      SELECT e.*, v.name as venue_name, u.name as organiser_name,
             COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'confirmed') as bookings,
             COALESCE(SUM(b.total_price) FILTER (WHERE b.status = 'confirmed'), 0) as revenue
      FROM events e
      JOIN venues v ON e.venue_id = v.id
      JOIN users u ON e.organiser_id = u.id
      LEFT JOIN bookings b ON b.event_id = e.id
      GROUP BY e.id, v.name, u.name
      ORDER BY e.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

export default router;
