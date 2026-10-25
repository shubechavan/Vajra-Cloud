// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Traffic Monitor (Stage 5)
//
// Replaces the old random demo numbers with REAL measurements:
//   • Polls every worker's /stats endpoint every few seconds
//   • Computes per-worker requests/min, CPU % and latency from
//     the deltas between two polls
//   • Keeps a rolling history for the traffic chart
//
// A worker that does not answer within the timeout is treated as
// saturated (100% CPU) — a busy single-threaded Node process can't
// answer its stats request until it has worked through its queue.
// ═══════════════════════════════════════════════════════════════

import http from 'http';
import os from 'os';
import { getWorkerList, recordWorkerStats, getCurrentCpu, getActiveWorkerCount } from './scalingEngine.js';
import { getLoadStatus } from './loadGenerator.js';

const POLL_MS = parseInt(process.env.TRAFFIC_POLL_MS) || 2000;
const STATS_TIMEOUT_MS = 1500;
const HISTORY_POINTS = 90;  // 90 × 2s = 3 minutes of history

// ── State ──
const previous = new Map();  // instanceId → last successful /stats sample
let history = [];            // [{ time, rpm, cpu, workers, latencyMs }]
let current = { rpm: 0, latencyMs: null, cpu: 0, memoryPercent: 0 };
let timer = null;

function fetchStats(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/stats', timeout: STATS_TIMEOUT_MS },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Counters reset when a worker restarts — treat a drop as a fresh start.
 */
function delta(curr, prev) {
  return curr >= prev ? curr - prev : curr;
}

async function pollWorker(w) {
  const stats = await fetchStats(w.port);
  const now = Date.now();
  const prev = previous.get(w.instanceId);

  if (!stats) {
    // Unresponsive: report saturated once the worker has been seen before.
    // Keep `prev` so the next good poll covers the whole gap.
    if (prev) recordWorkerStats(w.instanceId, { cpuPercent: 100 });
    return { requests: 0, latencyMs: 0 };
  }

  previous.set(w.instanceId, { ...stats, at: now });

  if (!prev) {
    recordWorkerStats(w.instanceId, {
      requestCount: stats.requestCount,
      memoryMb: stats.memoryMb,
    });
    return { requests: 0, latencyMs: 0 };
  }

  const dtSec = (now - prev.at) / 1000;
  const requests = delta(stats.requestCount, prev.requestCount);
  const latencyMs = delta(stats.totalLatencyMs, prev.totalLatencyMs);
  const cpuMs = delta(stats.cpuMicros, prev.cpuMicros) / 1000;

  recordWorkerStats(w.instanceId, {
    requestCount: stats.requestCount,
    memoryMb: stats.memoryMb,
    rpm: Math.round((requests / dtSec) * 60),
    cpuPercent: Math.min(100, Math.round((cpuMs / (dtSec * 1000)) * 100)),
    avgLatencyMs: requests > 0 ? Math.round(latencyMs / requests) : null,
  });

  return { requests, latencyMs };
}

async function tick() {
  const running = getWorkerList().filter(w => w.status === 'running');

  // Forget workers that are gone
  const ids = new Set(running.map(w => w.instanceId));
  for (const id of previous.keys()) {
    if (!ids.has(id)) previous.delete(id);
  }

  const results = await Promise.all(running.map(pollWorker));
  const totals = results.reduce(
    (acc, r) => ({ requests: acc.requests + r.requests, latencyMs: acc.latencyMs + r.latencyMs }),
    { requests: 0, latencyMs: 0 }
  );

  // Sum per-worker RPM (each one is already normalised to its own poll gap)
  const rpm = getWorkerList()
    .filter(w => w.status === 'running')
    .reduce((sum, w) => sum + (w.rpm || 0), 0);

  // Prefer client-side latency during a stress test — it includes
  // queueing delay, which is what users actually feel
  const load = getLoadStatus();
  const latencyMs = load.running && load.current.avgLatencyMs !== null
    ? load.current.avgLatencyMs
    : totals.requests > 0 ? Math.round(totals.latencyMs / totals.requests) : null;

  const cpu = getCurrentCpu();
  const memoryPercent = Math.round((1 - os.freemem() / os.totalmem()) * 100);

  current = { rpm, latencyMs, cpu, memoryPercent };

  const t = new Date();
  history.push({
    time: t.toLocaleTimeString('en-GB', { hour12: false }),
    rpm,
    cpu,
    workers: getActiveWorkerCount(),
    latencyMs,
    loadTest: load.running,
  });
  if (history.length > HISTORY_POINTS) history = history.slice(-HISTORY_POINTS);
}

export function startTrafficMonitor() {
  if (timer) return;
  timer = setInterval(() => {
    tick().catch(err => console.error('[Traffic] Tick failed:', err.message));
  }, POLL_MS);
  console.log(`[Traffic] Monitoring worker stats every ${POLL_MS}ms`);
}

export function getCurrentTraffic() {
  return current;
}

export function getTrafficHistory() {
  return history;
}

export default { startTrafficMonitor, getCurrentTraffic, getTrafficHistory };
