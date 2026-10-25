// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Health Routes
// GET /api/health — backend status and uptime
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';

const router = Router();

// Server start time (set once when this module loads)
const startedAt = Date.now();

/**
 * GET /api/health
 * Returns backend status and uptime in seconds.
 */
router.get('/', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

  res.json({
    success: true,
    data: {
      status: 'online',
      uptimeSeconds,
      startedAt: new Date(startedAt).toISOString(),
    },
  });
});

export default router;
