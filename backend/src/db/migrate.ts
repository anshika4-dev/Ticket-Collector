import pool from '../config/db';
import fs from 'fs';
import path from 'path';

async function migrate() {
  let schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    // Fallback to project root path (for compiled/production environments)
    schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
  }
  
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Could not locate schema.sql at either path.`);
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, 'utf-8');
  console.log('🔄 Running database migrations using schema:', schemaPath);
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
