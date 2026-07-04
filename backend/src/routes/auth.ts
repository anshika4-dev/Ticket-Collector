import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'email, password and name are required' });
      return;
    }
    const allowedRoles = ['customer', 'organiser'];
    const userRole = allowedRoles.includes(role) ? role : 'customer';

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email, hash, name, userRole]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password required' });
      return;
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
      [email]
    );
    if (!result.rows.length) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'No token' }); return; }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const result = await pool.query(
      'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
      [decoded.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
