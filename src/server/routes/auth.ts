import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { JWT_SECRET, COOKIE_NAME, authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24h
};

// ─── Validation schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['patient', 'pharmacy', 'distributor'] as const, {
    error: 'Role must be patient, pharmacy, or distributor',
  }),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  location: z.string().max(200).optional(),
  license_number: z.string().max(50).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetSchema = z.object({
  token: z.string().uuid('Invalid reset token'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ─── POST /register ───────────────────────────────────────────────────────────

router.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { email, password, role, name, location, license_number } = parsed.data;

  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    if (role === 'pharmacy' && !location) {
      return res.status(400).json({ error: 'Pharmacy address is required' });
    }

    const hashedPassword = bcrypt.hashSync(password, 12);

    const insertUser = db.prepare('INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)');
    const result = insertUser.run(email, hashedPassword, role, name);
    const userId = result.lastInsertRowid;

    if (role === 'pharmacy') {
      db.prepare('INSERT INTO pharmacies (user_id, name, location, license_number) VALUES (?, ?, ?, ?)').run(
        userId, name, location!, license_number || ''
      );
    }

    const token = jwt.sign({ id: userId, role, name }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    res.status(201).json({ user: { id: userId, email, role, name } });
  } catch (error) {
    console.error('[auth/register]', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── POST /login ──────────────────────────────────────────────────────────────

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { email, password } = parsed.data;

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact support.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    res.json({ user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (error) {
    console.error('[auth/login]', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── POST /logout ─────────────────────────────────────────────────────────────

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ message: 'Logged out' });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

router.get('/me', authenticateToken, (req: AuthRequest, res) => {
  const user = db.prepare('SELECT id, email, role, name, is_active FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user || !user.is_active) {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: 'User not found or deactivated' });
  }
  res.json({ user });
});

// ─── POST /forgot-password ────────────────────────────────────────────────────

router.post('/forgot-password', (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { email } = parsed.data;

  try {
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;

    // Always respond the same to avoid user enumeration
    const successMsg = { message: 'If that email exists, a reset token has been generated.' };

    if (!user) return res.json(successMsg);

    // Expire any existing tokens for this user
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
      user.id, token, expiresAt
    );

    // In production: send token via email. For now, return it in dev mode.
    if (process.env.NODE_ENV !== 'production') {
      return res.json({ ...successMsg, dev_token: token });
    }

    res.json(successMsg);
  } catch (error) {
    console.error('[auth/forgot-password]', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// ─── POST /reset-password ─────────────────────────────────────────────────────

router.post('/reset-password', (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { token, password } = parsed.data;

  try {
    const record = db.prepare(`
      SELECT * FROM password_reset_tokens
      WHERE token = ? AND used = 0 AND expires_at > datetime('now')
    `).get(token) as any;

    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashed = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, record.user_id);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(record.id);

    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (error) {
    console.error('[auth/reset-password]', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
