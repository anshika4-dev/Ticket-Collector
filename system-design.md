# System Design Write-up — TicketCollector
**Word Count: ~780**

---

## 1. Seat Hold TTL Mechanism

When a customer selects seats on the visual map, the system immediately places a **time-limited hold** to prevent others from selecting the same seats during checkout.

**Implementation:**
- `POST /api/seats/hold` runs inside a PostgreSQL transaction
- Each selected `show_seat` row is updated: `status='held'`, `held_by=userId`, `held_until=NOW() + INTERVAL '10 minutes'`
- The TTL is configurable via `SEAT_HOLD_TTL_MINUTES` env variable (default: 10 minutes)
- A **Node.js cron job** (node-cron) runs every 30 seconds sweeping expired holds:
  ```sql
  UPDATE show_seats
  SET status='available', held_by=NULL, held_until=NULL
  WHERE status='held' AND held_until < NOW()
  ```
- The sweep is also triggered whenever a checkout is abandoned (user navigates away, timer hits zero on frontend)
- The frontend displays a real-time countdown timer. When it reaches zero, the UI automatically calls `POST /api/seats/release` and clears the selection
- Held seats appear in **yellow** on the seat map and are non-clickable to other users

The 30-second sweep granularity means a seat hold expiry takes at most 30 seconds to propagate — acceptable for the UX trade-off of not needing a persistent WebSocket connection per-session.

---

## 2. Concurrency Prevention

The fundamental challenge: two customers simultaneously clicking the same available seat. Both see it as "available", both submit a hold request — only one can succeed.

**Solution: PostgreSQL `SELECT FOR UPDATE SKIP LOCKED`**

```sql
SELECT id, status, held_by FROM show_seats
WHERE id = ANY($1::uuid[]) AND event_id = $2
FOR UPDATE SKIP LOCKED
```

- `FOR UPDATE` acquires a row-level exclusive lock on each seat row
- `SKIP LOCKED` means if a seat is already locked by another transaction, this query **skips it** (returns fewer rows than requested)
- If `rowCount < seat_ids.length`, we know a concurrent transaction is also processing the same seat → respond with 409 Conflict
- If all rows are locked by us and all have `status='available'`, proceed with the hold

This is superior to application-level locking (Redis distributed locks, etc.) because:
1. No external dependency
2. Lock is automatically released if the transaction fails or connection drops
3. PostgreSQL guarantees serializable isolation within a transaction

All booking confirmation also uses `FOR UPDATE` to verify held seats haven't changed between hold and checkout.

---

## 3. Waitlist Auto-Assignment Flow

The waitlist solves the "sold out" problem by automatically offering released seats to queued customers.

**Queue Structure:**
- Waitlist entries are per `(event_id, category_id)` tuple with a `position` field (monotonically incrementing)
- Status: `waiting → offered → completed | expired | removed`

**Auto-Assignment Trigger:**
1. Customer cancels booking → seats released to `status='available'`
2. `checkAndOfferWaitlist(eventId, categoryId)` is called for each released seat's category
3. Function runs in a transaction using `SELECT FOR UPDATE SKIP LOCKED` on both the available seat AND the next waitlist entry — prevents two cancellations from double-offering the same seat or the same waitlist entry getting two offers
4. If a matching pair is found:
   - Seat temporarily held for the waitlisted user
   - Unique `offer_token` (UUID v4) generated
   - Waitlist entry updated: `status='offered'`, `offer_token`, `offer_expires_at = NOW() + 15min`
   - Email sent with claim link: `{FRONTEND_URL}/waitlist/claim/{token}`

**Time-Limited Offer Handling:**
- The claim link hits `POST /api/waitlist/claim/:token`
- Validates token is valid, not expired, belongs to authenticated user
- If valid: seat held for 10 minutes, redirected to seat selection → checkout
- A second cron job runs every minute sweeping expired offers:
  ```sql
  UPDATE waitlist SET status='expired'
  WHERE status='offered' AND offer_expires_at < NOW()
  ```
- For each expired offer: seat released back to `available`, `checkAndOfferWaitlist()` called for the next person in queue
- This cascades until the waitlist is exhausted or someone claims the seat

---

## 4. Seat Map Data Model

**Static layout** (venue-level, created once by admin):
- `venues`: defines the grid dimensions (total_rows × total_cols)
- `venue_seats`: one row per seat cell (row_num, col_num, label, category_id)
- `seat_categories`: Premium, Standard etc. with color coding

**Dynamic status** (per-event, mutable):
- `show_seats`: created when an event is created, mirrors all `venue_seats` for that venue
- Contains: `status`, `held_by`, `held_until`, `price`
- The seat map API joins these tables and returns status for every seat cell

**Real-time updates:**
- Frontend polls `GET /events/:id/seats` every 15 seconds
- This keeps all users' seat maps roughly synchronized within 15 seconds
- The system is designed to be upgraded to WebSocket/Supabase Realtime subscriptions — the data model fully supports it

---

## 5. QR Code Generation & Email Delivery

**QR Code:**
- Generated using the `qrcode` npm package
- Encodes a JSON payload: `{ ref, event, date }` with error correction level H
- Rendered as a 300×300 base64 PNG, embedded as an inline attachment (`cid:qrcode`) in the email HTML
- Also stored in `bookings.qr_code_data` for display in the booking detail UI

**Email Delivery:**
- Nodemailer with Gmail SMTP (free tier, up to 500/day)
- Booking confirmation: HTML email with dark-themed design, seat table, QR code
- Waitlist notification: time-limited offer email with a prominent CTA button and expiry countdown
- Email sends are async (non-blocking) — booking response is returned immediately, email fires in background

**Booking Reference:**
- Format: `TKT-{8-char alphanumeric}` e.g. `TKT-A3F92K1B`
- Uniqueness guaranteed by recursive check before insert
