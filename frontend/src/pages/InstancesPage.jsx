import { useState, useEffect, useCallback } from 'react';
import { Server, RefreshCw } from 'lucide-react';
import { fetchInstances, fetchScalingStatus } from '../services/api';

/**
 * InstancesPage — full-page view of worker instances.
 * Uses GET /api/instances + GET /api/scaling for real data.
 */
export default function InstancesPage() {
  const [instances, setInstances] = useState([]);
  const [scaling, setScaling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setError(null);
    const [instRes, scalingRes] = await Promise.all([
      fetchInstances(),
      fetchScalingStatus(),
    ]);

    if (instRes.success) {
      setInstances(instRes.data);
    } else {
      setError(instRes.error);
    }
    if (scalingRes.success) setScaling(scalingRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 4000);
    return () => clearInterval(timer);
  }, [loadData]);

  const activeCount = instances.filter(i => i.status === 'healthy' || i.status === 'running').length;

  return (
    <div className="page-view">
      <div className="page-header-row">
        <div>
          <h2><Server size={22} className="page-header-icon" /> Server Instances</h2>
          <p>Real-time view of worker processes managed by the scaling engine.</p>
        </div>
        <button className="btn-refresh" onClick={loadData} aria-label="Refresh">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="page-summary-row">
        <div className="page-summary-card">
          <div className="page-summary-value">{activeCount}</div>
          <div className="page-summary-label">Active Workers</div>
        </div>
        <div className="page-summary-card">
          <div className="page-summary-value">{scaling?.minInstances ?? '–'}</div>
          <div className="page-summary-label">Min Instances</div>
        </div>
        <div className="page-summary-card">
          <div className="page-summary-value">{scaling?.maxInstances ?? '–'}</div>
          <div className="page-summary-label">Max Instances</div>
        </div>
        <div className="page-summary-card">
          <div className="page-summary-value">{scaling?.enabled ? 'Auto' : 'Manual'}</div>
          <div className="page-summary-label">Scaling Mode</div>
        </div>
      </div>

      {/* Loading state */}
      {loading && <div className="page-loading">Loading instances…</div>}

      {/* Error state */}
      {error && <div className="page-error">⚠ {error}</div>}

      {/* Empty state */}
      {!loading && !error && instances.length === 0 && (
        <div className="page-empty">
          <Server size={32} />
          <h3>No Workers Running</h3>
          <p>Enable the scaling engine from the Dashboard to start worker processes.</p>
        </div>
      )}

      {/* Instance table */}
      {instances.length > 0 && (
        <div className="page-table-wrap">
          <table className="page-table">
            <thead>
              <tr>
                <th>Instance ID</th>
                <th>Port</th>
                <th>Status</th>
                <th>PID</th>
                <th>Started At</th>
              </tr>
            </thead>
            <tbody>
              {instances.map(inst => (
                <tr key={inst.id || inst.name}>
                  <td className="page-table-name">{inst.name || inst.instanceId || `Instance ${inst.id}`}</td>
                  <td><code>{inst.port}</code></td>
                  <td>
                    <span className={`page-status-badge ${inst.status === 'healthy' || inst.status === 'running' ? 'healthy' : 'unhealthy'}`}>
                      {inst.status}
                    </span>
                  </td>
                  <td><code>{inst.pid || '–'}</code></td>
                  <td className="page-table-time">
                    {inst.startedAt ? new Date(inst.startedAt).toLocaleString() : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
