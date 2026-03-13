import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import authRoutes from '../src/server/routes/auth.js';
import medicineRoutes from '../src/server/routes/medicines.js';
import scanRoutes from '../src/server/routes/scans.js';
import dashboardRoutes from '../src/server/routes/dashboard.js';
import adminRoutes from '../src/server/routes/admin.js';

// Use in-memory SQLite for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'Admin@Test123!';

// Override db module to use in-memory DB
// We import db after setting env vars so the seeding uses correct credentials

export function createTestApp(db: Database.Database) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/medicines', medicineRoutes);
  app.use('/api/scans', scanRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/admin', adminRoutes);
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}
