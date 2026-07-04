import cron from 'node-cron';
import pool from '../config/db';
import { processExpiredWaitlistOffers } from './waitlistService';

/**
 * Release expired seat holds — runs every 30 seconds
 * Any seat with status='held' and held_until < NOW() is released back to 'available'
 */
export function startScheduler(): void {
  // Seat hold TTL sweep — every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const result = await pool.query(`
        UPDATE show_seats
        SET status = 'available', held_by = NULL, held_until = NULL
        WHERE status = 'held' AND held_until < NOW()
        RETURNING id, event_id, venue_seat_id
      `);

      if (result.rows.length > 0) {
        console.log(`⏰ Released ${result.rows.length} expired seat holds`);
      }
    } catch (err) {
      console.error('Seat hold sweep error:', err);
    }
  });

  // Waitlist offer expiry sweep — every 1 minute
  cron.schedule('* * * * *', async () => {
    try {
      await processExpiredWaitlistOffers();
    } catch (err) {
      console.error('Waitlist expiry sweep error:', err);
    }
  });

  // Mark events as completed if date has passed — every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await pool.query(`
        UPDATE events SET status = 'completed'
        WHERE status = 'upcoming' AND date_time < NOW() - INTERVAL '3 hours'
      `);
    } catch (err) {
      console.error('Event status update error:', err);
    }
  });

  console.log('🕐 Scheduler started (seat TTL, waitlist, event status)');
}
