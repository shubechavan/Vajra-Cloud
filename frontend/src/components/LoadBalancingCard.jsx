import { GitBranch, ArrowDown } from 'lucide-react';

/**
 * Load Balancing card — shows the REAL requests/min each worker
 * served, as measured by the backend's traffic monitor.
 */
export default function LoadBalancingCard({ instances = [], totalRpm = 0, isConnected = false }) {
  const list = instances.filter(inst => inst.status === 'healthy');
  const source = isConnected ? 'Live' : 'Offline';

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <GitBranch size={18} className="card-title-icon" aria-hidden="true" />
          Load Balancing
        </h3>
        <span className={`card-badge ${isConnected ? 'live' : 'demo'}`}>{source}</span>
      </div>

      <div className="lb-visual">
        {/* Incoming traffic */}
        <div className="lb-source">
          <div className="lb-source-label">Incoming Traffic</div>
          <div className="lb-source-value">{totalRpm.toLocaleString()} RPM</div>
        </div>

        {/* Arrow connector */}
        <div className="lb-arrow" aria-hidden="true">
          <div className="lb-arrow-line" />
          <ArrowDown size={16} />
          <div className="lb-arrow-line" />
        </div>

        {/* Distribution targets */}
        <div className="lb-targets">
          {list.length === 0 && (
            <div className="lb-target">
              <div className="lb-target-name">No workers</div>
              <div className="lb-target-label">enable the engine</div>
            </div>
          )}
          {list.map((inst) => {
            const share = totalRpm > 0 ? Math.round(((inst.rpm || 0) / totalRpm) * 100) : 0;
            return (
              <div className="lb-target" key={inst.id}>
                <div className="lb-target-name">:{inst.port}</div>
                <div className="lb-target-count">{(inst.rpm || 0).toLocaleString()}</div>
                <div className="lb-target-label">{share}% share</div>
                <div className="lb-target-label">CPU {inst.cpuPercent ?? '—'}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
