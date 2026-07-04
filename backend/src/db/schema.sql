-- ============================================================
-- Ticket Booking System - Database Schema
-- Compatible with PostgreSQL 14+ / Supabase
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'organiser', 'admin')),
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VENUES (admin manages)
-- ============================================================
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  total_rows INT NOT NULL,
  total_cols INT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEAT CATEGORIES (e.g. Premium, Standard, VIP)
-- ============================================================
CREATE TABLE IF NOT EXISTS seat_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#4CAF50',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VENUE SEATS (static layout per venue)
-- ============================================================
CREATE TABLE IF NOT EXISTS venue_seats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  row_num INT NOT NULL,
  col_num INT NOT NULL,
  label VARCHAR(20) NOT NULL,  -- e.g. A1, A2, B3
  category_id UUID REFERENCES seat_categories(id),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (venue_id, row_num, col_num)
);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('movie', 'concert', 'show', 'sport')),
  description TEXT,
  poster_url TEXT,
  organiser_id UUID NOT NULL REFERENCES users(id),
  venue_id UUID NOT NULL REFERENCES venues(id),
  date_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 120,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category pricing per event
CREATE TABLE IF NOT EXISTS event_category_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES seat_categories(id),
  price NUMERIC(10, 2) NOT NULL,
  UNIQUE (event_id, category_id)
);

-- ============================================================
-- SHOW SEATS (per-event seat status — mutable)
-- ============================================================
CREATE TABLE IF NOT EXISTS show_seats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  venue_seat_id UUID NOT NULL REFERENCES venue_seats(id),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'held', 'booked')),
  held_by UUID REFERENCES users(id),
  held_until TIMESTAMPTZ,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  UNIQUE (event_id, venue_seat_id)
);

-- Index for fast TTL expiry sweeps
CREATE INDEX IF NOT EXISTS idx_show_seats_held_until ON show_seats(held_until) WHERE status = 'held';
CREATE INDEX IF NOT EXISTS idx_show_seats_event ON show_seats(event_id);
CREATE INDEX IF NOT EXISTS idx_show_seats_status ON show_seats(status);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  event_id UUID NOT NULL REFERENCES events(id),
  booking_ref VARCHAR(20) UNIQUE NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'pending')),
  qr_code_data TEXT,
  payment_method VARCHAR(50) DEFAULT 'card',
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(booking_ref);

-- ============================================================
-- BOOKING SEATS (which seats belong to a booking)
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_seats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  show_seat_id UUID NOT NULL REFERENCES show_seats(id),
  UNIQUE (booking_id, show_seat_id)
);

-- ============================================================
-- WAITLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  category_id UUID NOT NULL REFERENCES seat_categories(id),
  position INT NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'completed', 'expired', 'removed')),
  offer_expires_at TIMESTAMPTZ,
  offer_token VARCHAR(255),
  offered_show_seat_id UUID REFERENCES show_seats(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_event_cat ON waitlist(event_id, category_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_offer_expires ON waitlist(offer_expires_at) WHERE status = 'offered';
