// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Settings Routes
// GET  /api/settings — read scaling configuration
// PUT  /api/settings — update scaling configuration (validated)
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import db from '../database/database.js';

const router = Router();

/**
 * GET /api/settings
 * Returns the current auto-scaling configuration from SQLite.
 */
router.get('/', (req, res) => {
  try {
    const settings = db.get('SELECT * FROM settings WHERE id = 1');

    res.json({
      success: true,
      data: {
        minInstances: settings.min_instances,
        maxInstances: settings.max_instances,
        scaleOutThreshold: settings.scale_out_threshold,
        scaleInThreshold: settings.scale_in_threshold,
        updatedAt: settings.updated_at,
      },
    });
  } catch (err) {
    console.error('[Settings] GET error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve settings' });
  }
});

/**
 * PUT /api/settings
 * Body: { minInstances, maxInstances, scaleOutThreshold, scaleInThreshold }
 * All fields are optional — only supplied fields are updated.
 *
 * Validation rules:
 *  - minInstances >= 1
 *  - maxInstances >= minInstances
 *  - thresholds between 1 and 100
 *  - scaleInThreshold < scaleOutThreshold
 */
router.put('/', (req, res) => {
  try {
    const { minInstances, maxInstances, scaleOutThreshold, scaleInThreshold } = req.body;

    // Read current values so we can merge partial updates
    const current = db.get('SELECT * FROM settings WHERE id = 1');

    // Apply supplied values or fall back to current
    const newMin = minInstances !== undefined ? Number(minInstances) : current.min_instances;
    const newMax = maxInstances !== undefined ? Number(maxInstances) : current.max_instances;
    const newOut = scaleOutThreshold !== undefined ? Number(scaleOutThreshold) : current.scale_out_threshold;
    const newIn  = scaleInThreshold !== undefined ? Number(scaleInThreshold) : current.scale_in_threshold;

    // ── Validation ──
    const errors = [];

    if (!Number.isInteger(newMin) || newMin < 1) {
      errors.push('minInstances must be an integer >= 1');
    }
    if (!Number.isInteger(newMax) || newMax < 1) {
      errors.push('maxInstances must be an integer >= 1');
    }
    if (newMax < newMin) {
      errors.push('maxInstances must be >= minInstances');
    }
    if (!Number.isInteger(newOut) || newOut < 1 || newOut > 100) {
      errors.push('scaleOutThreshold must be an integer between 1 and 100');
    }
    if (!Number.isInteger(newIn) || newIn < 1 || newIn > 100) {
      errors.push('scaleInThreshold must be an integer between 1 and 100');
    }
    if (newIn >= newOut) {
      errors.push('scaleInThreshold must be less than scaleOutThreshold');
    }

    if (errors.length > 0) {
      // Log a validation-rejected event
      db.run(
        'INSERT INTO events (event_type, message) VALUES (?, ?)',
        ['warning', `Settings update rejected: ${errors.join('; ')}`]
      );

      return res.status(400).json({ success: false, errors });
    }

    // ── Update ──
    db.run(
      `UPDATE settings
       SET min_instances = ?, max_instances = ?, scale_out_threshold = ?, scale_in_threshold = ?, updated_at = datetime('now')
       WHERE id = 1`,
      [newMin, newMax, newOut, newIn]
    );

    // Record successful config update event
    db.run(
      'INSERT INTO events (event_type, message) VALUES (?, ?)',
      ['config_update', `Settings updated: min=${newMin} max=${newMax} scaleOut=${newOut}% scaleIn=${newIn}%`]
    );

    // Read back the updated row
    const updated = db.get('SELECT * FROM settings WHERE id = 1');

    res.json({
      success: true,
      data: {
        minInstances: updated.min_instances,
        maxInstances: updated.max_instances,
        scaleOutThreshold: updated.scale_out_threshold,
        scaleInThreshold: updated.scale_in_threshold,
        updatedAt: updated.updated_at,
      },
    });
  } catch (err) {
    console.error('[Settings] PUT error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

export default router;
