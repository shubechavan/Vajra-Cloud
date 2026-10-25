// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Event Routes
// GET  /api/events — list recent events from SQLite
// POST /api/events — record a new event
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import db from '../database/database.js';

const router = Router();

// Allowed event types for validation
const VALID_EVENT_TYPES = [
  'info',
  'warning',
  'error',
  'scale_out',
  'scale_in',
  'health_check',
  'config_update',
  'startup',
  'worker_crash',
  'engine_start',
  'engine_stop',
];

/**
 * GET /api/events?limit=20
 * Returns recent events, newest first.
 */
router.get('/', (req, res) => {
  try {
    // Parse limit from query, default 20, max 100
    let limit = parseInt(req.query.limit) || 20;
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;

    const events = db.all(
      'SELECT * FROM events ORDER BY created_at DESC, id DESC LIMIT ?',
      [limit]
    );

    res.json({
      success: true,
      data: events,
      meta: { count: events.length, limit },
    });
  } catch (err) {
    console.error('[Events] GET error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve events' });
  }
});

/**
 * POST /api/events
 * Body: { eventType: string, message: string }
 * Records a validated event in the database.
 */
router.post('/', (req, res) => {
  try {
    const { eventType, message } = req.body;

    // ── Validation ──
    if (!eventType || typeof eventType !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'eventType is required and must be a string',
      });
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: `eventType must be one of: ${VALID_EVENT_TYPES.join(', ')}`,
      });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'message is required and must be a string',
      });
    }

    if (message.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'message must be 500 characters or fewer',
      });
    }

    // ── Insert ──
    const result = db.run(
      'INSERT INTO events (event_type, message) VALUES (?, ?)',
      [eventType, message.trim()]
    );

    const newEvent = db.get('SELECT * FROM events WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({ success: true, data: newEvent });
  } catch (err) {
    console.error('[Events] POST error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to record event' });
  }
});

export default router;
