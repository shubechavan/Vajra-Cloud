import { Network } from 'lucide-react';

/**
 * Live topology: Client → Load Balancer → Workers.
 * Link thickness and animation speed follow each worker's REAL
 * requests/min; worker colour follows its CPU usage.
 */

const W = 420;
const H = 300;
const CLIENT = { x: 46, y: H / 2 };
const LB = { x: 180, y: H / 2 };
const WORKER_X = 316;

function cpuColor(cpu) {
  if (cpu === null || cpu === undefined) return 'var(--text-muted)';
  if (cpu >= 70) return 'var(--accent-red)';
  if (cpu >= 30) return 'var(--accent-orange)';
  return 'var(--accent-green)';
}

export default function TopologyCard({ instances = [], totalRpm = 0, nginx = null, stressRunning = false }) {
  const workers = instances.filter(i => i.status === 'healthy');
  const maxRpm = Math.max(1, ...workers.map(w => w.rpm || 0));
  const viaNginx = nginx?.reachable && nginx?.configDir;

  // Spread workers evenly down the right-hand column
  const gap = workers.length > 1 ? Math.min(56, (H - 60) / (workers.length - 1)) : 0;
  const top = H / 2 - (gap * (workers.length - 1)) / 2;
  const nodes = workers.map((w, i) => ({ ...w, x: WORKER_X, y: top + i * gap }));

  return (
    <div className="card topology-card">
      <div className="card-header">
        <h3 className="card-title">
          <Network size={18} className="card-title-icon" aria-hidden="true" />
          Live Topology
        </h3>
        <span className={`card-badge ${stressRunning ? 'stress' : 'live'}`}>
          {stressRunning ? 'UNDER LOAD' : 'LIVE'}
        </span>
      </div>

      <svg
        className="topology-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Traffic flows from clients through the load balancer to ${workers.length} workers`}
      >
        {/* Client → LB */}
        <line
          x1={CLIENT.x} y1={CLIENT.y} x2={LB.x} y2={LB.y}
          className={`topo-link${totalRpm > 0 ? ' flowing' : ''}`}
          strokeWidth={totalRpm > 0 ? 4 : 1.5}
        />

        {/* LB → workers */}
        {nodes.map((n) => {
          const share = (n.rpm || 0) / maxRpm;
          const active = (n.rpm || 0) > 0;
          return (
            <line
              key={`link-${n.port}`}
              x1={LB.x} y1={LB.y} x2={n.x - 34} y2={n.y}
              className={`topo-link${active ? ' flowing' : ''}`}
              strokeWidth={active ? 1.5 + share * 3.5 : 1}
            />
          );
        })}

        {/* Client node */}
        <g>
          <circle cx={CLIENT.x} cy={CLIENT.y} r="34" className="topo-node client" />
          <text x={CLIENT.x} y={CLIENT.y - 2} className="topo-label strong">Clients</text>
          <text x={CLIENT.x} y={CLIENT.y + 11} className="topo-label">{totalRpm.toLocaleString()} rpm</text>
        </g>

        {/* Load balancer node */}
        <g>
          <rect x={LB.x - 46} y={LB.y - 26} width="92" height="52" rx="10" className="topo-node lb" />
          <text x={LB.x} y={LB.y - 4} className="topo-label strong light">
            {viaNginx ? 'NGINX' : 'Round-Robin'}
          </text>
          <text x={LB.x} y={LB.y + 11} className="topo-label light">
            {viaNginx ? `:${nginx.port}` : 'load balancer'}
          </text>
        </g>

        {/* Worker nodes */}
        {nodes.map((n) => (
          <g key={n.port} className="topo-worker">
            <rect
              x={n.x - 34} y={n.y - 18} width="132" height="36" rx="8"
              className="topo-node worker"
              style={{ stroke: cpuColor(n.cpuPercent) }}
            />
            <circle cx={n.x - 22} cy={n.y} r="5" style={{ fill: cpuColor(n.cpuPercent) }} />
            <text x={n.x - 12} y={n.y - 3} className="topo-label strong left">:{n.port}</text>
            <text x={n.x - 12} y={n.y + 10} className="topo-label left">
              {n.cpuPercent ?? '—'}% · {(n.rpm || 0).toLocaleString()} rpm
            </text>
          </g>
        ))}

        {nodes.length === 0 && (
          <text x={WORKER_X + 14} y={H / 2} className="topo-label">No workers running</text>
        )}
      </svg>

      <div className="topology-legend">
        <span><i style={{ background: 'var(--accent-green)' }} /> CPU &lt; 30%</span>
        <span><i style={{ background: 'var(--accent-orange)' }} /> 30–70%</span>
        <span><i style={{ background: 'var(--accent-red)' }} /> ≥ 70%</span>
        <span className="topology-legend-note">line width = traffic share</span>
      </div>
    </div>
  );
}
