import { useState } from 'react';
import {
  Zap,
  Power,
  Plus,
  Minus,
  Cpu,
  AlertTriangle,
} from 'lucide-react';
import {
  enableScaling,
  disableScaling,
  triggerScaleOut,
  triggerScaleIn,
  setTestCpu,
} from '../services/api';

/**
 * ScalingControlCard — the main Stage 4 UI component.
 *
 * Shows:
 *  - Engine on/off toggle
 *  - Live CPU + worker count
 *  - Manual scale out / scale in buttons
 *  - Test CPU override slider for demos
 *  - Cooldown status and thresholds
 */
export default function ScalingControlCard({ scaling, onRefresh }) {
  const [actionMsg, setActionMsg] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [testValue, setTestValue] = useState(50);
  const [testActive, setTestActive] = useState(false);

  if (!scaling) {
    return (
      <div className="card scaling-card">
        <div className="card-header">
          <h3 className="card-title">
            <Zap size={18} className="card-title-icon" />
            Scaling Engine
          </h3>
          <span className="card-badge demo">Loading…</span>
        </div>
        <div className="scaling-loading">Connecting to backend…</div>
      </div>
    );
  }

  const {
    enabled,
    activeWorkers,
    minInstances,
    maxInstances,
    cpuUtilization,
    cpuSource,
    scaleOutThreshold,
    scaleInThreshold,
    cooldownRemaining,
    consecutiveHits,
    highCpuCount,
    lowCpuCount,
    testMode,
    testCpuValue,
  } = scaling;

  // Generic action handler
  const doAction = async (fn, label) => {
    setIsBusy(true);
    setActionMsg(null);
    const res = await fn();
    setActionMsg({
      type: res.success ? 'success' : 'error',
      text: res.message || res.error || label,
    });
    setIsBusy(false);
    if (onRefresh) onRefresh();
  };

  const handleToggle = () => {
    if (enabled) {
      doAction(disableScaling, 'Disabled');
    } else {
      doAction(enableScaling, 'Enabled');
    }
  };

  const handleTestCpu = async () => {
    if (testActive) {
      // Clear override
      await doAction(() => setTestCpu(null), 'Test mode off');
      setTestActive(false);
    } else {
      await doAction(() => setTestCpu(testValue), `Test CPU set to ${testValue}%`);
      setTestActive(true);
    }
  };

  const handleTestSlider = async (e) => {
    const val = Number(e.target.value);
    setTestValue(val);
    if (testActive) {
      // Live update
      await setTestCpu(val);
      if (onRefresh) onRefresh();
    }
  };

  // CPU gauge color
  const cpuColor =
    cpuUtilization >= scaleOutThreshold ? 'var(--accent-red)' :
    cpuUtilization <= scaleInThreshold ? 'var(--accent-green)' :
    'var(--accent-yellow)';

  return (
    <div className="card scaling-card">
      <div className="card-header">
        <h3 className="card-title">
          <Zap size={18} className="card-title-icon" />
          Scaling Engine
        </h3>
        <span className={`card-badge ${enabled ? 'live' : 'demo'}`}>
          {enabled ? 'AUTO' : 'OFF'}
        </span>
      </div>

      {/* Engine toggle */}
      <div className="scaling-toggle-row">
        <span className="scaling-toggle-label">
          {enabled ? 'Auto-Scaling Active' : 'Auto-Scaling Disabled'}
        </span>
        <button
          className={`scaling-toggle-btn ${enabled ? 'on' : 'off'}`}
          onClick={handleToggle}
          disabled={isBusy}
          title={enabled ? 'Disable auto-scaling' : 'Enable auto-scaling'}
        >
          <Power size={14} />
          {enabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      {/* CPU + Worker gauges */}
      <div className="scaling-gauges">
        <div className="scaling-gauge">
          <div className="scaling-gauge-value" style={{ color: cpuColor }}>
            {cpuUtilization}%
          </div>
          <div className="scaling-gauge-label">
            CPU
            {testMode && <span className="test-badge">TEST</span>}
          </div>
          <div className="scaling-gauge-sub">
            ↑{scaleOutThreshold}% / ↓{scaleInThreshold}%
          </div>
        </div>
        <div className="scaling-gauge">
          <div className="scaling-gauge-value">{activeWorkers}</div>
          <div className="scaling-gauge-label">Workers</div>
          <div className="scaling-gauge-sub">
            {minInstances}–{maxInstances} range
          </div>
        </div>
        <div className="scaling-gauge">
          <div className="scaling-gauge-value">
            {cooldownRemaining > 0 ? `${Math.ceil(cooldownRemaining / 1000)}s` : '✓'}
          </div>
          <div className="scaling-gauge-label">Cooldown</div>
          <div className="scaling-gauge-sub">
            {highCpuCount > 0 ? `↑${highCpuCount}/${consecutiveHits}` :
             lowCpuCount > 0 ? `↓${lowCpuCount}/${consecutiveHits}` :
             'Stable'}
          </div>
        </div>
      </div>

      {/* Manual scale buttons */}
      <div className="scaling-manual-row">
        <button
          className="scaling-btn scale-out"
          onClick={() => doAction(triggerScaleOut, 'Scaled out')}
          disabled={isBusy || activeWorkers >= maxInstances}
          title="Manually add one worker"
        >
          <Plus size={14} />
          Scale Out
        </button>
        <button
          className="scaling-btn scale-in"
          onClick={() => doAction(triggerScaleIn, 'Scaled in')}
          disabled={isBusy || activeWorkers <= minInstances}
          title="Manually remove one worker"
        >
          <Minus size={14} />
          Scale In
        </button>
      </div>

      {/* Test CPU override */}
      <div className="scaling-test-section">
        <div className="scaling-test-header">
          <AlertTriangle size={12} />
          <span>Test Mode — Simulate CPU load</span>
        </div>
        <div className="scaling-test-controls">
          <input
            type="range"
            min="0"
            max="100"
            value={testActive ? (testCpuValue ?? testValue) : testValue}
            onChange={handleTestSlider}
            className="scaling-slider"
          />
          <span className="scaling-test-val">{testActive ? (testCpuValue ?? testValue) : testValue}%</span>
          <button
            className={`scaling-btn test-btn ${testActive ? 'active' : ''}`}
            onClick={handleTestCpu}
            disabled={isBusy}
          >
            <Cpu size={14} />
            {testActive ? 'Stop' : 'Apply'}
          </button>
        </div>
        {testMode && (
          <div className="scaling-test-warning">
            ⚠ CPU reading is overridden — not real system load
          </div>
        )}
      </div>

      {/* Action result message */}
      {actionMsg && (
        <div className={`save-message ${actionMsg.type}`} role="alert">
          {actionMsg.text}
        </div>
      )}
    </div>
  );
}
