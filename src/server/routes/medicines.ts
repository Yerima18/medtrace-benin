import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../db.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const registerBatchSchema = z.object({
  name: z.string().min(2, 'Medicine name is required').max(200),
  manufacturer: z.string().min(2, 'Manufacturer is required').max(200),
  description: z.string().max(1000).optional(),
  dosage: z.string().max(200).optional(),
  batch_number: z.string().min(1, 'Batch number is required').max(100),
  expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiration date must be YYYY-MM-DD'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(10000, 'Maximum 10,000 units per batch'),
});

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', authenticateToken, (_req: AuthRequest, res) => {
  try {
    const medicines = db.prepare(`
      SELECT m.*, COUNT(DISTINCT b.id) as batch_count
      FROM medicines m
      LEFT JOIN batches b ON b.medicine_id = m.id
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `).all();
    res.json(medicines);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch medicines' });
  }
});

// ─── POST /register ───────────────────────────────────────────────────────────

router.post('/register', authenticateToken, requireRole(['distributor', 'admin']), (req: AuthRequest, res) => {
  const parsed = registerBatchSchema.safeParse({
    ...req.body,
    quantity: Number(req.body.quantity),
  });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { name, manufacturer, description, dosage, batch_number, expiration_date, quantity } = parsed.data;
  const distributorId = req.user!.id;

  if (new Date(expiration_date) <= new Date()) {
    return res.status(400).json({ error: 'Expiration date must be in the future' });
  }

  const registerBatch = db.transaction(() => {
    let medicine = db.prepare('SELECT id FROM medicines WHERE name = ? AND manufacturer = ?').get(name, manufacturer) as any;
    let medicineId: number | bigint;

    if (!medicine) {
      const result = db.prepare('INSERT INTO medicines (name, manufacturer, description, dosage) VALUES (?, ?, ?, ?)').run(
        name, manufacturer, description || '', dosage || ''
      );
      medicineId = result.lastInsertRowid;
    } else {
      medicineId = medicine.id;
    }

    const batchResult = db.prepare(
      'INSERT INTO batches (medicine_id, distributor_id, batch_number, expiration_date, quantity) VALUES (?, ?, ?, ?, ?)'
    ).run(medicineId, distributorId, batch_number, expiration_date, quantity);
    const batchId = batchResult.lastInsertRowid;

    const insertQR = db.prepare('INSERT INTO qr_codes (batch_id, unique_code) VALUES (?, ?)');
    for (let i = 0; i < quantity; i++) {
      insertQR.run(batchId, uuidv4());
    }

    return { batchId };
  });

  try {
    const { batchId } = registerBatch();
    res.status(201).json({
      message: 'Medicine registered and QR codes generated successfully',
      batchId,
      qrCodesCount: quantity,
    });
  } catch (error: any) {
    console.error('[medicines/register]', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Batch number already exists' });
    }
    res.status(500).json({ error: 'Failed to register medicine' });
  }
});

// ─── GET /batch/:batchId/qrcodes ──────────────────────────────────────────────

