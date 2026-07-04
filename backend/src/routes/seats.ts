import { Router, Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/seats/hold — hold seats (concurrency safe)
router.post('/hold', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const { event_id, seat_ids } = req.body;
    if (!event_id || !Array.isArray(seat_ids) || !seat_ids.length) {
      res.status(400).json({ error: 'event_id and seat_ids[] required' });
      return;
    }

    const ttlMinutes = parseInt(process.env.SEAT_HOLD_TTL_MINUTES || '10');

    await client.query('BEGIN');

    // Lock rows for update — SKIP LOCKED prevents two transactions from holding the same seat
    const lockResult = await client.query(`
      SELECT id, status, held_by, held_until FROM show_seats
      WHERE id = ANY($1::uuid[]) AND event_id = $2
      FOR UPDATE SKIP LOCKED
    `, [seat_ids, event_id]);

    if (lockResult.rows.length !== seat_ids.length) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'One or more seats are unavailable. Please select different seats.' });
      return;
    }

    // Check all locked seats are available (or held by current user, or hold has expired)
    const now = new Date();
    const unavailable = lockResult.rows.filter(s => {
      if (s.status === 'available') return false;
      if (s.status === 'held') {
        const isSelf = s.held_by === req.user!.id;
        const isExpired = s.held_until && new Date(s.held_until) < now;
        if (isSelf || isExpired) return false;
      }
      return true;
    });

    if (unavailable.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'One or more seats are already held or booked.', seats: unavailable });
      return;
    }

    // Release any existing holds by this user for this event first
    await client.query(`
      UPDATE show_seats
      SET status = 'available', held_by = NULL, held_until = NULL
      WHERE event_id = $1 AND held_by = $2 AND status = 'held'
      AND id != ALL($3::uuid[])
    `, [event_id, req.user!.id, seat_ids]);

    // Place hold
    const heldUntil = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await client.query(`
      UPDATE show_seats
      SET status = 'held', held_by = $1, held_until = $2
      WHERE id = ANY($3::uuid[]) AND event_id = $4
    `, [req.user!.id, heldUntil, seat_ids, event_id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      held_until: heldUntil,
      ttl_minutes: ttlMinutes,
      seat_ids,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/seats/release — release held seats (checkout abandonment)
router.post('/release', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event_id, seat_ids } = req.body;
    await pool.query(`
      UPDATE show_seats
      SET status = 'available', held_by = NULL, held_until = NULL
      WHERE event_id = $1 AND held_by = $2 AND status = 'held'
      ${seat_ids ? 'AND id = ANY($3::uuid[])' : ''}
    `, seat_ids ? [event_id, req.user!.id, seat_ids] : [event_id, req.user!.id]);

    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/seats/my-hold/:eventId — check current user's hold for an event
router.get('/my-hold/:eventId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const result = await pool.query(`
      SELECT ss.id, ss.status, ss.price, ss.held_until, vs.label, vs.row_num, vs.col_num,
             sc.name as category_name, sc.color
      FROM show_seats ss
      JOIN venue_seats vs ON ss.venue_seat_id = vs.id
      LEFT JOIN seat_categories sc ON sc.id = vs.category_id
      WHERE ss.event_id = $1 AND ss.held_by = $2 AND ss.status = 'held' AND ss.held_until > NOW()
    `, [eventId, req.user!.id]);

    res.json(result.rows);
  } catch (err) { next(err); }
});

export default router;
