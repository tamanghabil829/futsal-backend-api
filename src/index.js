import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { releaseExpiredLocks, cancelExpiredBookings, generateMissingSlots } from './utils/cronJobs.js';
import { connectDB } from './database.js';

// Load environment variables
dotenv.config();

// Initialize Prisma with connection pool settings
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
  origin: [
    'https://futsal-pokhara.web.app', 
    'http://192.168.100.146:5000',
    'http://localhost:5000',
    'http://192.168.100.204:5000',
    /^http:\/\/localhost:[0-9]+$/
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
connectDB();

// Request logger for debugging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// Import routes
import authRoutes from './routes/auth.routes.js';
import futsalRoutes from './routes/futsal.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import ownerRoutes from './routes/owner.routes.js';
import courtRoutes from './routes/court.routes.js';
import notificationRoutes from './routes/notification.routes.js';

// import tournamentRoutes from './routes/tournament.routes.js'
import tournamentRoutes from './routes/tournament.routes.js';
import slotRoutes from './routes/slot.routes.js';
import reviewRoutes from './routes/review.routes.js';
import adminRoutes from "./routes/admin.routes.js";
import blockRoutes from "./routes/block.routes.js";
import uploadRoutes from './routes/upload.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import adRoutes from './routes/ad.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';   // ✅ Added

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/futsals', futsalRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api', courtRoutes);
app.use('/api/notifications', notificationRoutes);
// app.use('/api/tournaments', tournamentRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/reviews', reviewRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/owner/blocks", blockRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/admin/analytics', analyticsRoutes);    
app.use('/api/tournaments', tournamentRoutes); 


// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'success',
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    status: 'error',
    message: 'Something went wrong!' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Cron jobs (only in production/non‑test)
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('* * * * *', releaseExpiredLocks);
  cron.schedule('0 * * * *', cancelExpiredBookings);
  cron.schedule('0 0 * * *', generateMissingSlots);
  console.log('Cron jobs scheduled');
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('Disconnected from database');
  process.exit(0);
});