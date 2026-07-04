import pool from '../config/db';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding demo data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create demo users
    const adminHash = await bcrypt.hash('Admin123!', 12);
    const orgHash = await bcrypt.hash('Org123!', 12);
    const custHash = await bcrypt.hash('Cust123!', 12);

    const [admin, org, cust] = await Promise.all([
      client.query(`INSERT INTO users (email, password_hash, name, role) VALUES ('admin@demo.com', $1, 'Admin User', 'admin') ON CONFLICT (email) DO UPDATE SET role='admin' RETURNING id`, [adminHash]),
      client.query(`INSERT INTO users (email, password_hash, name, role) VALUES ('organiser@demo.com', $1, 'Demo Organiser', 'organiser') ON CONFLICT (email) DO UPDATE SET role='organiser' RETURNING id`, [orgHash]),
      client.query(`INSERT INTO users (email, password_hash, name, role) VALUES ('customer@demo.com', $1, 'Demo Customer', 'customer') ON CONFLICT (email) DO UPDATE SET role='customer' RETURNING id`, [custHash]),
    ]);

    const adminId = admin.rows[0].id;
    const orgId = org.rows[0].id;
    const custId = cust.rows[0].id;
    console.log('✅ Demo users created');

    // Create a demo venue
    const venueResult = await client.query(`
      INSERT INTO venues (name, address, city, total_rows, total_cols, created_by)
      VALUES ('Grand Arena', '123 Main Street', 'Mumbai', 10, 12, $1)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [adminId]);

    if (!venueResult.rows.length) {
      console.log('ℹ️  Venue already exists, skipping seats/events');
      await client.query('COMMIT');
      return;
    }

    const venueId = venueResult.rows[0].id;

    // Categories
    const premiumCat = await client.query(
      `INSERT INTO seat_categories (venue_id, name, color, description) VALUES ($1, 'Premium', '#ffd700', 'Front rows with best view') RETURNING id`,
      [venueId]
    );
    const standardCat = await client.query(
      `INSERT INTO seat_categories (venue_id, name, color, description) VALUES ($1, 'Standard', '#7c6bff', 'Main section seats') RETURNING id`,
      [venueId]
    );
    const economyCat = await client.query(
      `INSERT INTO seat_categories (venue_id, name, color, description) VALUES ($1, 'Economy', '#00d97e', 'Budget-friendly rear seats') RETURNING id`,
      [venueId]
    );

    const premiumCatId = premiumCat.rows[0].id;
    const standardCatId = standardCat.rows[0].id;
    const economyCatId = economyCat.rows[0].id;

    // Generate seats: rows 1-2 = Premium, 3-7 = Standard, 8-10 = Economy
    for (let r = 1; r <= 10; r++) {
      const catId = r <= 2 ? premiumCatId : r <= 7 ? standardCatId : economyCatId;
      const rowLetter = String.fromCharCode(64 + r);
      for (let c = 1; c <= 12; c++) {
        await client.query(
          `INSERT INTO venue_seats (venue_id, row_num, col_num, label, category_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          [venueId, r, c, `${rowLetter}${c}`, catId]
        );
      }
    }
    console.log('✅ Venue & seats created (10x12 = 120 seats)');

    // Create demo events
    const event1 = await client.query(`
      INSERT INTO events (title, type, description, organiser_id, venue_id, date_time, duration_minutes)
      VALUES ('Coldplay Music of the Spheres Tour', 'concert', 'An unforgettable night with Coldplay. Experience the Music of the Spheres World Tour live!', $1, $2, NOW() + INTERVAL '7 days', 150)
      RETURNING id
    `, [orgId, venueId]);

    const event2 = await client.query(`
      INSERT INTO events (title, type, description, organiser_id, venue_id, date_time, duration_minutes)
      VALUES ('Avengers: Secret Wars', 'movie', 'The epic conclusion to the Multiverse Saga. Watch Earth''s mightiest heroes face their greatest challenge.', $1, $2, NOW() + INTERVAL '3 days', 180)
      RETURNING id
    `, [orgId, venueId]);

    // Category prices per event
    for (const evId of [event1.rows[0].id, event2.rows[0].id]) {
      const isMovie = evId === event2.rows[0].id;
      await client.query(`INSERT INTO event_category_prices (event_id, category_id, price) VALUES ($1, $2, $3)`, [evId, premiumCatId, isMovie ? 500 : 2500]);
      await client.query(`INSERT INTO event_category_prices (event_id, category_id, price) VALUES ($1, $2, $3)`, [evId, standardCatId, isMovie ? 300 : 1500]);
      await client.query(`INSERT INTO event_category_prices (event_id, category_id, price) VALUES ($1, $2, $3)`, [evId, economyCatId, isMovie ? 150 : 800]);
    }

    // Create show_seats for each event
    const venueSeats = await client.query('SELECT vs.*, ecp.price FROM venue_seats vs LEFT JOIN event_category_prices ecp ON ecp.category_id = vs.category_id AND ecp.event_id = $1 WHERE vs.venue_id = $2', [event1.rows[0].id, venueId]);

    for (const evId of [event1.rows[0].id, event2.rows[0].id]) {
      const seatsWithPrices = await client.query(`
        SELECT vs.*, ecp.price
        FROM venue_seats vs
        LEFT JOIN event_category_prices ecp ON ecp.category_id = vs.category_id AND ecp.event_id = $1
        WHERE vs.venue_id = $2
      `, [evId, venueId]);

      for (const seat of seatsWithPrices.rows) {
        await client.query(
          `INSERT INTO show_seats (event_id, venue_seat_id, price) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [evId, seat.id, seat.price || 0]
        );
      }
    }

    console.log('✅ 2 demo events created with show seats');

    await client.query('COMMIT');
    console.log('\n🎉 Seed complete! Demo accounts:');
    console.log('   admin@demo.com / Admin123!');
    console.log('   organiser@demo.com / Org123!');
    console.log('   customer@demo.com / Cust123!');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();
