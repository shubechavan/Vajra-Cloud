// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Metrics Service (Updated for Stage 4)
//
// Returns REAL data only:
//   • CPU utilisation: average worker CPU (or host / test override)
//   • RPM + latency measured by the traffic monitor
//   • Active worker count from the actual process registry
//   • Settings from SQLite
// ═══════════════════════════════════════════════════════════════

import db from '../database/database.js';
import { getEngineStatus, getActiveWorkerCount } from '../services/scalingEngine.js';
import { getCurrentTraffic, getTrafficHistory } from '../services/trafficMonitor.js';
import { getLoadStatus } from '../services/loadGenerator.js';

/**
 * Build the metrics payload.
 * Every number here is measured — see trafficMonitor.js.
 */
export function getMetrics() {
  const settings = db.get('SELECT * FROM settings WHERE id = 1');
  const engineStatus = getEngineStatus();
  const activeInstances = getActiveWorkerCount();
  const traffic = getCurrentTraffic();

  // Determine the data source label
  let metricsSource = 'live';
  if (engineStatus.testMode) metricsSource = 'test-override';
  if (!engineStatus.enabled && activeInstances === 0) metricsSource = 'idle';

  return {
    activeInstances,
    minInstances: settings.min_instances,
    maxInstances: settings.max_instances,
    cpuUtilization: engineStatus.cpuUtilization,
    cpuSource: engineStatus.cpuSource,
    memoryPercent: traffic.memoryPercent,
    requestsPerMinute: traffic.rpm,
    avgResponseTime: traffic.latencyMs,
    metricsSource,
    scalingEnabled: engineStatus.enabled,
    loadTestRunning: getLoadStatus().running,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Rolling traffic history (one point per monitor tick).
 */
export function getTrafficData() {
  return getTrafficHistory();
}
