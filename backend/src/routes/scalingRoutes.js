// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Scaling Routes (Stage 4)
//
// API endpoints for controlling the auto-scaling engine.
//
// GET  /api/scaling            — engine status
// POST /api/scaling/enable     — start auto-scaling
// POST /api/scaling/disable    — stop auto-scaling
// POST /api/scaling/scale-out  — manual scale out
// POST /api/scaling/scale-in   — manual scale in
// POST /api/scaling/test-cpu   — set test CPU override
// POST /api/scaling/stress      — start a real stress test
// POST /api/scaling/stress/stop — stop the stress test
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import {
  enableEngine,
  disableEngine,
  scaleOut,
  scaleIn,
  getEngineStatus,
  getWorkerList,
  setTestCpu,
} from '../services/scalingEngine.js';
import { isNginxAvailable, getNginxStatus, checkNginxHealth } from '../services/nginxManager.js';
import { startLoadTest, stopLoadTest, getLoadStatus } from '../services/loadGenerator.js';

const router = Router();

/**
 * GET /api/scaling
 * Returns full engine status including workers, CPU, thresholds.
 * Runs a fresh NGINX health check on every request.
 */
router.get('/', async (req, res) => {
  try {
    // Run a fresh NGINX health check (async HTTP probe to port 8080)
    await checkNginxHealth();

    const status = getEngineStatus();
    const workers = getWorkerList();
    const nginx = getNginxStatus();

    res.json({
      success: true,
      data: {
        ...status,
        workers,
        nginx,
        stress: getLoadStatus(),
      },
    });
  } catch (err) {
    console.error('[Scaling API] GET error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get scaling status' });
  }
});

/**
 * POST /api/scaling/enable
 * Start the auto-scaling monitoring loop.
 */
router.post('/enable', (req, res) => {
  try {
    const result = enableEngine();
    const statusCode = result.success ? 200 : 409;
    res.status(statusCode).json({ success: result.success, message: result.message });
  } catch (err) {
    console.error('[Scaling API] Enable error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/scaling/disable
 * Stop the auto-scaling monitoring loop (workers keep running).
 */
router.post('/disable', (req, res) => {
  try {
    const result = disableEngine();
    const statusCode = result.success ? 200 : 409;
    res.status(statusCode).json({ success: result.success, message: result.message });
  } catch (err) {
    console.error('[Scaling API] Disable error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/scaling/scale-out
 * Manually add one worker (respects maxInstances limit).
 */
router.post('/scale-out', async (req, res) => {
  try {
    const result = await scaleOut('manual trigger via API');
    const statusCode = result.success ? 200 : 409;
    res.status(statusCode).json(result);
  } catch (err) {
    console.error('[Scaling API] Scale-out error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/scaling/scale-in
 * Manually remove one worker (respects minInstances limit).
 */
router.post('/scale-in', async (req, res) => {
  try {
    const result = await scaleIn('manual trigger via API');
    const statusCode = result.success ? 200 : 409;
    res.status(statusCode).json(result);
  } catch (err) {
    console.error('[Scaling API] Scale-in error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/scaling/test-cpu
 * Body: { value: number|null }
 *
 * Set a fake CPU value for demonstration purposes.
 * Send { value: null } to return to real CPU measurement.
 *
 * This is CLEARLY labelled as a test override — it does NOT
 * change actual system CPU, only what the scaling engine sees.
 */
router.post('/test-cpu', (req, res) => {
  try {
    const { value } = req.body;
    const result = setTestCpu(value);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (err) {
    console.error('[Scaling API] Test CPU error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/scaling/stress
 * Body: { preset: 'light'|'medium'|'heavy', durationSec?: number }
 *
 * Sends REAL CPU-bound requests to the workers so the engine
 * scales on genuine load.
 */
router.post('/stress', (req, res) => {
  try {
    const { preset, durationSec } = req.body || {};
    const result = startLoadTest(preset, durationSec);
    res.status(result.success ? 200 : 409).json(result);
  } catch (err) {
    console.error('[Scaling API] Stress start error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/scaling/stress/stop
 */
router.post('/stress/stop', (req, res) => {
  try {
    const result = stopLoadTest();
    res.status(result.success ? 200 : 409).json(result);
  } catch (err) {
    console.error('[Scaling API] Stress stop error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
