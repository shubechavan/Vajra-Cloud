// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Metrics Service (Updated for Stage 4)
//
// Now returns REAL data from the scaling engine:
//   • CPU utilisation from os.cpus() (or test override)
//   • Active worker count from the actual process registry
//   • Settings from SQLite
// ═══════════════════════════════════════════════════════════════

import db from '../database/database.js';
import { getEngineStatus, getActiveWorkerCount } from '../services/scalingEngine.js';

/**
 * Helper: random integer in [min, max]
 * Still used for demo traffic data and latency estimation.
 */
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Build the metrics payload.
 * Uses real CPU + worker data from the scaling engine.
 */
export function getMetrics() {
  const settings = db.get('SELECT * FROM settings WHERE id = 1');
  const engineStatus = getEngineStatus();
  const activeInstances = getActiveWorkerCount();

  // Real CPU from the scaling engine
  const cpuUtilization = engineStatus.cpuUtilization;

  // RPM and latency are still estimated (real measurement needs Stage 5+)
  const requestsPerMinute = rand(800, 1500);
  const avgResponseTime = rand(60, 110);

  // Determine the data source label
  let metricsSource = 'live';
  if (engineStatus.testMode) metricsSource = 'test-override';
  if (!engineStatus.enabled && activeInstances === 0) metricsSource = 'idle';

  return {
    activeInstances,
    minInstances: settings.min_instances,
    maxInstances: settings.max_instances,
    cpuUtilization,
    cpuSource: engineStatus.cpuSource,
    requestsPerMinute,
    avgResponseTime,
    metricsSource,
    scalingEnabled: engineStatus.enabled,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Generate traffic chart data points.
 * RPM values are still estimated for now.
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
