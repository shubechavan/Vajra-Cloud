import { ArrowUpRight } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function TrafficChart({ data, cpuPercent = 42 }) {
  const memPercent = Math.min(99, cpuPercent + Math.floor(Math.random() * 25));
  const netPercent = Math.max(5, cpuPercent - Math.floor(Math.random() * 20));

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">Traffic Overview</div>
          <div className="chart-big-label">Requests per minute (from backend)</div>
        </div>
        <button
          className="chart-card-action"
          aria-label="Expand chart"
          title="Expand chart"
        >
          <ArrowUpRight size={16} />
        </button>
      </div>

      <div className="traffic-chart-wrap">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e8c840" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#e8c840" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#8a8a8a' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#8a8a8a' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#2c2c2c',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
              }}
              labelStyle={{ color: '#8a8a8a', fontSize: 10 }}
            />
            <Area
              type="monotone"
              dataKey="rpm"
              stroke="#e8c840"
              strokeWidth={2}
              fill="url(#trafficGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#e8c840' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Mini progress bars */}
      <div className="progress-bars">
        <div className="progress-bar-col">
          <div className="progress-bar-value">{cpuPercent}%</div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill yellow" style={{ width: `${cpuPercent}%` }} />
          </div>
          <div className="progress-bar-label">CPU</div>
        </div>
        <div className="progress-bar-col">
          <div className="progress-bar-value">{memPercent}%</div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill green" style={{ width: `${memPercent}%` }} />
          </div>
          <div className="progress-bar-label">Memory</div>
        </div>
        <div className="progress-bar-col">
          <div className="progress-bar-value">{netPercent}%</div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill blue" style={{ width: `${netPercent}%` }} />
          </div>
          <div className="progress-bar-label">Network</div>
        </div>
      </div>
    </div>
  );
}
