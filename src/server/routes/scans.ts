import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import db from '../db.js';
import { JWT_SECRET, COOKIE_NAME, AuthRequest, JwtPayload } from '../middleware/auth.js';

const router = express.Router();

const verifySchema = z.object({
  qrCode: z.string().uuid('Invalid QR code format'),
  location: z.string().max(100).optional(),
});

function extractUser(req: AuthRequest): JwtPayload | undefined {
  const token = req.cookies?.[COOKIE_NAME] || req.headers['authorization']?.split(' ')[1];
  if (!token) return undefined;
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return undefined;
  }
}

// ─── POST /verify ─────────────────────────────────────────────────────────────

router.post('/verify', (req: AuthRequest, res) => {
  const user = extractUser(req);

  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ valid: false, message: parsed.error.issues[0].message });
  }

  const { qrCode, location } = parsed.data;
  const safeLocation = location || 'Unknown';

  try {
    const qrRecord = db.prepare(`
      SELECT q.id, q.unique_code, q.status,
             b.batch_number, b.expiration_date,
             m.name AS medicine_name, m.manufacturer, m.description, m.dosage
      FROM qr_codes q
      JOIN batches b ON q.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      WHERE q.unique_code = ?
    `).get(qrCode) as any;

    if (!qrRecord) {
      db.prepare('INSERT INTO scan_logs (qr_code_id, scanned_by_role, scanned_by_user_id, location, is_suspicious) VALUES (?, ?, ?, ?, 1)')
        .run(null, user?.role || 'patient', user?.id || null, safeLocation);

      return res.status(404).json({
        valid: false,
        message: 'QR code not found. This may be a counterfeit medicine — do not use it.',
      });
    }

    const isExpired = new Date(qrRecord.expiration_date) < new Date();

    const previousPatientScans = db.prepare(
      "SELECT COUNT(*) as count FROM scan_logs WHERE qr_code_id = ? AND scanned_by_role = 'patient'"
    ).get(qrRecord.id) as any;

    const isPatientScan = !user || user.role === 'patient';
    let isSuspicious = false;
    let message = isExpired ? 'Warning: This medicine has expired.' : 'Medicine verified as authentic.';

    if (isPatientScan && previousPatientScans.count > 0) {
      isSuspicious = true;
      message = 'Warning: This QR code has been scanned multiple times. Possible counterfeit or duplicate.';

      const existingAlert = db.prepare(
        "SELECT id FROM alerts WHERE qr_code_id = ? AND is_resolved = 0"
      ).get(qrRecord.id);
      if (!existingAlert) {
        db.prepare('INSERT INTO alerts (qr_code_id, message) VALUES (?, ?)').run(
          qrRecord.id,
          `Multiple patient scans detected for QR code ${qrCode.substring(0, 8)}...`
        );
      }
    }

    db.prepare('INSERT INTO scan_logs (qr_code_id, scanned_by_role, scanned_by_user_id, location, is_suspicious) VALUES (?, ?, ?, ?, ?)')
      .run(qrRecord.id, user?.role || 'patient', user?.id || null, safeLocation, isSuspicious ? 1 : 0);

    if (user?.role === 'pharmacy' && qrRecord.status === 'received') {
      db.prepare("UPDATE qr_codes SET status = 'dispensed' WHERE id = ?").run(qrRecord.id);
    }

    res.json({
      valid: !isSuspicious && !isExpired,
      message,
      medicine: {
        name: qrRecord.medicine_name,
        manufacturer: qrRecord.manufacturer,
        description: qrRecord.description,
        dosage: qrRecord.dosage,
        batchNumber: qrRecord.batch_number,
        expirationDate: qrRecord.expiration_date,
        status: qrRecord.status,
        isExpired,
      },
    });
  } catch (error) {
    console.error('[scans/verify]', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
