// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — NGINX Manager (Stage 4 — Fixed)
//
// Detects NGINX through three methods:
//   1. Environment variable NGINX_PATH
//   2. Common filesystem paths + `where nginx`
//   3. Runtime health check on port 8080 (most reliable)
//   4. Detecting running nginx.exe processes (Windows)
//
// The health check is the primary way the frontend determines
// NGINX status — even if the exe path is unknown, a successful
// HTTP request to port 8080 proves NGINX is reachable.
// ═══════════════════════════════════════════════════════════════

import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

// ── Configuration ──
const NGINX_PORT = parseInt(process.env.NGINX_PORT) || 8080;

// Paths to search for the NGINX executable (user can override via env)
const NGINX_SEARCH_PATHS = [
  process.env.NGINX_PATH,
  'C:\\nginx\\nginx.exe',
  'C:\\tools\\nginx\\nginx.exe',
  'C:\\Program Files\\nginx\\nginx.exe',
  'C:\\nginx-1.27.4\\nginx.exe',
  'C:\\nginx-1.30.6\\nginx.exe',
].filter(Boolean);

// ── State ──
let nginxExe = null;
let nginxConfDir = null;
let nginxExeDetected = false;  // exe found on disk
let nginxReachable = false;    // port 8080 responds
let nginxUpstreamPorts = [];   // ports parsed from nginx.conf
let lastHealthCheck = null;    // ISO timestamp of last check

// ═══════════════════════════════════════════════════════════════
// DETECTION — find the NGINX executable on disk
// ═══════════════════════════════════════════════════════════════

