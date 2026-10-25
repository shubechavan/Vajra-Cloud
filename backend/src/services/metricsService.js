// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Metrics Service
// Generates demo metrics for the dashboard.
// In Stage 2 these are labelled "demo" — real measured metrics
// will replace them when worker processes exist (Stage 3+).
// ═══════════════════════════════════════════════════════════════

import db from '../database/database.js';

/**
 * Helper: random integer in [min, max]
 */
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Build the metrics payload.
 * Pulls instance count and settings from the DB so the dashboard
 * stays consistent with user configuration.
 */
export function getMetrics() {
  // Read current settings from SQLite
  const settings = db.get('SELECT * FROM settings WHERE id = 1');

  // Count registered instances (for now use the min_instances setting)
  const activeInstances = settings.min_instances;

  // Demo CPU / RPM / latency — clearly labelled
  const cpuUtilization = rand(30, 60);
  const requestsPerMinute = rand(1000, 1500);
  const avgResponseTime = rand(70, 100);

  return {
    activeInstances,
    minInstances: settings.min_instances,
    maxInstances: settings.max_instances,
    cpuUtilization,
    requestsPerMinute,
    avgResponseTime,
    metricsSource: 'demo',
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Generate traffic chart data points (demo).
 */
export function getTrafficData() {
  const now = new Date();
  const points = [];
  for (let i = 8; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hh = t.getHours().toString().padStart(2, '0');
    const mm = t.getMinutes().toString().padStart(2, '0');
    points.push({
      time: `${hh}:${mm}`,
      rpm: rand(600, 1400),
    });
  }
  return points;
}
