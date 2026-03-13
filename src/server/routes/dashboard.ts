import express from 'express';
import db from '../db.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// ─── GET /stats (admin) ───────────────────────────────────────────────────────

router.get('/stats', authenticateToken, requireRole(['admin']), (_req: AuthRequest, res) => {
  try {
    const totalPharmacies    = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'pharmacy'").get() as any).c;
    const totalDistributors  = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'distributor'").get() as any).c;
    const totalMedicines     = (db.prepare('SELECT COUNT(*) as c FROM medicines').get() as any).c;
    const totalBatches       = (db.prepare('SELECT COUNT(*) as c FROM batches').get() as any).c;
    const totalQRCodes       = (db.prepare('SELECT COUNT(*) as c FROM qr_codes').get() as any).c;
    const totalScans         = (db.prepare('SELECT COUNT(*) as c FROM scan_logs').get() as any).c;
    const suspiciousScans    = (db.prepare('SELECT COUNT(*) as c FROM scan_logs WHERE is_suspicious = 1').get() as any).c;
    const unresolvedAlerts   = (db.prepare('SELECT COUNT(*) as c FROM alerts WHERE is_resolved = 0').get() as any).c;

    const recentAlerts = db.prepare(`
      SELECT a.id, a.message, a.created_at, a.is_resolved, q.unique_code
      FROM alerts a
      JOIN qr_codes q ON a.qr_code_id = q.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all();

    // Scan trend: last 7 days
    const scanTrend = db.prepare(`
      SELECT DATE(scan_time) as date, COUNT(*) as scans,
             SUM(is_suspicious) as suspicious
      FROM scan_logs
      WHERE scan_time >= DATE('now', '-6 days')
      GROUP BY DATE(scan_time)
      ORDER BY date ASC
    `).all();

    // Top scanned medicines
    const topMedicines = db.prepare(`
      SELECT m.name, COUNT(sl.id) as scan_count
      FROM scan_logs sl
      JOIN qr_codes q  ON sl.qr_code_id = q.id
      JOIN batches b   ON q.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      GROUP BY m.id
      ORDER BY scan_count DESC
      LIMIT 5
    `).all();

    res.json({
      totalPharmacies,
      totalDistributors,
      totalMedicines,
      totalBatches,
      totalQRCodes,
      totalScans,
      suspiciousScans,
      unresolvedAlerts,
      recentAlerts,
      scanTrend,
      topMedicines,
    });
  } catch (error) {
    console.error('[dashboard/stats]', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ─── GET /distributor-stats ───────────────────────────────────────────────────

router.get('/distributor-stats', authenticateToken, requireRole(['distributor']), (req: AuthRequest, res) => {
  const distributorId = req.user!.id;

  try {
    const totalBatches   = (db.prepare('SELECT COUNT(*) as c FROM batches WHERE distributor_id = ?').get(distributorId) as any).c;
    const totalQRCodes   = (db.prepare(`
      SELECT COUNT(*) as c FROM qr_codes q
      JOIN batches b ON q.batch_id = b.id
      WHERE b.distributor_id = ?
    `).get(distributorId) as any).c;
    const shippedBatches = (db.prepare(`
      SELECT COUNT(DISTINCT b.id) as c
      FROM batches b
      JOIN shipments s ON s.batch_id = b.id
      WHERE b.distributor_id = ? AND s.status = 'in_transit'
    `).get(distributorId) as any).c;

    const recentBatches = db.prepare(`
      SELECT b.id, b.batch_number, m.name, b.quantity, b.expiration_date, b.created_at,
             (SELECT COUNT(*) FROM qr_codes WHERE batch_id = b.id AND status = 'dispensed') as dispensed_count
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      WHERE b.distributor_id = ?
      ORDER BY b.created_at DESC
      LIMIT 10
    `).all(distributorId);

    res.json({ totalBatches, totalQRCodes, shippedBatches, recentBatches });
  } catch (error) {
    console.error('[dashboard/distributor-stats]', error);
    res.status(500).json({ error: 'Failed to fetch distributor stats' });
  }
});

// ─── GET /pharmacy-stats ──────────────────────────────────────────────────────

router.get('/pharmacy-stats', authenticateToken, requireRole(['pharmacy']), (req: AuthRequest, res) => {
  const userId = req.user!.id;

  try {
    const totalScans = (db.prepare(`
      SELECT COUNT(*) as c FROM scan_logs WHERE scanned_by_user_id = ?
    `).get(userId) as any).c;

    const dispensedToday = (db.prepare(`
      SELECT COUNT(*) as c FROM scan_logs
      WHERE scanned_by_user_id = ? AND DATE(scan_time) = DATE('now')
    `).get(userId) as any).c;

    const incomingShipments = db.prepare(`
      SELECT s.id, s.status, s.shipped_at, b.batch_number, m.name as medicine_name, b.quantity,
             u.name as from_name
      FROM shipments s
      JOIN batches b ON s.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      JOIN users u ON s.from_user_id = u.id
      WHERE s.to_user_id = ? AND s.status = 'in_transit'
      ORDER BY s.shipped_at DESC
    `).all(userId);

    const recentScans = db.prepare(`
      SELECT sl.scan_time, sl.location, m.name as medicine_name, q.unique_code, q.status
      FROM scan_logs sl
      JOIN qr_codes q ON sl.qr_code_id = q.id
      JOIN batches b ON q.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      WHERE sl.scanned_by_user_id = ?
      ORDER BY sl.scan_time DESC
      LIMIT 10
    `).all(userId);

    res.json({ totalScans, dispensedToday, incomingShipments, recentScans });
  } catch (error) {
    console.error('[dashboard/pharmacy-stats]', error);
    res.status(500).json({ error: 'Failed to fetch pharmacy stats' });
  }
});

// ─── POST /alerts/:id/resolve ─────────────────────────────────────────────────

router.post('/alerts/:id/resolve', authenticateToken, requireRole(['admin']), (req: AuthRequest, res) => {
  const alertId = parseInt(req.params.id, 10);
  if (isNaN(alertId)) return res.status(400).json({ error: 'Invalid alert ID' });

  try {
    const result = db.prepare('UPDATE alerts SET is_resolved = 1 WHERE id = ?').run(alertId);
    if (result.changes === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert resolved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

export default router;
