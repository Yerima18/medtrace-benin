import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-medicine-tests';
process.env.ADMIN_EMAIL = 'medadmin@medtrace.test';
process.env.ADMIN_PASSWORD = 'Admin@Test2024!';
const TEST_DB = path.resolve('./medtrace-test-medicines.db');
process.env.DB_PATH = TEST_DB;

const { default: authRoutes }     = await import('../src/server/routes/auth.js');
const { default: medicineRoutes } = await import('../src/server/routes/medicines.js');
const { default: scanRoutes }     = await import('../src/server/routes/scans.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/medicines', medicineRoutes);
  app.use('/api/scans', scanRoutes);
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

const app = buildApp();
let distributorCookie: string;
let pharmacyCookie: string;
let patientCookie: string;
let batchId: number;
const FUTURE_DATE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

beforeAll(async () => {
  // Register distributor
  const dist = await request(app).post('/api/auth/register').send({
    email: 'distributor@med.test', password: 'Dist@1234', role: 'distributor', name: 'Test Distributor'
  });
  distributorCookie = dist.headers['set-cookie'][0];

  // Register pharmacy
  const pharm = await request(app).post('/api/auth/register').send({
    email: 'pharmacy@med.test', password: 'Pharm@1234', role: 'pharmacy',
    name: 'Test Pharmacy', location: 'Cotonou, Benin'
  });
  pharmacyCookie = pharm.headers['set-cookie'][0];

  // Register patient
  const pat = await request(app).post('/api/auth/register').send({
    email: 'patient@med.test', password: 'Pat@12345', role: 'patient', name: 'Test Patient'
  });
  patientCookie = pat.headers['set-cookie'][0];
});

afterAll(() => {
  [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe('POST /api/medicines/register', () => {
  it('distributor can register a batch', async () => {
    const res = await request(app)
      .post('/api/medicines/register')
      .set('Cookie', distributorCookie)
      .send({
        name: 'Paracetamol 500mg', manufacturer: 'PharmaCorp',
        batch_number: 'BATCH-001', expiration_date: FUTURE_DATE, quantity: 5
      });

    expect(res.status).toBe(201);
    expect(res.body.batchId).toBeDefined();
    expect(res.body.qrCodesCount).toBe(5);
    batchId = res.body.batchId;
  });

  it('rejects duplicate batch number', async () => {
    const res = await request(app)
      .post('/api/medicines/register')
      .set('Cookie', distributorCookie)
      .send({
        name: 'Paracetamol 500mg', manufacturer: 'PharmaCorp',
        batch_number: 'BATCH-001', expiration_date: FUTURE_DATE, quantity: 1
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('rejects expired expiration date', async () => {
    const res = await request(app)
      .post('/api/medicines/register')
      .set('Cookie', distributorCookie)
      .send({
        name: 'Old Drug', manufacturer: 'OldCorp',
        batch_number: 'BATCH-EXPIRED', expiration_date: '2020-01-01', quantity: 1
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/i);
  });

  it('rejects quantity > 10000', async () => {
    const res = await request(app)
      .post('/api/medicines/register')
      .set('Cookie', distributorCookie)
      .send({
        name: 'Big Batch', manufacturer: 'BigCorp',
        batch_number: 'BATCH-BIG', expiration_date: FUTURE_DATE, quantity: 99999
      });

    expect(res.status).toBe(400);
  });

  it('patients cannot register medicine', async () => {
    const res = await request(app)
      .post('/api/medicines/register')
      .set('Cookie', patientCookie)
      .send({
        name: 'Fake Drug', manufacturer: 'FakeCorp',
        batch_number: 'FAKE-001', expiration_date: FUTURE_DATE, quantity: 1
      });

    expect(res.status).toBe(403);
  });

  it('unauthenticated request is rejected', async () => {
    const res = await request(app)
      .post('/api/medicines/register')
      .send({ name: 'Anon Drug', manufacturer: 'AnonCorp', batch_number: 'ANON-001', expiration_date: FUTURE_DATE, quantity: 1 });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/medicines/batch/:id/qrcodes', () => {
  it('distributor can fetch QR codes for their batch', async () => {
    const res = await request(app)
      .get(`/api/medicines/batch/${batchId}/qrcodes`)
      .set('Cookie', distributorCookie);

    expect(res.status).toBe(200);
    expect(res.body.qrCodes).toHaveLength(5);
    expect(res.body.batchInfo.batch_number).toBe('BATCH-001');
  });

  it('pharmacy cannot access QR codes', async () => {
    const res = await request(app)
      .get(`/api/medicines/batch/${batchId}/qrcodes`)
      .set('Cookie', pharmacyCookie);

    expect(res.status).toBe(403);
  });
});

describe('QR code verification', () => {
  let qrCode: string;

  beforeAll(async () => {
    const res = await request(app)
      .get(`/api/medicines/batch/${batchId}/qrcodes`)
      .set('Cookie', distributorCookie);
    qrCode = res.body.qrCodes[0].unique_code;
  });

  it('verifies a valid QR code', async () => {
    const res = await request(app)
      .post('/api/scans/verify')
      .send({ qrCode, location: 'Cotonou' });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.medicine.name).toBe('Paracetamol 500mg');
  });

  it('flags second patient scan as suspicious', async () => {
    const res = await request(app)
      .post('/api/scans/verify')
      .send({ qrCode, location: 'Porto-Novo' });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.message).toMatch(/scanned multiple times/i);
  });

  it('returns 404 for non-existent QR code', async () => {
    const res = await request(app)
      .post('/api/scans/verify')
      .send({ qrCode: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
    expect(res.body.valid).toBe(false);
  });

  it('rejects invalid UUID format', async () => {
    const res = await request(app)
      .post('/api/scans/verify')
      .send({ qrCode: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/medicines/batch/:id/qrcodes/export', () => {
  it('returns CSV file', async () => {
    const res = await request(app)
      .get(`/api/medicines/batch/${batchId}/qrcodes/export`)
      .set('Cookie', distributorCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('unique_code,status');
    expect(res.text).toContain('Paracetamol 500mg');
  });
});
