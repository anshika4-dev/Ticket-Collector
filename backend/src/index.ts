import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import venueRoutes from './routes/venues';
import seatRoutes from './routes/seats';
import bookingRoutes from './routes/bookings';
import waitlistRoutes from './routes/waitlist';
import adminRoutes from './routes/admin';
import organiserRoutes from './routes/organiser';
import { errorHandler } from './middleware/errorHandler';
import { startScheduler } from './services/scheduler';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    
    const isAllowed = allowed.includes(origin) || 
                      origin.endsWith('.vercel.app') || 
                      (process.env.FRONTEND_URL && origin.startsWith(process.env.FRONTEND_URL));

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

import transporter from './config/mailer';

// Health check
app.get('/health', async (_, res) => {
  let mailerStatus = 'unknown';
  let mailerError = null;
  try {
    await new Promise((resolve, reject) => {
      transporter.verify((err, success) => {
        if (err) reject(err);
        else resolve(success);
      });
    });
    mailerStatus = 'ready';
  } catch (err: any) {
    mailerStatus = 'failed';
    mailerError = err.message;
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mailer: {
      status: mailerStatus,
      error: mailerError,
      user: process.env.GMAIL_USER ? `${process.env.GMAIL_USER.substring(0, 3)}...` : 'not_set',
      passLength: process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 0,
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/organiser', organiserRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  startScheduler();
});

export default app;
