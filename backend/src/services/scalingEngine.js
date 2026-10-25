// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Auto-Scaling Engine (Stage 4)
//
// Monitors CPU utilisation and automatically scales worker
// processes up or down based on configurable thresholds.
//
// Key design choices (beginner-friendly):
//   • Uses Node.js os.cpus() for real system CPU measurement
//   • Spawns workers via child_process.spawn
//   • Hysteresis: requires CONSECUTIVE readings before acting
//   • Cooldown: prevents rapid repeated scaling
//   • Reads thresholds from SQLite settings table
//   • Logs every decision to the events table
//   • Cleans up child processes on backend shutdown
// ═══════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../database/database.js';
import { updateNginxConfig } from './nginxManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the worker script (VAJRA CLOUD/workers/worker.js)
const WORKER_SCRIPT = path.join(__dirname, '..', '..', '..', 'workers', 'worker.js');

// ── Engine Configuration ──
// These can be overridden via .env or the settings API

const CONFIG = {
  monitorInterval: parseInt(process.env.SCALING_INTERVAL) || 5000,   // ms between checks
  cooldownMs:      parseInt(process.env.SCALING_COOLDOWN) || 15000,  // ms after a scaling action
  consecutiveHits: parseInt(process.env.SCALING_HITS)     || 3,      // readings needed to trigger
  basePorts:       [3001, 3002, 3003, 3004, 3005],                    // available worker ports
};

// ── Engine State ──

let engineEnabled   = false;   // Is automatic scaling on?
let monitorTimer    = null;    // setInterval handle
let lastScaleTime   = 0;       // timestamp of last scale action
let highCpuCount    = 0;       // consecutive readings ABOVE scaleOut threshold
let lowCpuCount     = 0;       // consecutive readings BELOW scaleIn threshold
let lastCpuSnapshot = null;    // previous os.cpus() snapshot for delta calc
let lastMeasuredCpu = 0;       // last computed CPU % (for API display)
let testCpuOverride = null;    // if set, use this value instead of real CPU (test mode)

// Worker registry: Map<instanceId, { process, port, instanceId, status, startedAt, requestCount }>
const workers = new Map();

// ═══════════════════════════════════════════════════════════════
// CPU MEASUREMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Capture a snapshot of all CPU core times.
 * Returns an array of { idle, total } for each core.
 */
function cpuSnapshot() {
  return os.cpus().map(core => {
    const times = core.times;
    const idle = times.idle;
    const total = times.user + times.nice + times.sys + times.irq + times.idle;
    return { idle, total };
  });
}

/**
 * Calculate overall CPU utilisation % between two snapshots.
 * Returns a number 0–100.
 */
function calculateCpu(prev, curr) {
  let totalIdle = 0;
  let totalDelta = 0;

  for (let i = 0; i < curr.length; i++) {
    const idleDelta  = curr[i].idle  - prev[i].idle;
    const totalD     = curr[i].total - prev[i].total;
    totalIdle  += idleDelta;
    totalDelta += totalD;
  }

  if (totalDelta === 0) return 0;
  return Math.round((1 - totalIdle / totalDelta) * 100);
}

/**
 * Get the current CPU utilisation %.
 * If test mode is active, returns the test override value.
 */
function getCurrentCpu() {
  if (testCpuOverride !== null) return testCpuOverride;

  const current = cpuSnapshot();
  if (lastCpuSnapshot) {
    lastMeasuredCpu = calculateCpu(lastCpuSnapshot, current);
  }
  lastCpuSnapshot = current;
  return lastMeasuredCpu;
}

// ═══════════════════════════════════════════════════════════════
// WORKER PROCESS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Find the next available port not currently in use by a worker.
 */
function getNextAvailablePort() {
  for (const port of CONFIG.basePorts) {
    const inUse = [...workers.values()].some(w => w.port === port);
    if (!inUse) return port;
  }
  return null; // all ports in use
}

/**
 * Get the number of currently running (alive) workers.
 */
export function getActiveWorkerCount() {
  let count = 0;
  for (const w of workers.values()) {
    if (w.status === 'running') count++;
  }
  return count;
}

/**
 * Start a single worker process on the given port.
 * Returns the worker entry or null on failure.
 */