function detectNginxExe() {
  // Method 1: Check known filesystem paths
  for (const p of NGINX_SEARCH_PATHS) {
    if (fs.existsSync(p)) {
      nginxExe = p;
      nginxExeDetected = true;
      break;
    }
  }

  // Method 2: `where nginx` on system PATH
  if (!nginxExe) {
    try {
      const result = execSync('where nginx', { encoding: 'utf-8', timeout: 3000 }).trim();
      if (result) {
        nginxExe = result.split('\n')[0].trim();
        nginxExeDetected = true;
      }
    } catch { /* not on PATH */ }
  }

  // Method 3: Find running nginx.exe process (Windows-specific)
  if (!nginxExe) {
    try {
      const wmic = execSync(
        'wmic process where "name=\'nginx.exe\'" get ExecutablePath /FORMAT:LIST',
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();
      const match = wmic.match(/ExecutablePath=(.+)/);
      if (match) {
        nginxExe = match[1].trim();
        nginxExeDetected = true;
      }
    } catch { /* wmic not available or no nginx process */ }
  }

  // Derive config directory from exe path
  if (nginxExe) {
    const confDir = path.join(path.dirname(nginxExe), 'conf');
    if (fs.existsSync(confDir)) {
      nginxConfDir = confDir;
    }
  }

  if (nginxExeDetected) {
    console.log(`[NGINX] Found executable: ${nginxExe}`);
    if (nginxConfDir) console.log(`[NGINX] Config dir: ${nginxConfDir}`);
  } else {
    console.log('[NGINX] Executable not found on disk (will check port 8080 at runtime)');
  }
}

// ═══════════════════════════════════════════════════════════════
// PARSE UPSTREAM — read configured workers from nginx.conf
// ═══════════════════════════════════════════════════════════════

function parseUpstreamPorts() {
  if (!nginxConfDir) return [];

  const confPath = path.join(nginxConfDir, 'nginx.conf');
  if (!fs.existsSync(confPath)) return [];

  try {
    const content = fs.readFileSync(confPath, 'utf-8');
    // Match lines like: server 127.0.0.1:3001 ...;
    const regex = /server\s+127\.0\.0\.1:(\d+)/g;
    const ports = [];
    let m;
    while ((m = regex.exec(content)) !== null) {
      const port = parseInt(m[1]);
      // Only include worker ports (3001–3099 range), not the listen port
      if (port >= 3001 && port <= 3099) {
        ports.push(port);
      }
    }
    nginxUpstreamPorts = [...new Set(ports)].sort((a, b) => a - b);
    if (nginxUpstreamPorts.length > 0) {
      console.log(`[NGINX] Upstream workers from config: ${nginxUpstreamPorts.join(', ')}`);
    }
    return nginxUpstreamPorts;
  } catch (err) {
    console.warn('[NGINX] Could not parse nginx.conf:', err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK — verify NGINX is actually responding on port 8080
// ═══════════════════════════════════════════════════════════════

/**
 * Send an HTTP request to localhost:NGINX_PORT and check if it responds.
 * This is the most reliable check — it proves NGINX is running and
 * routing traffic, regardless of where the exe is installed.
 *
 * @returns {Promise<boolean>} true if NGINX responds
 */
export function checkNginxHealth() {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${NGINX_PORT}/`,
      { timeout: 2000 },
      (res) => {
        // Any response means NGINX is alive (even 502 Bad Gateway)
        nginxReachable = true;
        lastHealthCheck = new Date().toISOString();
        res.resume(); // drain the response
        resolve(true);
      }
    );

    req.on('error', () => {
      nginxReachable = false;
      lastHealthCheck = new Date().toISOString();
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      nginxReachable = false;
      lastHealthCheck = new Date().toISOString();
      resolve(false);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// CONFIG UPDATE — generate and reload NGINX upstream
// ═══════════════════════════════════════════════════════════════

/**
 * Generate an NGINX upstream config block for the given ports.
 */
function generateUpstreamConfig(ports) {
  const servers = ports.map(p => `        server 127.0.0.1:${p};`).join('\n');

  return `# ═══════════════════════════════════════════════════
# Vajra Cloud — Auto-generated NGINX upstream config
# Generated at: ${new Date().toISOString()}
# Active workers: ${ports.length}
# DO NOT EDIT MANUALLY — managed by the scaling engine
# ═══════════════════════════════════════════════════

upstream vajra_workers {
${servers || '        server 127.0.0.1:3001; # fallback'}
}

server {
    listen ${NGINX_PORT};
    server_name localhost;

    location / {
        proxy_pass http://vajra_workers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

    location /health {
        proxy_pass http://vajra_workers;
        proxy_set_header Host $host;
    }
}
`;
}

/**
 * Write the upstream config file and reload NGINX.
 */
export async function updateNginxConfig(activePorts) {
  if (!nginxExeDetected || !nginxConfDir) {
    return { success: false, message: 'NGINX executable or config dir not found — skipping config update' };
  }

  if (!activePorts || activePorts.length === 0) {
    console.warn('[NGINX] No active ports provided, skipping update');
    return { success: false, message: 'No active worker ports' };
  }

  const confPath = path.join(nginxConfDir, 'vajra-upstream.conf');
  const tempPath = path.join(nginxConfDir, 'vajra-upstream.conf.tmp');
  const config = generateUpstreamConfig(activePorts);

  try {
    fs.writeFileSync(tempPath, config, 'utf-8');

    // Validate
    try {
      execSync(`"${nginxExe}" -t`, { encoding: 'utf-8', timeout: 10000 });
      console.log('[NGINX] Configuration test passed');
    } catch (testErr) {
      console.error('[NGINX] Config validation FAILED:', testErr.message);
      try { fs.unlinkSync(tempPath); } catch { /* cleanup */ }
      return { success: false, message: `NGINX config validation failed: ${testErr.message}` };
    }

    fs.renameSync(tempPath, confPath);

    // Reload
    try {
      execSync(`"${nginxExe}" -s reload`, { encoding: 'utf-8', timeout: 10000 });
      console.log(`[NGINX] Reloaded with ${activePorts.length} upstream workers`);
    } catch (reloadErr) {
      console.error('[NGINX] Reload failed:', reloadErr.message);
      return { success: false, message: `NGINX reload failed: ${reloadErr.message}` };
    }

    return {
      success: true,
      message: `NGINX updated: ${activePorts.length} workers`,
      ports: activePorts,
    };
  } catch (err) {
    console.error('[NGINX] Update error:', err.message);
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    return { success: false, message: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — used by scalingRoutes.js and frontend
// ═══════════════════════════════════════════════════════════════

/**
 * Check if NGINX is available (either exe detected OR port reachable).
 */
export function isNginxAvailable() {
  return nginxExeDetected || nginxReachable;
}

/**
 * Get full NGINX status for the API response.
 * This is what the frontend reads to display NGINX info.
 */
export function getNginxStatus() {
  return {
    available: nginxExeDetected || nginxReachable,
    reachable: nginxReachable,
    port: NGINX_PORT,
    executable: nginxExe,
    configDir: nginxConfDir,
    upstreamPorts: nginxUpstreamPorts,
    lastHealthCheck,
  };
}

// ═══════════════════════════════════════════════════════════════
// INITIALISE — detect exe + parse config + first health check
// ═══════════════════════════════════════════════════════════════

detectNginxExe();
parseUpstreamPorts();

// Run initial health check (async, updates nginxReachable)
checkNginxHealth().then(reachable => {
  if (reachable) {
    console.log(`[NGINX] Health check PASSED — responding on port ${NGINX_PORT}`);
  } else {
    console.log(`[NGINX] Health check FAILED — port ${NGINX_PORT} not responding`);
  }
});
