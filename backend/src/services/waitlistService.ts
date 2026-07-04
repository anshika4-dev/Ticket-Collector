import pool from '../config/db';
import { sendWaitlistOffer } from './emailService';
import { v4 as uuidv4 } from 'uuid';

const OFFER_TTL_MINUTES = parseInt(process.env.WAITLIST_OFFER_TTL_MINUTES || '15');

/**
 * Check waitlist for a given event+category and offer the next available seat.
 * Called after a booking is cancelled.
 */
export async function checkAndOfferWaitlist(eventId: string, categoryId: string | null): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find available seat for this category
    const seatQuery = categoryId
      ? `
          SELECT ss.id FROM show_seats ss
          JOIN venue_seats vs ON ss.venue_seat_id = vs.id
          WHERE ss.event_id = $1 AND vs.category_id = $2 AND ss.status = 'available'
          LIMIT 1 FOR UPDATE OF ss SKIP LOCKED
        `
      : `
          SELECT ss.id FROM show_seats ss
          WHERE ss.event_id = $1 AND ss.status = 'available'
          LIMIT 1 FOR UPDATE OF ss SKIP LOCKED
        `;

    const seatResult = categoryId
      ? await client.query(seatQuery, [eventId, categoryId])
      : await client.query(seatQuery, [eventId]);

    if (!seatResult.rows.length) {
      await client.query('ROLLBACK');
      return; // No seats available to offer
    }

    const availableSeatId = seatResult.rows[0].id;

    // Find next waiting user in queue
    const waitlistQuery = categoryId
      ? `
          SELECT w.*, u.name as user_name, u.email as user_email
          FROM waitlist w
          JOIN users u ON w.user_id = u.id
          WHERE w.event_id = $1 AND w.category_id = $2 AND w.status = 'waiting'
          ORDER BY w.position ASC
          LIMIT 1 FOR UPDATE OF w SKIP LOCKED
        `
      : `
          SELECT w.*, u.name as user_name, u.email as user_email
          FROM waitlist w
          JOIN users u ON w.user_id = u.id
          WHERE w.event_id = $1 AND w.status = 'waiting'
          ORDER BY w.position ASC
          LIMIT 1 FOR UPDATE OF w SKIP LOCKED
        `;

    const waitlistResult = categoryId
      ? await client.query(waitlistQuery, [eventId, categoryId])
      : await client.query(waitlistQuery, [eventId]);

    if (!waitlistResult.rows.length) {
      await client.query('ROLLBACK');
      return; // No one in waitlist
    }

    const waiter = waitlistResult.rows[0];
    const offerToken = uuidv4();
    const offerExpiresAt = new Date(Date.now() + OFFER_TTL_MINUTES * 60 * 1000);

    // Update waitlist entry to 'offered'
    await client.query(`
      UPDATE waitlist
      SET status = 'offered',
          offer_token = $1,
          offer_expires_at = $2,
          offered_show_seat_id = $3
      WHERE id = $4
    `, [offerToken, offerExpiresAt, availableSeatId, waiter.id]);

    // Temporarily hold the seat for this user
    await client.query(`
      UPDATE show_seats SET status = 'held', held_by = $1, held_until = $2
      WHERE id = $3
    `, [waiter.user_id, offerExpiresAt, availableSeatId]);

    await client.query('COMMIT');

    // Fetch event details
    const eventInfo = await pool.query(`
      SELECT e.title, e.date_time, v.name as venue_name
      FROM events e JOIN venues v ON e.venue_id = v.id WHERE e.id = $1
    `, [eventId]);

    const categoryInfo = categoryId
      ? await pool.query('SELECT name FROM seat_categories WHERE id = $1', [categoryId])
      : null;

    const claimUrl = `${process.env.FRONTEND_URL}/waitlist/claim/${offerToken}`;

    // Send email notification
    await sendWaitlistOffer({
      user: { name: waiter.user_name, email: waiter.user_email },
      event: eventInfo.rows[0],
      categoryName: categoryInfo?.rows[0]?.name || 'Standard',
      claimUrl,
      expiresAt: offerExpiresAt,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Waitlist offer error:', err);
  } finally {
    client.release();
  }
}

/**
 * Expire stale waitlist offers and move to the next person in queue.
 * Called by cron scheduler.
 */
export async function processExpiredWaitlistOffers(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find expired offers
    const expired = await client.query(`
      UPDATE waitlist
      SET status = 'expired'
      WHERE status = 'offered' AND offer_expires_at < NOW()
      RETURNING id, event_id, category_id, offered_show_seat_id
    `);

    for (const entry of expired.rows) {
      // Release the held seat back to available
      await client.query(`
        UPDATE show_seats SET status = 'available', held_by = NULL, held_until = NULL
        WHERE id = $1 AND status = 'held'
      `, [entry.offered_show_seat_id]);
    }

    await client.query('COMMIT');

    // For each expired offer, try to find the next in line
    const processed = new Set<string>();
    for (const entry of expired.rows) {
      const key = `${entry.event_id}-${entry.category_id}`;
      if (!processed.has(key)) {
        processed.add(key);
        checkAndOfferWaitlist(entry.event_id, entry.category_id).catch(console.error);
      }
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Expired waitlist processing error:', err);
  } finally {
    client.release();
  }
}