function startWorker(port) {
  const instanceId = `worker-${port}`;

  // Prevent duplicates
  if (workers.has(instanceId)) {
    console.warn(`[Scaling] Worker ${instanceId} already exists, skipping`);
    return workers.get(instanceId);
  }

  console.log(`[Scaling] Starting ${instanceId} on port ${port}...`);

  try {
    const child = spawn('node', [WORKER_SCRIPT], {
      env: {
        ...process.env,
        PORT: String(port),
        INSTANCE_ID: instanceId,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    const entry = {
      process: child,
      port,
      instanceId,
      status: 'running',
      pid: child.pid,
      startedAt: new Date().toISOString(),
      requestCount: 0,
    };

    // Capture stdout
    child.stdout.on('data', (data) => {
      console.log(`[${instanceId}] ${data.toString().trim()}`);
    });

    // Capture stderr
    child.stderr.on('data', (data) => {
      console.error(`[${instanceId}] ERROR: ${data.toString().trim()}`);
    });

    // Handle worker exit
    child.on('exit', (code, signal) => {
      console.log(`[Scaling] ${instanceId} exited (code=${code}, signal=${signal})`);
      const w = workers.get(instanceId);
      if (w) {
        w.status = 'stopped';
        w.exitCode = code;
      }

      // If engine is enabled and worker crashed unexpectedly, log it
      if (engineEnabled && code !== 0 && code !== null) {
        logEvent('error', `Worker ${instanceId} crashed (exit code ${code})`);
        // Remove so it can be restarted on next cycle
        workers.delete(instanceId);
        // Update NGINX to remove dead worker
        syncNginx();
      }
    });

    child.on('error', (err) => {
      console.error(`[Scaling] Failed to start ${instanceId}:`, err.message);
      entry.status = 'error';
      logEvent('error', `Failed to start ${instanceId}: ${err.message}`);
    });

    workers.set(instanceId, entry);
    return entry;
  } catch (err) {
    console.error(`[Scaling] spawn error for ${instanceId}:`, err.message);
    logEvent('error', `Spawn failed for ${instanceId}: ${err.message}`);
    return null;
  }
}

/**
 * Stop a single worker process gracefully.
 * Sends SIGTERM, waits briefly, then SIGKILL if needed.
 */
function stopWorker(instanceId) {
  const w = workers.get(instanceId);
  if (!w || w.status !== 'running') {
    workers.delete(instanceId);
    return;
  }

  console.log(`[Scaling] Stopping ${instanceId} (port ${w.port})...`);

  try {
    // On Windows, process.kill with SIGTERM works for child processes
    w.process.kill('SIGTERM');
    w.status = 'stopping';

    // Force kill after 5 seconds if still alive
    setTimeout(() => {
      try {
        if (w.process && !w.process.killed) {
          w.process.kill('SIGKILL');
        }
      } catch { /* already dead */ }
      workers.delete(instanceId);
    }, 5000);
  } catch (err) {
    console.error(`[Scaling] Error stopping ${instanceId}:`, err.message);
    workers.delete(instanceId);
  }
}

/**
 * Stop ALL workers (used during shutdown).
 */
function stopAllWorkers() {
  console.log(`[Scaling] Stopping all ${workers.size} workers...`);
  for (const [id] of workers) {
    stopWorker(id);
  }
}

// ═══════════════════════════════════════════════════════════════
// SCALING LOGIC
// ═══════════════════════════════════════════════════════════════

/**
 * Read current settings from the database.
 */
function getSettings() {
  const row = db.get('SELECT * FROM settings WHERE id = 1');
  return {
    minInstances:      row.min_instances,
    maxInstances:      row.max_instances,
    scaleOutThreshold: row.scale_out_threshold,
    scaleInThreshold:  row.scale_in_threshold,
  };
}

/**
 * Log an event to the SQLite events table.
 * Wrapped in try/catch so logging failures never crash the engine.
 */
function logEvent(type, message) {
  try {
    db.run(
      'INSERT INTO events (event_type, message) VALUES (?, ?)',
      [type, message]
    );
  } catch (err) {
    console.error('[Scaling] Failed to log event:', err.message);
  }
}

/**
 * Sync the NGINX config with the current worker pool.
 */
async function syncNginx() {
  const activePorts = [...workers.values()]
    .filter(w => w.status === 'running')
    .map(w => w.port);

  try {
    await updateNginxConfig(activePorts);
  } catch (err) {
    console.warn('[Scaling] NGINX sync skipped:', err.message);
  }
}

/**
 * Scale OUT: Add one more worker.
 * Returns { success, message }.
 */
export async function scaleOut(reason = 'manual') {
  const settings = getSettings();
  const active = getActiveWorkerCount();

  if (active >= settings.maxInstances) {
    const msg = `Cannot scale out: already at max (${active}/${settings.maxInstances})`;
    console.log(`[Scaling] ${msg}`);
    return { success: false, message: msg };
  }

  const port = getNextAvailablePort();
  if (!port) {
    const msg = 'Cannot scale out: no available ports';
    return { success: false, message: msg };
  }

  const entry = startWorker(port);
  if (!entry) {
    return { success: false, message: 'Failed to start worker process' };
  }

  lastScaleTime = Date.now();
  highCpuCount = 0;
  lowCpuCount = 0;

  const newCount = getActiveWorkerCount();
  const msg = `Scaled out: ${active} → ${newCount} workers (reason: ${reason})`;
  console.log(`[Scaling] ${msg}`);
  logEvent('scale_out', msg);

  // Update NGINX after a brief delay for the worker to start listening
  setTimeout(() => syncNginx(), 1500);

  return { success: true, message: msg, workerCount: newCount };
}

/**
 * Scale IN: Remove one worker (the most recently added).
 * Returns { success, message }.
 */
export async function scaleIn(reason = 'manual') {
  const settings = getSettings();
  const active = getActiveWorkerCount();

  if (active <= settings.minInstances) {
    const msg = `Cannot scale in: already at min (${active}/${settings.minInstances})`;
    console.log(`[Scaling] ${msg}`);
    return { success: false, message: msg };
  }

  // Find the most recently started worker to remove
  let latestWorker = null;
  let latestTime = '';
  for (const w of workers.values()) {
    if (w.status === 'running' && w.startedAt > latestTime) {
      latestTime = w.startedAt;
      latestWorker = w;
    }
  }

  if (!latestWorker) {
    return { success: false, message: 'No running worker found to stop' };
  }

  stopWorker(latestWorker.instanceId);

  lastScaleTime = Date.now();
  highCpuCount = 0;
  lowCpuCount = 0;

  const newCount = active - 1;
  const msg = `Scaled in: ${active} → ${newCount} workers (removed ${latestWorker.instanceId}, reason: ${reason})`;
  console.log(`[Scaling] ${msg}`);
  logEvent('scale_in', msg);

  // Update NGINX after worker is removed
  setTimeout(() => syncNginx(), 1000);

  return { success: true, message: msg, workerCount: newCount };
}

/**
 * The main monitoring loop tick.
 * Called every CONFIG.monitorInterval ms when engine is enabled.
 */
function monitorTick() {
  const cpu = getCurrentCpu();
  const settings = getSettings();
  const active = getActiveWorkerCount();
  const cooldownRemaining = Math.max(0, CONFIG.cooldownMs - (Date.now() - lastScaleTime));

  // Check if we're in cooldown
  if (cooldownRemaining > 0) {
    return; // Still cooling down, skip this tick
  }

  // ── Scale OUT check ──
  if (cpu >= settings.scaleOutThreshold) {
    highCpuCount++;
    lowCpuCount = 0; // reset opposite counter
    console.log(
      `[Scaling] CPU ${cpu}% ≥ ${settings.scaleOutThreshold}% ` +
      `(${highCpuCount}/${CONFIG.consecutiveHits} consecutive)`
    );

    if (highCpuCount >= CONFIG.consecutiveHits) {
      scaleOut(`CPU ${cpu}% ≥ ${settings.scaleOutThreshold}% for ${highCpuCount} consecutive checks`);
    }
    return;
  }

  // ── Scale IN check ──
  if (cpu <= settings.scaleInThreshold) {
    lowCpuCount++;
    highCpuCount = 0;
    console.log(
      `[Scaling] CPU ${cpu}% ≤ ${settings.scaleInThreshold}% ` +
      `(${lowCpuCount}/${CONFIG.consecutiveHits} consecutive)`
    );

    if (lowCpuCount >= CONFIG.consecutiveHits) {
      scaleIn(`CPU ${cpu}% ≤ ${settings.scaleInThreshold}% for ${lowCpuCount} consecutive checks`);
    }
    return;
  }

  // CPU is between thresholds — reset both counters
  highCpuCount = 0;
  lowCpuCount = 0;
}

// ═══════════════════════════════════════════════════════════════
// ENGINE CONTROL (enable / disable / status)
// ═══════════════════════════════════════════════════════════════

/**
 * Ensure at least minInstances workers are running.
 * Called when the engine is first enabled.
 */
async function ensureMinimumWorkers() {
  const settings = getSettings();
  let active = getActiveWorkerCount();

  while (active < settings.minInstances) {
    const port = getNextAvailablePort();
    if (!port) break;
    startWorker(port);
    active++;
  }

  // Give workers time to start, then sync NGINX
  setTimeout(() => syncNginx(), 2000);
}

/**
 * Enable automatic scaling. Starts the monitoring loop.
 */
export function enableEngine() {
  if (engineEnabled) {
    return { success: false, message: 'Scaling engine is already enabled' };
  }

  engineEnabled = true;
  lastCpuSnapshot = cpuSnapshot(); // initial snapshot

  // Ensure minimum workers are running
  ensureMinimumWorkers();

  // Start the monitor loop
  monitorTimer = setInterval(monitorTick, CONFIG.monitorInterval);

  const msg = 'Auto-scaling engine enabled';
  console.log(`[Scaling] ${msg}`);
  logEvent('info', msg);

  return { success: true, message: msg };
}

/**
 * Disable automatic scaling. Stops the monitoring loop.
 * Workers keep running — they are NOT stopped when disabling.
 */
export function disableEngine() {
  if (!engineEnabled) {
    return { success: false, message: 'Scaling engine is already disabled' };
  }

  engineEnabled = false;

  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }

  highCpuCount = 0;
  lowCpuCount = 0;

  const msg = 'Auto-scaling engine disabled (workers kept running)';
  console.log(`[Scaling] ${msg}`);
  logEvent('info', msg);

  return { success: true, message: msg };
}

/**
 * Get the full engine status for the API.
 */
export function getEngineStatus() {
  const settings = getSettings();
  const activeWorkers = [...workers.values()].filter(w => w.status === 'running');

  return {
    enabled: engineEnabled,
    activeWorkers: activeWorkers.length,
    minInstances: settings.minInstances,
    maxInstances: settings.maxInstances,
    scaleOutThreshold: settings.scaleOutThreshold,
    scaleInThreshold: settings.scaleInThreshold,
    cpuUtilization: lastMeasuredCpu,
    cpuSource: testCpuOverride !== null ? 'test-override' : 'os.cpus()',
    cooldownMs: CONFIG.cooldownMs,
    monitorInterval: CONFIG.monitorInterval,
    consecutiveHits: CONFIG.consecutiveHits,
    highCpuCount,
    lowCpuCount,
    cooldownRemaining: Math.max(0, CONFIG.cooldownMs - (Date.now() - lastScaleTime)),
    lastScaleTime: lastScaleTime > 0 ? new Date(lastScaleTime).toISOString() : null,
    testMode: testCpuOverride !== null,
    testCpuValue: testCpuOverride,
  };
}

/**
 * Get the list of all tracked workers.
 */
export function getWorkerList() {
  return [...workers.values()].map(w => ({
    instanceId: w.instanceId,
    port: w.port,
    status: w.status,
    pid: w.pid,
    startedAt: w.startedAt,
    requestCount: w.requestCount,
  }));
}

/**
 * Set a test CPU override value for demonstration.
 * Pass null to return to real CPU measurement.
 */
export function setTestCpu(value) {
  if (value === null || value === undefined) {
    testCpuOverride = null;
    logEvent('info', 'Test CPU override cleared — using real CPU measurement');
    return { success: true, message: 'Test mode disabled, using real CPU' };
  }

  const num = Number(value);
  if (isNaN(num) || num < 0 || num > 100) {
    return { success: false, message: 'Test CPU must be a number 0–100' };
  }

  testCpuOverride = num;
  // Reset consecutive counters so the new value starts fresh
  highCpuCount = 0;
  lowCpuCount = 0;

  logEvent('info', `Test CPU override set to ${num}% (NOT real CPU)`);
  return { success: true, message: `Test CPU set to ${num}% — auto-scaling will react to this value` };
}

// ═══════════════════════════════════════════════════════════════
// CLEANUP — ensure child processes are killed on backend exit
// ═══════════════════════════════════════════════════════════════

function cleanup() {
  console.log('[Scaling] Backend shutting down — stopping all workers...');
  disableEngine();
  stopAllWorkers();
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

// Also handle Windows Ctrl+C
if (process.platform === 'win32') {
  process.on('SIGHUP', () => { cleanup(); process.exit(0); });
}

// ═══════════════════════════════════════════════════════════════
// INITIALISE — take first CPU snapshot so first measurement works
// ═══════════════════════════════════════════════════════════════

lastCpuSnapshot = cpuSnapshot();

export default {
  enableEngine,
  disableEngine,
  scaleOut,
  scaleIn,
  getEngineStatus,
  getWorkerList,
  setTestCpu,
  getActiveWorkerCount,
  stopAllWorkers,
};
