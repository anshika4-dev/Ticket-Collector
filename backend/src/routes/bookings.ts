import { Router, Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import { generateBookingRef } from '../services/bookingService';
import { sendBookingConfirmation } from '../services/emailService';
import { checkAndOfferWaitlist } from '../services/waitlistService';

const router = Router();

// POST /api/bookings — confirm booking from held seats
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const { event_id, seat_ids, payment_method = 'card' } = req.body;
    if (!event_id || !Array.isArray(seat_ids) || !seat_ids.length) {
      res.status(400).json({ error: 'event_id and seat_ids[] required' });
      return;
    }

    await client.query('BEGIN');

    // Verify seats are held by this user and not expired
    const seatCheck = await client.query(`
      SELECT ss.id, ss.price, ss.status, ss.held_by, ss.held_until,
             vs.label, sc.name as category_name
      FROM show_seats ss
      JOIN venue_seats vs ON ss.venue_seat_id = vs.id
      LEFT JOIN seat_categories sc ON sc.id = vs.category_id
      WHERE ss.id = ANY($1::uuid[]) AND ss.event_id = $2
      FOR UPDATE
    `, [seat_ids, event_id]);

    for (const seat of seatCheck.rows) {
      if (seat.status !== 'held' || seat.held_by !== req.user!.id) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: `Seat ${seat.label} is no longer held by you.` });
        return;
      }
      if (new Date(seat.held_until) < new Date()) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: `Seat ${seat.label} hold has expired. Please re-select.` });
        return;
      }
    }

    const totalPrice = seatCheck.rows.reduce((sum, s) => sum + parseFloat(s.price), 0);
    const bookingRef = await generateBookingRef();

    // Create booking
    const bookingResult = await client.query(`
      INSERT INTO bookings (user_id, event_id, booking_ref, total_price, status, payment_method)
      VALUES ($1, $2, $3, $4, 'confirmed', $5)
      RETURNING *
    `, [req.user!.id, event_id, bookingRef, totalPrice, payment_method]);

    const booking = bookingResult.rows[0];

    // Create booking_seats and mark show_seats as booked
    for (const seat of seatCheck.rows) {
      await client.query(
        'INSERT INTO booking_seats (booking_id, show_seat_id) VALUES ($1, $2)',
        [booking.id, seat.id]
      );
      await client.query(
        `UPDATE show_seats SET status = 'booked', held_by = NULL, held_until = NULL WHERE id = $1`,
        [seat.id]
      );
    }

    await client.query('COMMIT');

    // Fetch event and user info for email
    const [eventInfo, userInfo] = await Promise.all([
      pool.query('SELECT e.*, v.name as venue_name, v.city FROM events e JOIN venues v ON e.venue_id = v.id WHERE e.id = $1', [event_id]),
      pool.query('SELECT name, email FROM users WHERE id = $1', [req.user!.id]),
    ]);

    // Send booking confirmation email with QR code (async, don't block response)
    sendBookingConfirmation({
      booking: { ...booking, booking_ref: bookingRef },
      user: userInfo.rows[0],
      event: eventInfo.rows[0],
      seats: seatCheck.rows,
    }).catch(console.error);

    res.status(201).json({
      booking: { ...booking, booking_ref: bookingRef },
      seats: seatCheck.rows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/bookings/my — customer's booking history
router.get('/my', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(`
      SELECT b.*,
             e.title as event_title, e.type as event_type, e.date_time,
             v.name as venue_name, v.city,
             json_agg(json_build_object('label', vs.label, 'category', sc.name, 'price', ss.price)) as seats
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      JOIN venues v ON e.venue_id = v.id
      LEFT JOIN booking_seats bs ON bs.booking_id = b.id
      LEFT JOIN show_seats ss ON bs.show_seat_id = ss.id
      LEFT JOIN venue_seats vs ON ss.venue_seat_id = vs.id
      LEFT JOIN seat_categories sc ON sc.id = vs.category_id
      WHERE b.user_id = $1
      GROUP BY b.id, e.title, e.type, e.date_time, v.name, v.city
      ORDER BY b.created_at DESC
    `, [req.user!.id]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/bookings/:id — booking detail
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT b.*,
             e.title as event_title, e.type as event_type, e.date_time, e.poster_url,
             v.name as venue_name, v.city, v.address,
             u.name as user_name, u.email as user_email
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      JOIN venues v ON e.venue_id = v.id
      JOIN users u ON b.user_id = u.id
      WHERE b.id = $1 AND (b.user_id = $2 OR $3 = 'admin')
    `, [id, req.user!.id, req.user!.role]);

    if (!result.rows.length) { res.status(404).json({ error: 'Booking not found' }); return; }

    const seats = await pool.query(`
      SELECT vs.label, sc.name as category, ss.price
      FROM booking_seats bs
      JOIN show_seats ss ON bs.show_seat_id = ss.id
      JOIN venue_seats vs ON ss.venue_seat_id = vs.id
      LEFT JOIN seat_categories sc ON sc.id = vs.category_id
      WHERE bs.booking_id = $1
    `, [id]);

    res.json({ ...result.rows[0], seats: seats.rows });
  } catch (err) { next(err); }
});

// DELETE /api/bookings/:id — cancel booking
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const booking = await client.query(
      `SELECT * FROM bookings WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [id, req.user!.id]
    );

    if (!booking.rows.length) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (booking.rows[0].status === 'cancelled') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Booking already cancelled' });
      return;
    }

    // Get the show seats
    const bookedSeats = await client.query(`
      SELECT ss.id, vs.category_id, ss.event_id
      FROM booking_seats bs
      JOIN show_seats ss ON bs.show_seat_id = ss.id
      JOIN venue_seats vs ON ss.venue_seat_id = vs.id
      WHERE bs.booking_id = $1
    `, [id]);

    // Mark booking as cancelled
    await client.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
      [id]
    );

    // Release the seats back to available
    const seatIds = bookedSeats.rows.map(s => s.id);
    await client.query(
      `UPDATE show_seats SET status = 'available', held_by = NULL, held_until = NULL WHERE id = ANY($1::uuid[])`,
      [seatIds]
    );

    await client.query('COMMIT');

    // Trigger waitlist offers for each unique category
    const categories = [...new Set(bookedSeats.rows.map(s => s.category_id))];
    const eventId = booking.rows[0].event_id;
    for (const categoryId of categories) {
      checkAndOfferWaitlist(eventId, categoryId).catch(console.error);
    }

    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;
