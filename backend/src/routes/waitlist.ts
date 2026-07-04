import { Router, Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import { checkAndOfferWaitlist } from '../services/waitlistService';

const router = Router();

// POST /api/waitlist/join — join waitlist for an event/category
router.post('/join', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event_id, category_id } = req.body;
    if (!event_id || !category_id) {
      res.status(400).json({ error: 'event_id and category_id required' });
      return;
    }

    // Check if event is sold out for this category
    const availableSeats = await pool.query(`
      SELECT COUNT(*) FROM show_seats ss
      JOIN venue_seats vs ON ss.venue_seat_id = vs.id
      WHERE ss.event_id = $1 AND vs.category_id = $2 AND ss.status = 'available'
    `, [event_id, category_id]);

    if (parseInt(availableSeats.rows[0].count) > 0) {
      res.status(400).json({ error: 'Seats are still available. No need to join waitlist.' });
      return;
    }

    // Get next position
    const posResult = await pool.query(`
      SELECT COALESCE(MAX(position), 0) + 1 as next_pos
      FROM waitlist WHERE event_id = $1 AND category_id = $2 AND status = 'waiting'
    `, [event_id, category_id]);

    const position = posResult.rows[0].next_pos;

    const result = await pool.query(`
      INSERT INTO waitlist (event_id, user_id, category_id, position, status)
      VALUES ($1, $2, $3, $4, 'waiting')
      ON CONFLICT (event_id, user_id, category_id)
        DO UPDATE SET status = 'waiting', position = EXCLUDED.position
      RETURNING *
    `, [event_id, req.user!.id, category_id, position]);

    res.status(201).json({ waitlist: result.rows[0], position });
  } catch (err) { next(err); }
});

// GET /api/waitlist/status/:eventId — check user's waitlist position
router.get('/status/:eventId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const result = await pool.query(`
      SELECT w.*, sc.name as category_name, sc.color
      FROM waitlist w
      JOIN seat_categories sc ON sc.id = w.category_id
      WHERE w.event_id = $1 AND w.user_id = $2
    `, [eventId, req.user!.id]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/waitlist/claim/:token — claim a seat from waitlist offer
router.post('/claim/:token', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const { token } = req.params;

    await client.query('BEGIN');

    // Find active offer
    const offerResult = await client.query(`
      SELECT w.*, w.offered_show_seat_id as show_seat_id
      FROM waitlist w
      WHERE w.offer_token = $1
        AND w.status = 'offered'
        AND w.offer_expires_at > NOW()
        AND w.user_id = $2
      FOR UPDATE
    `, [token, req.user!.id]);

    if (!offerResult.rows.length) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Offer not found, expired, or already claimed.' });
      return;
    }

    const offer = offerResult.rows[0];

    // Hold the offered seat
    const heldUntil = new Date(Date.now() + 10 * 60 * 1000);
    await client.query(`
      UPDATE show_seats SET status = 'held', held_by = $1, held_until = $2
      WHERE id = $3 AND status = 'available'
    `, [req.user!.id, heldUntil, offer.show_seat_id]);

    // Mark waitlist entry as completed
    await client.query(
      `UPDATE waitlist SET status = 'completed' WHERE id = $1`,
      [offer.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      show_seat_id: offer.show_seat_id,
      event_id: offer.event_id,
      held_until: heldUntil,
      message: 'Seat held! Complete your booking within 10 minutes.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /api/waitlist/:id — leave waitlist
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE waitlist SET status = 'removed' WHERE id = $1 AND user_id = $2`,
      [id, req.user!.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
