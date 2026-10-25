
/*
 * VAJRA CLOUD — Express Server (Entry Point)
 * Starts the API server on the configured port.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Database initializer
import db, { initDatabase } from './database/database.js';

// Route modules
import healthRoutes from './routes/healthRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import instanceRoutes from './routes/instanceRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import scalingRoutes from './routes/scalingRoutes.js';

// Import scaling engine so it initialises (CPU snapshot, cleanup handlers)
import scalingEngine from './services/scalingEngine.js';
import { startTrafficMonitor } from './services/trafficMonitor.js';

// Built dashboard (frontend/dist) — served by this server in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;

// Allow both common Vite development ports.
// Additional origins can be configured using CORS_ORIGIN in .env.
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
];

const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [];

const allowedOrigins = [
  ...new Set([...defaultOrigins, ...configuredOrigins]),
];

// ── Middleware ──

app.use(express.json());

// CORS applies to the API only — the dashboard's own JS/CSS must never be
// blocked (browsers send an Origin header when loading module scripts)
app.use('/api', cors((req, callback) => {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  // Allow requests without an Origin header (e.g. PowerShell/cURL),
  // configured origins, and the dashboard served by this same server.
  const sameOrigin = origin && host && new URL(origin).host === host;

  // GitHub Codespaces forwards ports through *.app.github.dev
  const codespaceDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    || (process.env.CODESPACES === 'true' ? 'app.github.dev' : null);
  const fromCodespace = origin && codespaceDomain && new URL(origin).host.endsWith(`.${codespaceDomain}`);

  if (!origin || sameOrigin || fromCodespace || allowedOrigins.includes(origin)) {
    return callback(null, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  }

  return callback(new Error(`CORS blocked origin: ${origin}`));
}));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(
      `[${req.method}] ${req.originalUrl} → ${res.statusCode} (${ms}ms)`
    );
  });

  next();
});

// ── API Routes ──

app.use('/api/health', healthRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/instances', instanceRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/scaling', scalingRoutes);

// ── Dashboard (production build) ──

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));

  // Any non-API GET returns the single-page app
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

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

  if (err.message.startsWith('CORS blocked origin:')) {
    return res.status(403).json({
      success: false,
      error: err.message,
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ── Start server after database is ready ──

async function start() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log('');
      console.log('  ╔══════════════════════════════════════════╗');
      console.log('  ║     VAJRA CLOUD BACKEND RUNNING          ║');
      console.log('  ╚══════════════════════════════════════════╝');
      console.log('');
      console.log(`  Port:    ${PORT}`);
      console.log(`  CORS:    ${allowedOrigins.join(', ')}`);
      console.log(`  Health:  http://localhost:${PORT}/api/health`);
      if (fs.existsSync(FRONTEND_DIST)) {
        console.log(`  UI:      http://localhost:${PORT}/`);
      }
      console.log('');

      startTrafficMonitor();

      // Hosted demos start with the engine on so visitors see live workers
      if (process.env.AUTO_ENABLE_SCALING === 'true') {
        scalingEngine.enableEngine();
      }

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
