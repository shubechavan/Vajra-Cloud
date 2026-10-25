// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Frontend API Service
// Centralised helper for all backend API calls.
// Base URL comes from VITE_API_BASE_URL environment variable.
// ═══════════════════════════════════════════════════════════════

// Same-origin by default: the backend serves the dashboard in production,
// and Vite proxies /api to the backend in development
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Generic fetch wrapper with error handling.
 * Returns { success, data, error } shape.
 */
async function request(endpoint, options = {}) {
  try {
    const url = `${BASE_URL}${endpoint}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    const json = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: json.error || json.errors?.join(', ') || `HTTP ${res.status}`,
        errors: json.errors || null,
      };
    }

    return json; // { success: true, data: ... }
  } catch (err) {
    // Network error — backend is probably down
    return {
      success: false,
      error: 'Cannot reach the backend server. Is it running on port 4000?',
      isNetworkError: true,
    };
  }
}

// ── Health ──

export function fetchHealth() {
  return request('/health');
}

// ── Metrics ──

export function fetchMetrics() {
  return request('/metrics');
}

export function fetchTrafficData() {
  return request('/metrics/traffic');
}

// ── Instances ──

export function fetchInstances() {
  return request('/instances');
}

// ── Events ──

export function fetchEvents(limit = 20) {
  return request(`/events?limit=${limit}`);
}

export function postEvent(eventType, message) {
  return request('/events', {
    method: 'POST',
    body: JSON.stringify({ eventType, message }),
  });
}

// ── Settings ──

export function fetchSettings() {
  return request('/settings');
}

export function updateSettings(settings) {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// ── Scaling Engine ──

export function fetchScalingStatus() {
  return request('/scaling');
}

export function enableScaling() {
  return request('/scaling/enable', { method: 'POST' });
}

export function disableScaling() {
  return request('/scaling/disable', { method: 'POST' });
}

export function triggerScaleOut() {
  return request('/scaling/scale-out', { method: 'POST' });
}

export function triggerScaleIn() {
  return request('/scaling/scale-in', { method: 'POST' });
}

export function setTestCpu(value) {
  return request('/scaling/test-cpu', {
    method: 'POST',
    body: JSON.stringify({ value }),
  });
}

export function startStressTest(preset, durationSec = 120) {
  return request('/scaling/stress', {
    method: 'POST',
    body: JSON.stringify({ preset, durationSec }),
  });
}

export function stopStressTest() {
  return request('/scaling/stress/stop', { method: 'POST' });
}
