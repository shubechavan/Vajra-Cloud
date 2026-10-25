import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

export default function WelcomeSection({
  onRefresh,
  isRefreshing,
  isConnected,
  metricsSource,
  scalingEnabled = false,
  stressRunning = false,
}) {
  return (
    <section className="welcome-section">
      <div className="welcome-top">
        <div>
          <h1 className="welcome-heading">Overview</h1>
          <p className="welcome-subtitle">
            Monitor your infrastructure, balance traffic, and scale automatically.
          </p>

          <div className="welcome-badges">
            <span className="status-badge" title={isConnected ? 'Backend connected' : 'Backend offline'}>
              <span className={`dot ${isConnected ? 'green' : 'red'}`} aria-hidden="true" />
              {isConnected ? 'System Healthy' : 'Backend Offline'}
            </span>
            <span className="status-badge" title="Stress test status">
              <span className={`dot ${stressRunning ? 'red' : 'yellow'}`} aria-hidden="true" />
              {stressRunning ? 'Stress Test Running' : 'Monitoring Active'}
            </span>
            <span className="status-badge" title="Auto-scaling engine status">
              <span className={`dot ${scalingEnabled ? 'blue' : 'red'}`} aria-hidden="true" />
              {scalingEnabled ? 'Auto-Scale ON' : 'Auto-Scale OFF'}
            </span>
          </div>
        </div>

        <div className="welcome-actions">
          <span className={`demo-badge${metricsSource === 'offline' ? ' offline' : ''}`} aria-label="Data source indicator">
            {metricsSource === 'demo' ? 'DEMO DATA' : metricsSource === 'offline' ? 'OFFLINE' : 'LIVE'}
          </span>
          <button
            className={`btn-refresh${isRefreshing ? ' spinning' : ''}`}
            onClick={onRefresh}
            aria-label="Refresh metrics"
            title="Refresh metrics from backend"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>
    </section>
  );
}
