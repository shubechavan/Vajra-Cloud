import { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { fetchEvents } from '../services/api';

// Map event_type → display color class
const TYPE_COLORS = {
  scale_out: 'green',
  scale_in: 'yellow',
  error: 'red',
  warning: 'orange',
  startup: 'blue',
  config_update: 'blue',
  info: 'blue',
  health_check: 'green',
  load_test: 'orange',
  worker_crash: 'red',
  engine_start: 'green',
  engine_stop: 'yellow',
};

/**
 * ActivityPage — full event log from SQLite via GET /api/events.
 */
export default function ActivityPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(50);

  const loadEvents = useCallback(async () => {
    setError(null);
    const res = await fetchEvents(limit);
    if (res.success) {
      setEvents(res.data);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    loadEvents();
    const t = setInterval(loadEvents, 5000);
    return () => clearInterval(t);
  }, [loadEvents]);

  return (
    <div className="page-view">
      <div className="page-header-row">
        <div>
          <h2><FileText size={22} className="page-header-icon" /> Activity Logs</h2>
          <p>All system events from SQLite — scaling decisions, config changes, errors, and startups.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="scaling-input"
            style={{ width: 70 }}
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button className="btn-refresh" onClick={loadEvents}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {/* Summary */}
      <div className="page-summary-row">
        <div className="page-summary-card">
          <div className="page-summary-value">{events.length}</div>
          <div className="page-summary-label">Events Loaded</div>
        </div>
        <div className="page-summary-card">
          <div className="page-summary-value">{events.filter(e => e.event_type === 'scale_out').length}</div>
          <div className="page-summary-label">Scale-Out</div>
        </div>
        <div className="page-summary-card">
          <div className="page-summary-value">{events.filter(e => e.event_type === 'scale_in').length}</div>
          <div className="page-summary-label">Scale-In</div>
        </div>
        <div className="page-summary-card">
          <div className="page-summary-value">{events.filter(e => e.event_type === 'error' || e.event_type === 'warning').length}</div>
          <div className="page-summary-label">Errors / Warnings</div>
        </div>
      </div>

      {loading && <div className="page-loading">Loading events…</div>}
      {error && <div className="page-error">⚠ {error}</div>}

      {!loading && events.length === 0 && (
        <div className="page-empty">
          <FileText size={32} />
          <h3>No Events Yet</h3>
          <p>Start the scaling engine to generate events.</p>
        </div>
      )}

      {events.length > 0 && (
        <div className="page-card">
          <div className="page-event-list">
            {events.map(ev => (
              <div className="page-event-item" key={ev.id}>
                <span className={`page-event-dot ${TYPE_COLORS[ev.event_type] || 'blue'}`} />
                <div className="page-event-content">
                  <div className="page-event-msg">{ev.message}</div>
                  <div className="page-event-time">{ev.created_at}</div>
                </div>
                <span className="page-event-type">{ev.event_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
