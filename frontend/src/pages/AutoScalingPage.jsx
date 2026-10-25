import { useState, useEffect, useCallback } from 'react';
import {
  Gauge, Power, Plus, Minus, Cpu, RefreshCw, AlertTriangle,
} from 'lucide-react';
import {
  fetchScalingStatus,
  fetchSettings,
  fetchEvents,
  enableScaling,
  disableScaling,
  triggerScaleOut,
  triggerScaleIn,
  setTestCpu,
  updateSettings,
} from '../services/api';

/**
 * AutoScalingPage — full-page auto-scaling control panel.
 * Connects to /api/scaling, /api/settings, /api/events.
 */
export default function AutoScalingPage() {
  const [scaling, setScaling] = useState(null);
  const [settings, setSettings] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  // Test CPU slider
  const [testValue, setTestValue] = useState(50);
  const [testActive, setTestActive] = useState(false);

  // Settings form
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ minInstances: 1, maxInstances: 3, scaleOutThreshold: 70, scaleInThreshold: 25 });

  const loadData = useCallback(async () => {
    setError(null);
    const [sRes, stRes, evRes] = await Promise.all([
      fetchScalingStatus(),
      fetchSettings(),
      fetchEvents(10),
    ]);
    if (sRes.success) {
      setScaling(sRes.data);
      setTestActive(sRes.data.testMode || false);
      if (sRes.data.testCpuValue != null) setTestValue(sRes.data.testCpuValue);
    } else {
      setError(sRes.error);
    }
    if (stRes.success) {
      setSettings(stRes.data);
      if (!editing) setForm({ ...stRes.data });
    }
    if (evRes.success) setEvents(evRes.data);
    setLoading(false);
  }, [editing]);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 4000);
    return () => clearInterval(t);
  }, [loadData]);

  const doAction = async (fn, label) => {
    setBusy(true);
    setActionMsg(null);
    const res = await fn();
    setActionMsg({ type: res.success ? 'success' : 'error', text: res.message || res.error || label });
    setBusy(false);
    loadData();
  };

  const handleSaveSettings = async () => {
    setBusy(true);
    const res = await updateSettings(form);
    if (res.success) {
      setActionMsg({ type: 'success', text: 'Settings saved!' });
      setSettings(res.data);
      setEditing(false);
    } else {
      setActionMsg({ type: 'error', text: res.errors ? res.errors.join(', ') : res.error });
    }
    setBusy(false);
  };

  const handleTestCpu = async () => {
    if (testActive) {
      await doAction(() => setTestCpu(null), 'Test off');
      setTestActive(false);
    } else {
      await doAction(() => setTestCpu(testValue), 'Test on');
      setTestActive(true);
    }
  };

  const handleSlider = async (e) => {
    const v = Number(e.target.value);
    setTestValue(v);
    if (testActive) { await setTestCpu(v); loadData(); }
  };

  if (loading) return <div className="page-view"><div className="page-loading">Loading auto-scaling data…</div></div>;
  if (error) return <div className="page-view"><div className="page-error">⚠ {error}</div></div>;

  const s = scaling || {};
  const cpuColor = s.cpuUtilization >= (s.scaleOutThreshold || 70) ? 'var(--accent-red)' :
                   s.cpuUtilization <= (s.scaleInThreshold || 25) ? 'var(--accent-green)' : 'var(--accent-yellow)';

  // Filter scaling-related events
  const scalingEvents = events.filter(e =>
    ['scale_out', 'scale_in', 'info', 'error', 'config_update', 'startup'].includes(e.event_type)
  );

  return (
    <div className="page-view">
      <div className="page-header-row">
        <div>
          <h2><Gauge size={22} className="page-header-icon" /> Auto-Scaling Engine</h2>
          <p>Automatic worker scaling based on CPU thresholds with hysteresis and cooldown.</p>
        </div>
        <button className="btn-refresh" onClick={loadData}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Engine toggle */}
      <div className="page-card">
        <div className="scaling-toggle-row">
          <span className="scaling-toggle-label">
            <Power size={16} style={{ marginRight: 6 }} />
            Auto-Scaling is {s.enabled ? 'ENABLED' : 'DISABLED'}
          </span>
          <button
            className={`scaling-toggle-btn ${s.enabled ? 'on' : 'off'}`}
            onClick={() => doAction(s.enabled ? disableScaling : enableScaling, s.enabled ? 'Disabled' : 'Enabled')}
            disabled={busy}
          >
            {s.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Live gauges */}
      <div className="page-summary-row">
        <div className="page-summary-card">
          <div className="page-summary-value" style={{ color: cpuColor }}>{s.cpuUtilization ?? 0}%</div>
          <div className="page-summary-label">
            CPU {s.testMode && <span className="test-badge">TEST</span>}
          </div>
        </div>
        <div className="page-summary-card">
          <div className="page-summary-value">{s.activeWorkers ?? 0}</div>
          <div className="page-summary-label">Active Workers</div>
        </div>
        <div className="page-summary-card">
          <div className="page-summary-value">
            {s.cooldownRemaining > 0 ? `${Math.ceil(s.cooldownRemaining / 1000)}s` : '✓'}
          </div>
          <div className="page-summary-label">Cooldown</div>
        </div>
        <div className="page-summary-card">
          <div className="page-summary-value">
            {s.highCpuCount > 0 ? `↑${s.highCpuCount}/${s.consecutiveHits}` :
             s.lowCpuCount > 0 ? `↓${s.lowCpuCount}/${s.consecutiveHits}` : 'Stable'}
          </div>
          <div className="page-summary-label">Hysteresis</div>
        </div>
      </div>

      {/* Manual scale controls */}
      <div className="page-card">
        <h3>Manual Scaling</h3>
        <div className="scaling-manual-row">
          <button className="scaling-btn scale-out" onClick={() => doAction(triggerScaleOut, 'Scaled out')}
            disabled={busy || (s.activeWorkers >= s.maxInstances)}>
            <Plus size={14} /> Scale Out
          </button>
          <button className="scaling-btn scale-in" onClick={() => doAction(triggerScaleIn, 'Scaled in')}
            disabled={busy || (s.activeWorkers <= s.minInstances)}>
            <Minus size={14} /> Scale In
          </button>
        </div>
      </div>

      {/* Test CPU */}
      <div className="page-card">
        <h3><AlertTriangle size={16} style={{ marginRight: 6 }} />Test Mode — Simulate CPU Load</h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 10px' }}>
          Override the CPU reading for demonstration. This is NOT real CPU — it only affects the scaling engine's decisions.
        </p>
        <div className="scaling-test-controls">
          <input type="range" min="0" max="100" value={testActive ? (s.testCpuValue ?? testValue) : testValue}
            onChange={handleSlider} className="scaling-slider" />
          <span className="scaling-test-val">{testActive ? (s.testCpuValue ?? testValue) : testValue}%</span>
          <button className={`scaling-btn test-btn ${testActive ? 'active' : ''}`} onClick={handleTestCpu} disabled={busy}>
            <Cpu size={14} /> {testActive ? 'Stop' : 'Apply'}
          </button>
        </div>
        {s.testMode && <div className="scaling-test-warning">⚠ CPU reading is overridden — not real system load</div>}
      </div>

      {/* Settings form */}
      <div className="page-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Threshold Configuration</h3>
          {!editing && (
            <button className="btn-edit" style={{ width: 'auto' }} onClick={() => { setForm({ ...settings }); setEditing(true); }}>
              Edit
            </button>
          )}
        </div>
        <div className="scaling-config" style={{ marginTop: 10 }}>
          {[
            { label: 'Min Instances', field: 'minInstances' },
            { label: 'Max Instances', field: 'maxInstances' },
            { label: 'Scale-out Threshold (%)', field: 'scaleOutThreshold' },
            { label: 'Scale-in Threshold (%)', field: 'scaleInThreshold' },
          ].map(r => (
            <div className="scaling-row" key={r.field}>
              <span className="scaling-label">{r.label}</span>
              {editing ? (
                <input type="number" className="scaling-input" value={form[r.field] ?? ''}
                  onChange={e => setForm(p => ({ ...p, [r.field]: Number(e.target.value) || 0 }))} />
              ) : (
                <span className="scaling-value">
                  {settings?.[r.field] ?? '–'}{r.field.includes('Threshold') ? '%' : ''}
                </span>
              )}
            </div>
          ))}
        </div>
        {editing && (
          <div className="scaling-actions">
            <button className="btn-save" onClick={handleSaveSettings} disabled={busy}>Save</button>
            <button className="btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* Recent scaling events */}
      <div className="page-card">
        <h3>Recent Scaling Decisions</h3>
        {scalingEvents.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No scaling events recorded yet.</p>
        ) : (
          <div className="page-event-list">
            {scalingEvents.slice(0, 8).map(ev => (
              <div className="page-event-item" key={ev.id}>
                <span className={`page-event-dot ${ev.event_type === 'scale_out' ? 'green' : ev.event_type === 'scale_in' ? 'yellow' : ev.event_type === 'error' ? 'red' : 'blue'}`} />
                <div className="page-event-content">
                  <div className="page-event-msg">{ev.message}</div>
                  <div className="page-event-time">{ev.created_at}</div>
                </div>
                <span className="page-event-type">{ev.event_type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {actionMsg && <div className={`save-message ${actionMsg.type}`} role="alert">{actionMsg.text}</div>}
    </div>
  );
}
