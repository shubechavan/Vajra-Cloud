// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Instance Routes (Updated for Stage 4)
// GET /api/instances — returns REAL worker data from scaling engine
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import { getWorkerList, getActiveWorkerCount } from '../services/scalingEngine.js';

const router = Router();

/**
 * GET /api/instances
 * Returns the actual list of managed worker processes.
 * In Stage 4, these are real processes — not demo data.
 */
router.get('/', (req, res) => {
  try {
    const workers = getWorkerList();
    const activeCount = getActiveWorkerCount();

    // Format for frontend compatibility (same shape as Stage 2)
    const instances = workers.map(w => ({
      id: w.port - 3000,                       // e.g. port 3001 → id 1
      name: w.instanceId,                      // e.g. "worker-3001"
      port: w.port,
      status: w.status === 'running' ? 'healthy' : w.status,
      pid: w.pid,
      requestCount: w.requestCount || 0,
      rpm: w.rpm || 0,
      cpuPercent: w.cpuPercent,
      avgLatencyMs: w.avgLatencyMs,
      memoryMb: w.memoryMb,
      startedAt: w.startedAt,
    }));

    res.json({
      success: true,
      data: instances,
      meta: {
        source: activeCount > 0 ? 'scaling-engine' : 'none',
        activeCount,
        totalTracked: workers.length,
      },
    });
  } catch (err) {
    console.error('[Instances] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve instances' });
  }
});

export default router;
