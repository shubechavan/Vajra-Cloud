// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Instance Routes
// GET /api/instances — list registered demo instances
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import db from '../database/database.js';

const router = Router();

/**
 * In-memory instance registry.
 * Real instance process management comes in Stage 3+.
 * For now we create entries based on the min_instances setting.
 */
function getInstances() {
  const settings = db.get('SELECT * FROM settings WHERE id = 1');
  const count = settings.min_instances;

  const instances = [];
  for (let i = 1; i <= count; i++) {
    instances.push({
      id: i,
      name: `Instance ${i}`,
      port: 5000 + i,
      status: 'healthy',
      requestCount: Math.floor(Math.random() * 800) + 200,
      createdAt: new Date().toISOString(),
    });
  }

  return instances;
}

/**
 * GET /api/instances
 * Returns the list of demo instances.
 */
router.get('/', (req, res) => {
  try {
    const instances = getInstances();
    res.json({
      success: true,
      data: instances,
      meta: { source: 'demo' },
    });
  } catch (err) {
    console.error('[Instances] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve instances' });
  }
});

export default router;
