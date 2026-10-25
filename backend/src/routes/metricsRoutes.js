// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Metrics Routes
// GET /api/metrics         — dashboard metrics
// GET /api/metrics/traffic — traffic chart data points
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import { getMetrics, getTrafficData } from '../services/metricsService.js';

const router = Router();

/**
 * GET /api/metrics
 * Returns current dashboard metric values.
 */
router.get('/', (req, res) => {
  try {
    const metrics = getMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    console.error('[Metrics] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve metrics' });
  }
});

/**
 * GET /api/metrics/traffic
 * Returns traffic chart data points.
 */
router.get('/traffic', (req, res) => {
  try {
    const traffic = getTrafficData();
    res.json({ success: true, data: traffic });
  } catch (err) {
    console.error('[Metrics] Traffic error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve traffic data' });
  }
});

export default router;
