import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-dashboard-tests';
process.env.ADMIN_EMAIL = 'dashadmin@medtrace.test';
process.env.ADMIN_PASSWORD = 'Admin@Test2024!';
const TEST_DB = path.resolve('./medtrace-test-dashboard.db');
process.env.DB_PATH = TEST_DB;

const { default: authRoutes }      = await import('../src/server/routes/auth.js');
const { default: dashboardRoutes } = await import('../src/server/routes/dashboard.js');
const { default: adminRoutes }     = await import('../src/server/routes/admin.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/admin', adminRoutes);
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

const app = buildApp();
let adminCookie: string;
let distributorCookie: string;
let pharmacyCookie: string;

beforeAll(async () => {
  const admin = await request(app).post('/api/auth/login').send({
    email: 'dashadmin@medtrace.test', password: 'Admin@Test2024!'
  });
  adminCookie = admin.headers['set-cookie'][0];

  const dist = await request(app).post('/api/auth/register').send({
    email: 'dashdist@test.com', password: 'Dist@1234', role: 'distributor', name: 'Dash Distributor'
  });
  distributorCookie = dist.headers['set-cookie'][0];

  const pharm = await request(app).post('/api/auth/register').send({
    email: 'dashpharm@test.com', password: 'Pharm@1234', role: 'pharmacy',
    name: 'Dash Pharmacy', location: 'Parakou, Benin'
  });
  pharmacyCookie = pharm.headers['set-cookie'][0];
});

afterAll(() => {
  [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe('GET /api/dashboard/stats (admin)', () => {
  it('returns stats for admin', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalPharmacies: expect.any(Number),
      totalMedicines: expect.any(Number),
      totalScans: expect.any(Number),
      suspiciousScans: expect.any(Number),
      recentAlerts: expect.any(Array),
    });
  });

  it('returns 403 for distributor', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Cookie', distributorCookie);

    expect(res.status).toBe(403);
  });

  it('returns 401 for unauthenticated', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/dashboard/distributor-stats', () => {
  it('returns stats for distributor', async () => {
    const res = await request(app)
      .get('/api/dashboard/distributor-stats')
      .set('Cookie', distributorCookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalBatches: expect.any(Number),
      totalQRCodes: expect.any(Number),
      recentBatches: expect.any(Array),
    });
  });

  it('returns 403 for admin', async () => {
    const res = await request(app)
      .get('/api/dashboard/distributor-stats')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/dashboard/pharmacy-stats', () => {
  it('returns stats for pharmacy', async () => {
    const res = await request(app)
      .get('/api/dashboard/pharmacy-stats')
      .set('Cookie', pharmacyCookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalScans: expect.any(Number),
      dispensedToday: expect.any(Number),
      incomingShipments: expect.any(Array),
    });
  });
});

describe('GET /api/admin/users', () => {
  it('returns user list for admin', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns 403 for distributor', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', distributorCookie);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/admin/users/:id/status', () => {
  let newUserId: number;

  beforeAll(async () => {
    const r = await request(app).post('/api/auth/register').send({
      email: 'toggleuser@test.com', password: 'Toggle@123', role: 'patient', name: 'Toggle User'
    });
    newUserId = r.body.user.id;
  });

  it('admin can deactivate a user', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${newUserId}/status`)
      .set('Cookie', adminCookie)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  it('deactivated user cannot login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'toggleuser@test.com', password: 'Toggle@123' });

    expect(res.status).toBe(403);
  });

  it('admin can reactivate a user', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${newUserId}/status`)
      .set('Cookie', adminCookie)
      .send({ is_active: true });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/activated/i);
  });
});
