import { ArrowUpRight } from 'lucide-react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

/**
 * Find the points where the worker count changed, so the chart can
 * mark each scale-out / scale-in next to the load that caused it.
 */
function getScaleMarkers(data) {
  const markers = [];
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1].workers;
    const curr = data[i].workers;
    if (prev !== undefined && curr !== prev) {
      markers.push({ time: data[i].time, up: curr > prev, workers: curr });
    }
  }
  return markers;
}

export default function TrafficChart({
  data = [],
  cpuPercent = 0,
  memoryPercent = 0,
  workers = 0,
  maxWorkers = 0,
}) {
  const markers = getScaleMarkers(data);
  const poolPercent = maxWorkers > 0 ? Math.round((workers / maxWorkers) * 100) : 0;

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">Traffic Overview</div>
          <div className="chart-big-label">
            Live RPM <span className="chart-legend-dot rpm" /> vs CPU{' '}
            <span className="chart-legend-dot cpu" /> · last 3 min
          </div>
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
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={data} margin={{ top: 14, right: -10, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3291ff" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3291ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#737373' }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              yAxisId="rpm"
              tick={{ fontSize: 10, fill: '#737373' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="cpu"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#737373' }}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#0a0a0a',
                border: '1px solid #262626',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
              }}
              labelStyle={{ color: '#737373', fontSize: 10 }}
              formatter={(value, name) =>
                name === 'cpu' ? [`${value}%`, 'CPU'] :
                name === 'rpm' ? [value.toLocaleString(), 'Requests/min'] :
                [value, 'Workers']
              }
            />
            {markers.map((m) => (
              <ReferenceLine
                key={m.time}
                x={m.time}
                yAxisId="rpm"
                stroke={m.up ? '#45c46b' : '#f5a623'}
                strokeDasharray="4 3"
                label={{
                  value: `${m.up ? '▲' : '▼'} ${m.workers}`,
                  position: 'top',
                  fontSize: 10,
                  fill: m.up ? '#45c46b' : '#f5a623',
                }}
              />
            ))}
            <Area
              yAxisId="rpm"
              type="monotone"
              dataKey="rpm"
              stroke="#3291ff"
              strokeWidth={2}
              fill="url(#trafficGrad)"
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: '#3291ff' }}
            />
            <Line
              yAxisId="cpu"
              type="monotone"
              dataKey="cpu"
              stroke="#ededed"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
            <Line dataKey="workers" yAxisId="rpm" hide />
          </ComposedChart>
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
          <div className="progress-bar-value">{memoryPercent}%</div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill green" style={{ width: `${memoryPercent}%` }} />
          </div>
          <div className="progress-bar-label">Host Memory</div>
        </div>
        <div className="progress-bar-col">
          <div className="progress-bar-value">{workers}/{maxWorkers}</div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill blue" style={{ width: `${poolPercent}%` }} />
          </div>
          <div className="progress-bar-label">Worker Pool</div>
        </div>
      </div>
    </div>
  );
}
