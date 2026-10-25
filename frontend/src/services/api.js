// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — Frontend API Service
// Centralised helper for all backend API calls.
// Base URL comes from VITE_API_BASE_URL environment variable.
// ═══════════════════════════════════════════════════════════════

// Default to localhost:4000 if env var is not set
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

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
