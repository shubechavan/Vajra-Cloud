import { useState, useEffect, useCallback } from 'react';
import { GitBranch, RefreshCw, ArrowDown, Send } from 'lucide-react';
import { fetchInstances, fetchScalingStatus } from '../services/api';

/**
 * LoadBalancingPage — shows NGINX status, upstream workers,
 * and test request routing through port 8080.
 *
 * Uses data from:
 *   GET /api/scaling  → scaling.nginx.{reachable, port, upstreamPorts}
 *   GET /api/instances → real workers from the scaling engine
 */
export default function LoadBalancingPage() {
  const [instances, setInstances] = useState([]);
  const [scaling, setScaling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Test request state
  const [testResults, setTestResults] = useState([]);
  const [testing, setTesting] = useState(false);

  const loadData = useCallback(async () => {
    setError(null);
    const [instRes, scalingRes] = await Promise.all([
      fetchInstances(),
      fetchScalingStatus(),
    ]);
    if (instRes.success) setInstances(instRes.data);
    else setError(instRes.error);
    if (scalingRes.success) setScaling(scalingRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, [loadData]);

  // ── Derived values ──
  const nginx = scaling?.nginx || {};
  const nginxReachable = nginx.reachable === true;
  const nginxPort = nginx.port || 8080;
  const upstreamPorts = nginx.upstreamPorts || [];
  const activeWorkers = instances.filter(i => i.status === 'healthy' || i.status === 'running');

  /**
   * Send test requests through NGINX (port 8080) and show which
   * worker handled each request.
   */
  const runTest = async () => {
    setTesting(true);
    setTestResults([]);
    const results = [];
    const requestCount = 5;

    for (let i = 0; i < requestCount; i++) {
      try {
        const start = Date.now();
        const res = await fetch(`http://localhost:${nginxPort}/`, {
          signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        const ms = Date.now() - start;
        results.push({
          index: i + 1,
          label: `Request #${i + 1}`,
          response: `→ ${data.instanceId || 'unknown worker'} on :${data.port || '?'}`,
          respondedBy: data.instanceId,
          ms,
          ok: true,
        });
      } catch (err) {
        results.push({
          index: i + 1,
          label: `Request #${i + 1}`,
          response: err.message.includes('timeout') ? 'Timeout' : `Failed: ${err.message}`,
          ok: false,
        });
      }
      setTestResults([...results]);
      // Small delay between requests so load balancing is visible
      await new Promise(r => setTimeout(r, 200));
    }
    setTesting(false);
  };

  // Determine NGINX status label
  let nginxStatusLabel = 'Checking…';
  let nginxStatusClass = 'unhealthy';
  if (!loading && scaling) {
    if (nginxReachable) {
      nginxStatusLabel = 'Running';
      nginxStatusClass = 'healthy';
    } else if (nginx.available) {
      nginxStatusLabel = 'Installed (not responding)';
      nginxStatusClass = 'unhealthy';
    } else {
      nginxStatusLabel = 'Not Detected';
      nginxStatusClass = 'unhealthy';
    }
  }

  return (
    <div className="page-view">
      <div className="page-header-row">
        <div>
          <h2><GitBranch size={22} className="page-header-icon" /> Load Balancing</h2>
          <p>Traffic distribution across worker instances via NGINX reverse proxy.</p>
        </div>
        <button className="btn-refresh" onClick={loadData} aria-label="Refresh">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="page-summary-row">
        <div className="page-summary-card">
          <div className="page-summary-value">{upstreamPorts.length > 0 ? upstreamPorts.length : activeWorkers.length}</div>
          <div className="page-summary-label">
            {upstreamPorts.length > 0 ? 'Configured Upstreams' : 'Active Workers'}
          </div>
        </div>
        <div className="page-summary-card">
          <div className="page-summary-value">{nginxPort}</div>
          <div className="page-summary-label">NGINX Port</div>
        </div>
        <div className="page-summary-card">
          <div className={`page-summary-value ${nginxReachable ? '' : 'muted'}`}>
            {nginxStatusLabel}
          </div>
          <div className="page-summary-label">NGINX Status</div>
        </div>
      </div>

      {loading && <div className="page-loading">Loading…</div>}
      {error && <div className="page-error">⚠ {error}</div>}

      {/* NGINX upstream config — show the configured ports from nginx.conf */}
      {upstreamPorts.length > 0 && (
        <div className="page-card">
          <h3>NGINX Upstream Configuration</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            Workers configured in <code>nginx.conf</code> upstream block:
          </p>
          <div className="lb-targets" style={{ marginTop: 8 }}>
            {upstreamPorts.map(port => {
              const worker = activeWorkers.find(w => w.port === port);
              const isHealthy = worker && (worker.status === 'healthy' || worker.status === 'running');
              return (
                <div className="lb-target" key={port}>
                  <div className="lb-target-name">Worker :{port}</div>
                  <div className="lb-target-count" style={{ color: isHealthy ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    :{port}
                  </div>
                  <div className="lb-target-label">
                    <span className={`page-status-dot ${isHealthy ? 'healthy' : ''}`} />
                    {isHealthy ? 'Running' : 'Not Running'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Traffic flow visual */}
      <div className="page-card">
        <h3>Traffic Distribution</h3>
        <div className="lb-page-visual">
          <div className="lb-page-source">
            <div className="lb-source-label">Incoming Traffic</div>
            <div className="lb-source-value">
              {nginxReachable
                ? `Through NGINX :${nginxPort}`
                : upstreamPorts.length > 0
                  ? `NGINX :${nginxPort} (not responding)`
                  : 'Direct to Workers'}
            </div>
          </div>
          <div className="lb-arrow" aria-hidden="true">
            <div className="lb-arrow-line" />
            <ArrowDown size={16} />
            <div className="lb-arrow-line" />
          </div>
          <div className="lb-targets">
            {activeWorkers.length > 0 ? activeWorkers.map(w => (
              <div className="lb-target" key={w.id || w.port}>
                <div className="lb-target-name">{w.name || `Worker :${w.port}`}</div>
                <div className="lb-target-count">:{w.port}</div>
                <div className="lb-target-label">
                  <span className={`page-status-dot ${w.status === 'healthy' || w.status === 'running' ? 'healthy' : ''}`} />
                  {w.status}
                </div>
              </div>
            )) : (
              <div className="lb-target" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No running workers
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Test requests through NGINX */}
      <div className="page-card">
        <h3>
          <Send size={16} style={{ marginRight: 6 }} />
          Test Request Routing
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          {nginxReachable
            ? `Sends requests through NGINX on port ${nginxPort} to verify round-robin load balancing.`
            : `NGINX is not responding on port ${nginxPort}. Start NGINX to test load balanced routing.`}
        </p>
        <button
          className="scaling-btn scale-out"
          onClick={runTest}
          disabled={testing || !nginxReachable}
          style={{ width: 'auto', maxWidth: 220 }}
        >
          {testing ? 'Sending…' : `Test via :${nginxPort}`}
        </button>

        {testResults.length > 0 && (
          <div className="test-results-list">
            {testResults.map((r, i) => (
              <div className={`test-result-item ${r.ok ? 'ok' : 'fail'}`} key={i}>
                <span className="test-result-label">{r.label}</span>
                <span className="test-result-response">
                  {r.ok ? `${r.response} (${r.ms}ms)` : r.response}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debug info */}
      {nginx.executable && (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 8, padding: '0 4px' }}>
          NGINX exe: {nginx.executable} | Last check: {nginx.lastHealthCheck || 'pending'}
        </div>
      )}
    </div>
  );
}
