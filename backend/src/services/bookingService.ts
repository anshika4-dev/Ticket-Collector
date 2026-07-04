import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';

export async function generateBookingRef(): Promise<string> {
  const prefix = 'TKT';
  const randomPart = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
  const ref = `${prefix}-${randomPart}`;
  // Ensure uniqueness
  const existing = await pool.query('SELECT id FROM bookings WHERE booking_ref = $1', [ref]);
  if (existing.rows.length) return generateBookingRef();
  return ref;
}
