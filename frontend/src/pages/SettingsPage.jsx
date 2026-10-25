import { useState, useEffect, useCallback } from 'react';
import { Settings, RefreshCw, Save, X } from 'lucide-react';
import { fetchSettings, updateSettings, fetchHealth, fetchScalingStatus } from '../services/api';

/**
 * SettingsPage — read and update backend settings via /api/settings.
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [health, setHealth] = useState(null);
  const [scaling, setScaling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const loadData = useCallback(async () => {
    setError(null);
    const [sRes, hRes, scRes] = await Promise.all([
      fetchSettings(),
      fetchHealth(),
      fetchScalingStatus(),
    ]);
    if (sRes.success) {
      setSettings(sRes.data);
      if (!editing) setForm({ ...sRes.data });
    } else {
      setError(sRes.error);
    }
    if (hRes.success) setHealth(hRes.data);
    if (scRes.success) setScaling(scRes.data);
    setLoading(false);
  }, [editing]);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 6000);
    return () => clearInterval(t);
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    const res = await updateSettings({
      minInstances: Number(form.minInstances),
      maxInstances: Number(form.maxInstances),
      scaleOutThreshold: Number(form.scaleOutThreshold),
      scaleInThreshold: Number(form.scaleInThreshold),
    });
    if (res.success) {
      setSaveMsg({ type: 'success', text: 'Settings saved successfully!' });
      setSettings(res.data);
      setEditing(false);
    } else {
      setSaveMsg({
        type: 'error',
        text: res.errors ? res.errors.join(', ') : res.error || 'Save failed',
      });
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setForm({ ...settings });
    setEditing(false);
    setSaveMsg(null);
  };

  if (loading) return <div className="page-view"><div className="page-loading">Loading settings…</div></div>;

  return (
    <div className="page-view">
      <div className="page-header-row">
        <div>
          <h2><Settings size={22} className="page-header-icon" /> Settings</h2>
          <p>Configure auto-scaling thresholds and view system information.</p>
        </div>
        <button className="btn-refresh" onClick={loadData}><RefreshCw size={14} /> Refresh</button>
      </div>

      {error && <div className="page-error">⚠ {error}</div>}

      {/* System info */}
      <div className="page-card">
        <h3>System Information</h3>
        <div className="settings-info-grid">
          <div className="settings-info-item">
            <span className="settings-info-label">Backend Status</span>
            <span className={`page-status-badge ${health ? 'healthy' : 'unhealthy'}`}>
              {health ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="settings-info-item">
            <span className="settings-info-label">Backend Port</span>
            <code>4000</code>
          </div>
          <div className="settings-info-item">
            <span className="settings-info-label">Scaling Engine</span>
            <span className={`page-status-badge ${scaling?.enabled ? 'healthy' : 'unhealthy'}`}>
              {scaling?.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="settings-info-item">
            <span className="settings-info-label">NGINX</span>
            <span className={`page-status-badge ${scaling?.nginx?.available ? 'healthy' : 'unhealthy'}`}>
              {scaling?.nginx?.available ? 'Available' : 'Not Detected'}
            </span>
          </div>
          <div className="settings-info-item">
            <span className="settings-info-label">Active Workers</span>
            <span>{scaling?.activeWorkers ?? 0}</span>
          </div>
          <div className="settings-info-item">
            <span className="settings-info-label">Monitor Interval</span>
            <span>{scaling?.monitorInterval ?? 5000}ms</span>
          </div>
          <div className="settings-info-item">
            <span className="settings-info-label">Cooldown Period</span>
            <span>{scaling?.cooldownMs ?? 15000}ms</span>
          </div>
          <div className="settings-info-item">
            <span className="settings-info-label">Consecutive Hits</span>
            <span>{scaling?.consecutiveHits ?? 3}</span>
          </div>
        </div>
      </div>

      {/* Scaling Configuration */}
      <div className="page-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Scaling Configuration</h3>
          {!editing && (
            <button className="btn-edit" style={{ width: 'auto' }} onClick={() => { setForm({ ...settings }); setEditing(true); setSaveMsg(null); }}>
              Edit Settings
            </button>
          )}
        </div>

        <div className="scaling-config">
          {[
            { label: 'Minimum Instances', field: 'minInstances', suffix: '' },
            { label: 'Maximum Instances', field: 'maxInstances', suffix: '' },
            { label: 'Scale-Out Threshold', field: 'scaleOutThreshold', suffix: '%' },
            { label: 'Scale-In Threshold', field: 'scaleInThreshold', suffix: '%' },
          ].map(r => (
            <div className="scaling-row" key={r.field}>
              <span className="scaling-label">{r.label}</span>
              {editing ? (
                <input
                  type="number"
                  className="scaling-input"
                  value={form[r.field] ?? ''}
                  min={1}
                  max={r.field.includes('Threshold') ? 100 : 10}
                  onChange={e => setForm(p => ({ ...p, [r.field]: e.target.value }))}
                />
              ) : (
                <span className="scaling-value">
                  {settings?.[r.field] ?? '–'}{r.suffix}
                </span>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div className="scaling-actions">
            <button className="btn-save" onClick={handleSave} disabled={saving}>
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-cancel" onClick={handleCancel}>
              <X size={14} /> Cancel
            </button>
          </div>
        )}

        {saveMsg && (
          <div className={`save-message ${saveMsg.type}`} role="alert">
            {saveMsg.text}
          </div>
        )}

        {settings?.updatedAt && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8 }}>
            Last updated: {settings.updatedAt}
          </div>
        )}
      </div>
    </div>
  );
}
