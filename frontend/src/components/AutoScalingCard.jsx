import { useState } from 'react';
import { Gauge, Save, X } from 'lucide-react';
import { updateSettings } from '../services/api';

/**
 * Auto-Scaling card — shows CPU gauge + settings from backend.
 * Settings are editable and saved via PUT /api/settings.
 */
export default function AutoScalingCard({
  cpuPercent = 42,
  settings = null,
  isConnected = false,
  onSettingsUpdated,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Local form state
  const defaults = {
    minInstances: 2,
    maxInstances: 6,
    scaleOutThreshold: 70,
    scaleInThreshold: 30,
  };
  const current = settings || defaults;

  const [form, setForm] = useState({ ...current });

  // Start editing — reset form to current values
  const startEdit = () => {
    setForm({ ...current });
    setSaveMessage(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setSaveMessage(null);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: Number(value) || 0 }));
  };

  // Save to backend
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    const res = await updateSettings(form);

    if (res.success) {
      setSaveMessage({ type: 'success', text: 'Settings saved!' });
      setIsEditing(false);
      if (onSettingsUpdated) onSettingsUpdated(res.data);
    } else {
      const errText = res.errors ? res.errors.join(', ') : res.error;
      setSaveMessage({ type: 'error', text: errText });
    }

    setIsSaving(false);
  };

  // Circle math for CPU gauge
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (cpuPercent / 100) * circumference;

  const source = isConnected ? 'Backend' : 'Offline';

  // Config rows to display
  const configRows = isEditing
    ? [
        { label: 'Min Instances', field: 'minInstances', value: form.minInstances },
        { label: 'Max Instances', field: 'maxInstances', value: form.maxInstances },
        { label: 'Scale-out %', field: 'scaleOutThreshold', value: form.scaleOutThreshold },
        { label: 'Scale-in %', field: 'scaleInThreshold', value: form.scaleInThreshold },
      ]
    : [
        { label: 'Minimum Instances', value: current.minInstances },
        { label: 'Maximum Instances', value: current.maxInstances },
        { label: 'Scale-out Threshold', value: `${current.scaleOutThreshold}%` },
        { label: 'Scale-in Threshold', value: `${current.scaleInThreshold}%` },
      ];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <Gauge size={18} className="card-title-icon" aria-hidden="true" />
          Auto-Scaling
        </h3>
        <span className="card-badge demo">{source}</span>
      </div>

      {/* Circular CPU utilization gauge */}
      <div className="utilization-circle-wrap">
        <div className="utilization-circle" role="img" aria-label={`CPU utilization ${cpuPercent}%`}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle className="utilization-circle-bg" cx="50" cy="50" r={radius} />
            <circle
              className="utilization-circle-progress"
              cx="50"
              cy="50"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="utilization-circle-text">
            <span className="utilization-percent">{cpuPercent}%</span>
            <span className="utilization-label">CPU</span>
          </div>
        </div>
      </div>

      {/* Config rows — editable or display-only */}
      <div className="scaling-config">
        {configRows.map((row) => (
          <div className="scaling-row" key={row.label}>
            <span className="scaling-label">{row.label}</span>
            {isEditing ? (
              <input
                type="number"
                className="scaling-input"
                value={row.value}
                min={1}
                max={100}
                onChange={(e) => handleChange(row.field, e.target.value)}
                aria-label={row.label}
              />
            ) : (
              <span className="scaling-value">{row.value}</span>
            )}
          </div>
        ))}
      </div>

      {/* Save / Edit / Cancel controls */}
      <div className="scaling-actions">
        {isEditing ? (
          <>
            <button className="btn-save" onClick={handleSave} disabled={isSaving}>
              <Save size={14} />
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-cancel" onClick={cancelEdit}>
              <X size={14} />
              Cancel
            </button>
          </>
        ) : (
          <button
            className="btn-edit"
            onClick={startEdit}
            disabled={!isConnected}
            title={!isConnected ? 'Connect backend to edit settings' : 'Edit scaling settings'}
          >
            Edit Settings
          </button>
        )}
      </div>

      {/* Save result message */}
      {saveMessage && (
        <div className={`save-message ${saveMessage.type}`} role="alert">
          {saveMessage.text}
        </div>
      )}
    </div>
  );
}
