import express from 'express';
import { z } from 'zod';
import db from '../db.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticateToken, requireRole(['admin']));

// ─── GET /users ───────────────────────────────────────────────────────────────

router.get('/users', (_req: AuthRequest, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.email, u.role, u.name, u.is_active, u.created_at,
             p.location as pharmacy_location, p.license_number
      FROM users u
      LEFT JOIN pharmacies p ON p.user_id = u.id
      ORDER BY u.created_at DESC
    `).all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ─── PATCH /users/:id/status ──────────────────────────────────────────────────

const statusSchema = z.object({
  is_active: z.boolean(),
});

router.patch('/users/:id/status', (req: AuthRequest, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

  // Prevent admin from deactivating themselves
  if (userId === req.user!.id) {
    return res.status(400).json({ error: 'Cannot change your own account status' });
  }

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  try {
    const result = db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(
      parsed.data.is_active ? 1 : 0, userId
    );
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `User ${parsed.data.is_active ? 'activated' : 'deactivated'}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// ─── GET /scan-logs ───────────────────────────────────────────────────────────

router.get('/scan-logs', (_req: AuthRequest, res) => {
  try {
    const logs = db.prepare(`
      SELECT sl.id, sl.scan_time, sl.location, sl.is_suspicious, sl.scanned_by_role,
             u.name as scanned_by_name,
             q.unique_code,
             m.name as medicine_name
      FROM scan_logs sl
      LEFT JOIN users u    ON sl.scanned_by_user_id = u.id
      LEFT JOIN qr_codes q ON sl.qr_code_id = q.id
      LEFT JOIN batches b  ON q.batch_id = b.id
      LEFT JOIN medicines m ON b.medicine_id = m.id
      ORDER BY sl.scan_time DESC
      LIMIT 100
    `).all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scan logs' });
  }
});

// ─── GET /ai-insights (Gemini-powered analysis) ───────────────────────────────

router.get('/ai-insights', async (_req: AuthRequest, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI insights not configured. Set GEMINI_API_KEY in .env' });
  }

  try {
    // Gather recent statistics for the AI to analyze
    const stats = {
      suspicious_scans_7d: (db.prepare(`
        SELECT COUNT(*) as c FROM scan_logs
        WHERE is_suspicious = 1 AND scan_time >= DATE('now', '-7 days')
      `).get() as any).c,
      total_scans_7d: (db.prepare(`
        SELECT COUNT(*) as c FROM scan_logs
        WHERE scan_time >= DATE('now', '-7 days')
      `).get() as any).c,
      unresolved_alerts: (db.prepare('SELECT COUNT(*) as c FROM alerts WHERE is_resolved = 0').get() as any).c,
      top_suspicious_locations: db.prepare(`
        SELECT location, COUNT(*) as count
        FROM scan_logs WHERE is_suspicious = 1
        GROUP BY location ORDER BY count DESC LIMIT 5
      `).all(),
      scan_by_role: db.prepare(`
        SELECT scanned_by_role, COUNT(*) as count
        FROM scan_logs WHERE scan_time >= DATE('now', '-7 days')
        GROUP BY scanned_by_role
      `).all(),
    };

    const prompt = `You are a pharmaceutical supply chain security analyst for MedTrace Benin.

Here are the latest 7-day statistics from our medicine traceability system:
- Total scans: ${stats.total_scans_7d}
- Suspicious scans: ${stats.suspicious_scans_7d} (${stats.total_scans_7d > 0 ? ((stats.suspicious_scans_7d / stats.total_scans_7d) * 100).toFixed(1) : 0}%)
- Unresolved security alerts: ${stats.unresolved_alerts}
- Scans by role: ${JSON.stringify(stats.scan_by_role)}
- Top locations with suspicious scans: ${JSON.stringify(stats.top_suspicious_locations)}

Please provide:
1. A brief security assessment (2-3 sentences)
2. 2-3 specific actionable recommendations
3. Risk level: LOW / MEDIUM / HIGH

Keep it concise and practical for a pharmacy administrator in West Africa.`;

    const { GoogleGenAI } = await import('@google/genai');
    const genai = new GoogleGenAI({ apiKey });
    const result = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    res.json({
      insights: result.text,
      stats,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[admin/ai-insights]', error);
    res.status(500).json({ error: 'Failed to generate AI insights' });
  }
});

export default router;
