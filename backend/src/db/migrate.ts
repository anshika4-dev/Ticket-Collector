import pool from '../config/db';
import fs from 'fs';
import path from 'path';

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  console.log('🔄 Running database migrations...');
  try {
    await pool.query(sql);
    console.log('✅ Database schema created successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
