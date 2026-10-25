import {
  Server,
  Cpu,
  Activity,
  Clock,
} from 'lucide-react';

const ICONS = {
  server: Server,
  cpu: Cpu,
  activity: Activity,
  clock: Clock,
};

export default function MetricsRow({ metrics }) {
  return (
    <div className="metrics-row" role="region" aria-label="Key metrics summary">
      {metrics.map((m) => {
        const Icon = ICONS[m.icon];
        return (
          <div className="metric-card" key={m.id} title={m.tooltip}>
            <div className={`metric-icon ${m.color}`}>
              <Icon size={22} aria-hidden="true" />
            </div>
            <div className="metric-info">
              <div className="metric-label">{m.label}</div>
              <div className="metric-value">{m.value}</div>
              <div className="metric-change neutral">{m.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