router.get('/batch/:batchId/qrcodes', authenticateToken, requireRole(['distributor', 'admin']), (req: AuthRequest, res) => {
  const batchId = parseInt(req.params.batchId, 10);
  if (isNaN(batchId)) return res.status(400).json({ error: 'Invalid batch ID' });

  const userId = req.user!.id;
  const role = req.user!.role;

  try {
    const batchInfo = db.prepare(`
      SELECT b.id, b.batch_number, b.expiration_date, b.quantity, m.name, m.manufacturer
      FROM batches b JOIN medicines m ON b.medicine_id = m.id
      WHERE b.id = ? ${role === 'distributor' ? 'AND b.distributor_id = ?' : ''}
    `).get(...(role === 'distributor' ? [batchId, userId] : [batchId])) as any;

    if (!batchInfo) {
      return res.status(404).json({ error: 'Batch not found or access denied' });
    }

    const qrCodes = db.prepare(
      'SELECT id, unique_code, status FROM qr_codes WHERE batch_id = ? ORDER BY id'
    ).all(batchId);

    res.json({ batchInfo, qrCodes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
});

// ─── POST /batch/:batchId/ship ────────────────────────────────────────────────

const shipSchema = z.object({
  to_user_id: z.number().int().positive('Recipient ID is required'),
  notes: z.string().max(500).optional(),
});

router.post('/batch/:batchId/ship', authenticateToken, requireRole(['distributor', 'admin']), (req: AuthRequest, res) => {
  const batchId = parseInt(req.params.batchId, 10);
  if (isNaN(batchId)) return res.status(400).json({ error: 'Invalid batch ID' });

  const parsed = shipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { to_user_id, notes } = parsed.data;
  const fromUserId = req.user!.id;

  try {
    const batch = db.prepare('SELECT id FROM batches WHERE id = ? AND distributor_id = ?').get(batchId, fromUserId) as any;
    if (!batch) return res.status(404).json({ error: 'Batch not found or access denied' });

    const recipient = db.prepare("SELECT id FROM users WHERE id = ? AND is_active = 1 AND role IN ('pharmacy', 'admin')").get(to_user_id) as any;
    if (!recipient) return res.status(404).json({ error: 'Recipient pharmacy not found' });

    db.prepare("UPDATE qr_codes SET status = 'shipped' WHERE batch_id = ? AND status = 'generated'").run(batchId);
    db.prepare(`
      INSERT INTO shipments (batch_id, from_user_id, to_user_id, status, notes, shipped_at)
      VALUES (?, ?, ?, 'in_transit', ?, datetime('now'))
    `).run(batchId, fromUserId, to_user_id, notes || null);

    res.json({ message: 'Batch marked as shipped' });
  } catch (error) {
    console.error('[medicines/ship]', error);
    res.status(500).json({ error: 'Failed to update shipment status' });
  }
});

// ─── POST /batch/:batchId/receive ─────────────────────────────────────────────

router.post('/batch/:batchId/receive', authenticateToken, requireRole(['pharmacy', 'admin']), (req: AuthRequest, res) => {
  const batchId = parseInt(req.params.batchId, 10);
  if (isNaN(batchId)) return res.status(400).json({ error: 'Invalid batch ID' });

  const userId = req.user!.id;

  try {
    const shipment = db.prepare(`
      SELECT id FROM shipments
      WHERE batch_id = ? AND to_user_id = ? AND status = 'in_transit'
    `).get(batchId, userId) as any;

    if (!shipment) return res.status(404).json({ error: 'No in-transit shipment found for this batch' });

    db.prepare("UPDATE qr_codes SET status = 'received' WHERE batch_id = ? AND status = 'shipped'").run(batchId);
    db.prepare(`
      UPDATE shipments SET status = 'delivered', delivered_at = datetime('now') WHERE id = ?
    `).run(shipment.id);

    res.json({ message: 'Batch marked as received' });
  } catch (error) {
    console.error('[medicines/receive]', error);
    res.status(500).json({ error: 'Failed to update receipt status' });
  }
});

// ─── GET /batch/:batchId/qrcodes/export ───────────────────────────────────────

router.get('/batch/:batchId/qrcodes/export', authenticateToken, requireRole(['distributor', 'admin']), (req: AuthRequest, res) => {
  const batchId = parseInt(req.params.batchId, 10);
  if (isNaN(batchId)) return res.status(400).json({ error: 'Invalid batch ID' });

  const userId = req.user!.id;
  const role = req.user!.role;

  try {
    const batchInfo = db.prepare(`
      SELECT b.batch_number, m.name, m.manufacturer, b.expiration_date
      FROM batches b JOIN medicines m ON b.medicine_id = m.id
      WHERE b.id = ? ${role === 'distributor' ? 'AND b.distributor_id = ?' : ''}
    `).get(...(role === 'distributor' ? [batchId, userId] : [batchId])) as any;

    if (!batchInfo) return res.status(404).json({ error: 'Batch not found or access denied' });

    const qrCodes = db.prepare(
      'SELECT unique_code, status FROM qr_codes WHERE batch_id = ? ORDER BY id'
    ).all(batchId) as any[];

    const csv = [
      'unique_code,status,medicine,manufacturer,batch_number,expiration_date',
      ...qrCodes.map(qr =>
        [qr.unique_code, qr.status, `"${batchInfo.name}"`, `"${batchInfo.manufacturer}"`, batchInfo.batch_number, batchInfo.expiration_date].join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="batch-${batchInfo.batch_number}-qrcodes.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export QR codes' });
  }
});

export default router;
