// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Test Load Generator (Stage 4)
//
// Sends configurable HTTP requests to the workers (via the backend
// or directly) to help demonstrate auto-scaling behavior.
//
// Usage:
//   node test-load.js                     # 50 requests, 10 concurrent
//   node test-load.js --count 200         # 200 requests
//   node test-load.js --concurrency 20    # 20 concurrent
//   node test-load.js --target 8080       # send through NGINX
//   node test-load.js --duration 30       # run for 30 seconds
//
// This is a LOCAL testing tool — it does NOT expose any endpoint.
// ═══════════════════════════════════════════════════════════════

const http = require('http');

// ── Parse command-line arguments ──

function getArg(name, defaultVal) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= process.argv.length) return defaultVal;
  return process.argv[idx + 1];
}

const TARGET_PORT  = parseInt(getArg('target', '3001'));
const COUNT        = parseInt(getArg('count', '50'));
const CONCURRENCY  = Math.min(parseInt(getArg('concurrency', '10')), 50); // cap at 50
const DURATION     = parseInt(getArg('duration', '0')); // 0 = use count mode
const TARGET_HOST  = getArg('host', '127.0.0.1');

console.log('');
console.log('  ╔══════════════════════════════════════════╗');
console.log('  ║     Vajra Cloud — Test Load Generator    ║');
console.log('  ╚══════════════════════════════════════════╝');
console.log('');
console.log(`  Target:      http://${TARGET_HOST}:${TARGET_PORT}/`);
console.log(`  Mode:        ${DURATION > 0 ? `duration (${DURATION}s)` : `count (${COUNT} requests)`}`);
console.log(`  Concurrency: ${CONCURRENCY}`);
console.log('');

// ── Request sender ──

let sent = 0;
let completed = 0;
let errors = 0;
let running = 0;
const startTime = Date.now();

function sendRequest() {
  return new Promise((resolve) => {
    const req = http.get(
      `http://${TARGET_HOST}:${TARGET_PORT}/`,
      { timeout: 5000 },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          completed++;
          resolve(true);
        });
      }
    );

    req.on('error', (err) => {
      errors++;
      completed++;
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      errors++;
      completed++;
      resolve(false);
    });

    sent++;
  });
}

// ── Run in count mode ──

async function runCountMode() {
  const total = COUNT;
  let launched = 0;

  async function worker() {
    while (launched < total) {
      launched++;
      await sendRequest();
    }
  }

  // Launch concurrent workers
  const promises = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    promises.push(worker());
  }

  await Promise.all(promises);
  printSummary();
}

// ── Run in duration mode ──

async function runDurationMode() {
  const endTime = Date.now() + (DURATION * 1000);
  let shouldStop = false;

  // Progress ticker
  const ticker = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = DURATION - elapsed;
    process.stdout.write(`\r  Progress: ${completed} completed, ${errors} errors, ${remaining}s remaining   `);
  }, 1000);

  async function worker() {
    while (!shouldStop && Date.now() < endTime) {
      await sendRequest();
    }
  }

  const promises = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    promises.push(worker());
  }

  // Wait for duration to expire
  await new Promise(resolve => setTimeout(resolve, DURATION * 1000));
  shouldStop = true;

  await Promise.all(promises);
  clearInterval(ticker);
  console.log('');
  printSummary();
}

function printSummary() {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const rps = (completed / parseFloat(elapsed)).toFixed(1);

  console.log('');
  console.log('  ── Results ──');
  console.log(`  Total sent:     ${sent}`);
  console.log(`  Completed:      ${completed}`);
  console.log(`  Errors:         ${errors}`);
  console.log(`  Duration:       ${elapsed}s`);
  console.log(`  Requests/sec:   ${rps}`);
  console.log('');
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n  Interrupted by user.');
  printSummary();
  process.exit(0);
});

// ── Main ──
if (DURATION > 0) {
  runDurationMode();
} else {
  runCountMode();
}
