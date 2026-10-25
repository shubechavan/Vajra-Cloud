import { GitBranch, ArrowDown } from 'lucide-react';

/**
 * Load Balancing card — now receives instances and total RPM from API.
 * Distributes traffic roughly evenly across instances.
 */
export default function LoadBalancingCard({ instances = [], totalRpm = 1240, isConnected = false }) {
  const list = instances.length > 0 ? instances : [
    { id: 1, name: 'Instance 1' },
    { id: 2, name: 'Instance 2' },
  ];

  // Distribute RPM across instances (roughly even with small variation)
  const perInstance = list.map((inst, i) => {
    const base = Math.floor(totalRpm / list.length);
    const offset = i === 0 ? Math.floor(totalRpm % list.length) : 0;
    return { ...inst, distributed: base + offset };
  });

  const source = isConnected ? 'Backend' : 'Offline';

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <GitBranch size={18} className="card-title-icon" aria-hidden="true" />
          Load Balancing
        </h3>
        <span className="card-badge demo">{source}</span>
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
          {perInstance.map((inst) => (
            <div className="lb-target" key={inst.id}>
              <div className="lb-target-name">{inst.name}</div>
              <div className="lb-target-count">{inst.distributed}</div>
              <div className="lb-target-label">requests</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
