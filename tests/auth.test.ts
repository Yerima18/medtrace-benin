import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';

// Must set env vars BEFORE importing anything that uses them
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-auth-tests';
process.env.ADMIN_EMAIL = 'testadmin@medtrace.test';
process.env.ADMIN_PASSWORD = 'Admin@Test2024!';
const TEST_DB = path.resolve('./medtrace-test-auth.db');
process.env.DB_PATH = TEST_DB;

// Now import routes (which import db, which will use TEST_DB)
const { default: authRoutes } = await import('../src/server/routes/auth.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

const app = buildApp();

afterAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const walFile = TEST_DB + '-wal';
  const shmFile = TEST_DB + '-shm';
  if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
  if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
});

describe('POST /api/auth/register', () => {
  it('registers a patient successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'patient@test.com', password: 'Patient@123', role: 'patient', name: 'Test Patient' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'patient@test.com', role: 'patient' });
    expect(res.headers['set-cookie']).toBeDefined();
    // Cookie should not expose JWT in response body
    expect(res.body.token).toBeUndefined();
  });

  it('rejects duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', password: 'Dup@12345', role: 'patient', name: 'Dup User' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', password: 'Dup@12345', role: 'patient', name: 'Dup User' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('rejects weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@test.com', password: 'weak', role: 'patient', name: 'Weak Pass' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'Valid@123', role: 'patient', name: 'Bad Email' });

    expect(res.status).toBe(400);
  });

  it('requires pharmacy location when role is pharmacy', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'noloc@test.com', password: 'Valid@123', role: 'pharmacy', name: 'No Location Pharmacy' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/address/i);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'logintest@test.com', password: 'Login@123', role: 'patient', name: 'Login Test' });
  });

  it('logs in with correct credentials and sets httpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logintest@test.com', password: 'Login@123' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'logintest@test.com' });
    expect(res.body.token).toBeUndefined(); // token must not be in body
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logintest@test.com', password: 'Wrong@123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('rejects non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'Nobody@123' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user info when authenticated via cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logintest@test.com', password: 'Login@123' });

    const cookie = loginRes.headers['set-cookie'][0];

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('logintest@test.com');
  });

  it('returns 401 without cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logintest@test.com', password: 'Login@123' });

    const cookie = loginRes.headers['set-cookie'][0];

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(logoutRes.status).toBe(200);
    // Cookie should be cleared (Max-Age=0 or expires in past)
    const logoutCookies = ([] as string[]).concat(logoutRes.headers['set-cookie'] ?? []);
    expect(logoutCookies.some((c: string) => c.includes('medtrace_token=;'))).toBe(true);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns dev_token in non-production mode', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'logintest@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.dev_token).toBeDefined();
  });

  it('returns same message for non-existent email (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(res.body.dev_token).toBeUndefined();
  });
});
