import { Server } from 'lucide-react';

/**
 * Server Instances card — now receives instances from API props.
 * Falls back to default data if backend is offline.
 */
const FALLBACK = [
  { id: 1, name: 'Instance 1', port: 5001, status: 'healthy' },
  { id: 2, name: 'Instance 2', port: 5002, status: 'healthy' },
];

export default function ServerInstancesCard({ instances = [], isConnected = false }) {
  const list = instances.length > 0 ? instances : FALLBACK;
  const source = isConnected ? 'Backend' : 'Offline';

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <Server size={18} className="card-title-icon" aria-hidden="true" />
          Server Instances
        </h3>
        <span className="card-badge demo">{source}</span>
      </div>

      <div className="instance-list" role="list" aria-label="Server instances">
        {list.map((inst) => (
          <div className="instance-item" key={inst.id} role="listitem">
            <div className="instance-left">
              <span
                className={`instance-status-dot ${inst.status}`}
                aria-label={`Status: ${inst.status}`}
              />
              <span className="instance-name">{inst.name}</span>
              <span className="instance-port">:{inst.port}</span>
            </div>
            <span className={`instance-health-tag ${inst.status}`}>
              {inst.status.charAt(0).toUpperCase() + inst.status.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
