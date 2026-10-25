// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Express Server (Entry Point)
// Starts the API server on the configured port.
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import database initialiser (must be awaited before routes run)
import db, { initDatabase } from './database/database.js';

// Route modules
import healthRoutes from './routes/healthRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import instanceRoutes from './routes/instanceRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';

const app = express();
const PORT = parseInt(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// ── Middleware ──

// Parse JSON request bodies
app.use(express.json());

// CORS — only allow the local frontend origin
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ── API Routes ──

app.use('/api/health', healthRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/instances', instanceRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/settings', settingsRoutes);

// ── 404 fallback ──

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ── Global error handler ──

app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ── Start server (after DB is ready) ──

async function start() {
  try {
    // Initialise SQLite (WASM) — creates tables on first run
    await initDatabase();

    app.listen(PORT, () => {
      console.log('');
      console.log('  ╔══════════════════════════════════════════╗');
      console.log('  ║     ⚡ Vajra Cloud Backend Running ⚡    ║');
      console.log('  ╚══════════════════════════════════════════╝');
      console.log('');
      console.log(`  → Port:    ${PORT}`);
      console.log(`  → CORS:    ${CORS_ORIGIN}`);
      console.log(`  → Health:  http://localhost:${PORT}/api/health`);
      console.log('');

      // Record startup event
      try {
        db.run(
          'INSERT INTO events (event_type, message) VALUES (?, ?)',
          ['startup', `Backend server started on port ${PORT}`]
        );
      } catch (e) {
        console.warn('[Server] Could not log startup event:', e.message);
      }
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();
