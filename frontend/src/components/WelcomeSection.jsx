import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

export default function WelcomeSection({ onRefresh, isRefreshing, isConnected, metricsSource }) {
  return (
    <section className="welcome-section">
      <div className="welcome-top">
        <div>
          <h1 className="welcome-heading">Welcome to Vajra Cloud</h1>
          <p className="welcome-subtitle">
            Monitor your infrastructure. Balance your traffic. Scale intelligently.
          </p>

          <div className="welcome-badges">
            <span className="status-badge" title={isConnected ? 'Backend connected' : 'Backend offline'}>
              <span className={`dot ${isConnected ? 'green' : 'red'}`} aria-hidden="true" />
              {isConnected ? 'System Healthy' : 'Backend Offline'}
            </span>
            <span className="status-badge" title="Live monitoring active">
              <span className="dot yellow" aria-hidden="true" />
              Monitoring Active
            </span>
            <span className="status-badge" title="Auto-scaling enabled">
              <span className="dot blue" aria-hidden="true" />
              Auto-Scale ON
            </span>
          </div>
        </div>

        <div className="welcome-actions">
          <span className="demo-badge" aria-label="Data source indicator">
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
