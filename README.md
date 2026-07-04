# 🎟️ TicketCollector — Ticket Booking System

A full-stack ticket booking platform for movies and concerts with real-time seat maps, seat hold TTL, concurrency protection, waitlist management, and QR code email tickets.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL (Supabase) |
| Auth | JWT (role-based: customer/organiser/admin) |
| Email | Nodemailer + Gmail SMTP |
| QR Code | qrcode npm package |
| Scheduler | node-cron (seat TTL sweep every 30s) |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase recommended — free tier)
- Gmail account with App Password enabled

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd Ticket_Collector

# Backend
cd backend
npm install
cp .env.example .env
# Fill in your .env values

# Frontend
cd ../frontend
npm install
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:3001/api
```

### 2. Setup Database

1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor → paste contents of `backend/src/db/schema.sql` → Run
3. Copy the connection string from Project Settings → Database → URI
4. Add to `backend/.env` as `DATABASE_URL`

### 3. Configure Gmail SMTP

1. Enable 2-Factor Authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate a new App Password for "Mail"
4. Add to `backend/.env`:
   ```
   GMAIL_USER=your@gmail.com
   GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
   ```

### 4. Run the Application

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open http://localhost:5173

---

## ⚙️ Environment Variables

### backend/.env

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
JWT_SECRET=your-super-secret-key-min-32-chars
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
FRONTEND_URL=http://localhost:5173
SEAT_HOLD_TTL_MINUTES=10
WAITLIST_OFFER_TTL_MINUTES=15
PORT=3001
NODE_ENV=development
```

### frontend/.env.local

```env
VITE_API_URL=http://localhost:3001/api
```

---

## 📡 API Documentation

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | None | Register (role: customer/organiser) |
| POST | `/api/auth/login` | None | Login → returns JWT |
| GET | `/api/auth/me` | Bearer | Get current user |

### Events
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/events` | None | List events (filter: type, city, search) |
| GET | `/api/events/:id` | None | Event detail + category prices |
| GET | `/api/events/:id/seats` | None | Seat map with real-time status |
| POST | `/api/events` | Organiser+ | Create event |

### Seats
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/seats/hold` | Customer | Hold seats (concurrency safe) |
| POST | `/api/seats/release` | Customer | Release held seats |
| GET | `/api/seats/my-hold/:eventId` | Customer | Check current hold |

### Bookings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/bookings` | Customer | Confirm booking → sends QR email |
| GET | `/api/bookings/my` | Customer | Booking history |
| GET | `/api/bookings/:id` | Customer | Booking detail + QR |
| DELETE | `/api/bookings/:id` | Customer | Cancel booking → triggers waitlist |

### Waitlist
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/waitlist/join` | Customer | Join category waitlist |
| GET | `/api/waitlist/status/:eventId` | Customer | Check waitlist position |
| POST | `/api/waitlist/claim/:token` | Customer | Claim offered seat |
| DELETE | `/api/waitlist/:id` | Customer | Leave waitlist |

### Organiser
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/organiser/events` | Organiser+ | Own events list |
| GET | `/api/organiser/events/:id/summary` | Organiser+ | Revenue + booking summary |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/stats` | Admin | Platform statistics |
| GET | `/api/admin/users` | Admin | All users |
| PATCH | `/api/admin/users/:id/role` | Admin | Change user role |
| GET | `/api/admin/events` | Admin | All events |

---

## 🗄️ Database Schema

See `backend/src/db/schema.sql` for full schema. Key tables:

| Table | Purpose |
|---|---|
| `users` | All users with role |
| `venues` | Venue layout (rows × cols) |
| `seat_categories` | Premium, Standard etc. |
| `venue_seats` | Static seat layout (A1, A2...) |
| `events` | Movie/concert listings |
| `event_category_prices` | Price per category per event |
| `show_seats` | Per-event mutable seat status |
| `bookings` | Confirmed bookings with QR |
| `booking_seats` | Which seats belong to a booking |
| `waitlist` | Waitlist queue per event+category |

---

## 🔒 Seat Hold & TTL Mechanism

1. Customer selects seats → `POST /api/seats/hold`
2. Backend uses `SELECT ... FOR UPDATE SKIP LOCKED` — only one transaction can lock a seat
3. Seats set to `status='held'`, `held_until = NOW() + 10min`
4. Cron job (every 30s) sweeps: `UPDATE show_seats SET status='available' WHERE status='held' AND held_until < NOW()`
5. On frontend: countdown timer shows remaining hold time

## 🔄 Waitlist Auto-Assignment Flow

1. Sold-out event → Customer joins waitlist (category-level)
2. Booking cancelled → seats released → `checkAndOfferWaitlist()` called
3. Next `waiting` entry fetched with `SELECT FOR UPDATE SKIP LOCKED`
4. Seat temporarily held, `offer_token` generated, email sent with claim link
5. Offer expires in 15 minutes → cron sweeps expired offers → seat released → next in queue offered

## ⚡ Concurrency Protection

All seat hold and booking operations use PostgreSQL advisory locking:
```sql
SELECT id FROM show_seats
WHERE id = ANY($1) AND event_id = $2
FOR UPDATE SKIP LOCKED
```
If two requests race for the same seat, only one wins the lock. The other finds `rowCount < requested`, returns 409.

---

## 🌐 Deployment

### Backend (Render)
1. Push code to GitHub
2. Create new Web Service on Render.com
3. Root directory: `backend`
4. Build: `npm install && npm run build`
5. Start: `npm start`
6. Add all env variables in Render dashboard

### Frontend (Vercel)
1. Import GitHub repo on Vercel
2. Root directory: `frontend`
3. Build: `npm run build`
4. Output: `dist`
5. Add env var: `VITE_API_URL=https://your-backend.onrender.com/api`

---

## 👥 Demo Accounts

After setup, manually create these users via registration or insert directly:

| Email | Password | Role |
|---|---|---|
| admin@demo.com | Admin123! | admin |
| organiser@demo.com | Org123! | organiser |
| customer@demo.com | Cust123! | customer |
