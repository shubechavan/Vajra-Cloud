// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Stress Test Load Generator (Stage 5)
//
// Generates REAL traffic against the worker pool so the scaling
// engine reacts to genuine CPU load instead of a test override.
//
// Key design choices:
//   • Open-loop: sends a FIXED rate of requests per second, so the
//     offered load stays constant while workers are added/removed.
//     More workers → lower average CPU per worker (that's the point!)
//   • Each request hits /work?ms=N, which hashes for N ms of real CPU
//   • Routes through NGINX when it is reachable and managed by us,
//     otherwise round-robins across ready workers directly
//   • Caps in-flight requests per worker — excess is counted as
//     "dropped", just like a saturated real service would shed load
// ═══════════════════════════════════════════════════════════════

import http from 'http';
import db from '../database/database.js';
import { getWorkerList } from './scalingEngine.js';
import { getNginxStatus } from './nginxManager.js';

// ── Presets: total CPU demand = rps × workMs ──
export const PRESETS = {
  light:  { label: 'Light',  rps: 15, workMs: 40 },  // ≈ 0.6 cores
  medium: { label: 'Medium', rps: 40, workMs: 40 },  // ≈ 1.6 cores
  heavy:  { label: 'Heavy',  rps: 70, workMs: 40 },  // ≈ 2.8 cores
};

const TICK_MS = 50;                 // scheduler resolution
const MAX_INFLIGHT_PER_WORKER = 12; // backpressure limit
const WINDOW_MS = 10000;            // rolling samples for live stats
const MAX_DURATION_SEC = 600;

const agent = new http.Agent({ keepAlive: true, maxSockets: 128 });

// ── State ──
let timer = null;
let stopTimer = null;
let run = null;          // active run info, or null when idle
let lastRun = null;      // summary of the previous run
let rrIndex = 0;         // round-robin cursor
let inFlight = 0;
let carry = 0;           // fractional requests carried between ticks
let samples = [];         // [{ at, latencyMs, ok }] for the last WINDOW_MS

function logEvent(type, message) {
  try {
    db.run('INSERT INTO events (event_type, message) VALUES (?, ?)', [type, message]);
  } catch (err) {
    console.error('[LoadGen] Failed to log event:', err.message);
  }
}

/**
 * Decide where the next request goes.
 * Returns { port, mode } or null when nothing can take traffic.
 */
function pickTarget(readyWorkers) {
  const nginx = getNginxStatus();
  if (nginx.reachable && nginx.configDir) {
    return { port: nginx.port, mode: 'nginx' };
  }
  if (readyWorkers.length === 0) return null;
  const w = readyWorkers[rrIndex++ % readyWorkers.length];
  return { port: w.port, mode: 'direct' };
}

function sendOne(port, workMs) {
  const start = Date.now();
  inFlight++;
  run.sent++;

  const finish = (ok) => {
    inFlight--;
    if (!run) return; // test was stopped while this request was in flight
    if (ok) run.completed++; else run.errors++;
    samples.push({ at: Date.now(), latencyMs: Date.now() - start, ok });
  };

  const req = http.get(
    { host: '127.0.0.1', port, path: `/work?ms=${workMs}`, agent, timeout: 10000 },
    (res) => {
      res.resume();
      res.on('end', () => finish(res.statusCode === 200));
    }
  );
  req.on('error', () => finish(false));
  req.on('timeout', () => req.destroy());
}

function tick() {
  if (!run) return;

  const readyWorkers = getWorkerList().filter(w => w.status === 'running' && w.ready);
  const capacity = Math.max(1, readyWorkers.length) * MAX_INFLIGHT_PER_WORKER;

  carry += run.rps * (TICK_MS / 1000);
  const toSend = Math.floor(carry);
  carry -= toSend;

  for (let i = 0; i < toSend; i++) {
    const target = pickTarget(readyWorkers);
    if (!target || inFlight >= capacity) {
      run.dropped++;
      continue;
    }
    run.mode = target.mode;
    sendOne(target.port, run.workMs);
  }

  const cutoff = Date.now() - WINDOW_MS;
  while (samples.length && samples[0].at < cutoff) samples.shift();
}

/**
 * Start a stress test. Returns { success, message }.
 */
export function startLoadTest(presetName = 'heavy', durationSec = 120) {
  if (run) {
    return { success: false, message: 'A stress test is already running' };
  }

  const preset = PRESETS[presetName];
  if (!preset) {
    return { success: false, message: `Unknown preset "${presetName}" (use light, medium or heavy)` };
  }

  const duration = Math.min(Math.max(Number(durationSec) || 120, 10), MAX_DURATION_SEC);

  run = {
    preset: presetName,
    label: preset.label,
    rps: preset.rps,
    workMs: preset.workMs,
    durationSec: duration,
    startedAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + duration * 1000).toISOString(),
    mode: null,
    sent: 0,
    completed: 0,
    errors: 0,
    dropped: 0,
  };
  samples = [];
  carry = 0;

  timer = setInterval(tick, TICK_MS);
  stopTimer = setTimeout(() => stopLoadTest('completed'), duration * 1000);

  const cores = ((preset.rps * preset.workMs) / 1000).toFixed(1);
  const msg = `Stress test started: ${preset.label} — ${preset.rps} req/s × ${preset.workMs}ms CPU (≈${cores} cores) for ${duration}s`;
  console.log(`[LoadGen] ${msg}`);
  logEvent('load_test', msg);

  return { success: true, message: msg };
}

/**
 * Stop the running stress test. Returns { success, message }.
 */
export function stopLoadTest(reason = 'stopped by user') {
  if (!run) {
    return { success: false, message: 'No stress test is running' };
  }

  clearInterval(timer);
  clearTimeout(stopTimer);
  timer = null;
  stopTimer = null;

  lastRun = { ...getLoadStats(), finishedAt: new Date().toISOString(), reason };
  run = null;

  const msg = `Stress test ${reason}: ${lastRun.completed} completed, ${lastRun.errors} errors, ${lastRun.dropped} dropped`;
  console.log(`[LoadGen] ${msg}`);
  logEvent('load_test', msg);

  return { success: true, message: msg };
}

/**
 * Live stats for the current run (latency from the client's view,
 * so it includes queueing time inside overloaded workers).
 */
function getLoadStats() {
  const ok = samples.filter(s => s.ok).map(s => s.latencyMs).sort((a, b) => a - b);
  const windowSec = Math.min(WINDOW_MS, Date.now() - Date.parse(run.startedAt)) / 1000;

  return {
    ...run,
    inFlight,
    achievedRps: windowSec > 0 ? Math.round((samples.length / windowSec) * 10) / 10 : 0,
    avgLatencyMs: ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null,
    p95LatencyMs: ok.length ? ok[Math.min(ok.length - 1, Math.floor(ok.length * 0.95))] : null,
  };
}

/**
 * Status payload for the API.
 */
export function getLoadStatus() {
  return {
    running: run !== null,
    current: run ? getLoadStats() : null,
    lastRun,
    presets: PRESETS,
  };
}

process.on('exit', () => {
  clearInterval(timer);
  clearTimeout(stopTimer);
});

export default { startLoadTest, stopLoadTest, getLoadStatus, PRESETS };
