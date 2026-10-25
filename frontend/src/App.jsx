import { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';

import Navbar from './components/Navbar';
import WelcomeSection from './components/WelcomeSection';
import MetricsRow from './components/MetricsRow';
import VideoCard from './components/VideoCard';
import TrafficChart from './components/TrafficChart';
import ActivityCard from './components/ActivityCard';
import ServerInstancesCard from './components/ServerInstancesCard';
import LoadBalancingCard from './components/LoadBalancingCard';
import AutoScalingCard from './components/AutoScalingCard';
import ScalingControlCard from './components/ScalingControlCard';
import ConnectionBanner from './components/ConnectionBanner';
import InstancesPage from './pages/InstancesPage';
import LoadBalancingPage from './pages/LoadBalancingPage';
import AutoScalingPage from './pages/AutoScalingPage';
import ActivityPage from './pages/ActivityPage';
import SettingsPage from './pages/SettingsPage';

import {
  fetchMetrics,
  fetchTrafficData,
  fetchInstances,
  fetchEvents,
  fetchSettings,
  fetchHealth,
  fetchScalingStatus,
} from './services/api';

// ── Fallback data when backend is unavailable ──
const FALLBACK_METRICS = {
  activeInstances: 0,
  cpuUtilization: 0,
  requestsPerMinute: 0,
  avgResponseTime: 0,
  metricsSource: 'offline',
};

const FALLBACK_TRAFFIC = [
  { time: '06:00', rpm: 0 }, { time: '07:00', rpm: 0 },
  { time: '08:00', rpm: 0 }, { time: '09:00', rpm: 0 },
  { time: '10:00', rpm: 0 }, { time: '11:00', rpm: 0 },
  { time: '12:00', rpm: 0 }, { time: '13:00', rpm: 0 },
  { time: '14:00', rpm: 0 },
];

/**
 * Convert raw API metrics into the card format MetricsRow expects.
 */
function formatMetrics(raw) {
  // Choose tooltip text based on source
  const src = raw.metricsSource || 'offline';
  const srcLabel =
    src === 'live'          ? '(live from scaling engine)' :
    src === 'test-override' ? '(test mode — NOT real CPU)' :
    src === 'idle'          ? '(engine idle)' :
                              '(offline fallback)';

  return [
    {
      id: 'instances',
      label: 'Active Workers',
      value: String(raw.activeInstances),
      icon: 'server',
      color: 'blue',
      trend: 0,
      tooltip: `Running worker processes ${srcLabel}`,
    },
    {
      id: 'cpu',
      label: 'CPU Utilization',
      value: `${raw.cpuUtilization}%`,
      icon: 'cpu',
      color: raw.cpuUtilization > 70 ? 'orange' : 'green',
      trend: 0,
      tooltip: `System CPU usage ${srcLabel}`,
    },
    {
      id: 'rpm',
      label: 'Requests / Min',
      value: raw.requestsPerMinute.toLocaleString(),
      icon: 'activity',
      color: 'yellow',
      trend: Math.floor(Math.random() * 12) + 1,
      tooltip: `Estimated incoming RPM ${srcLabel}`,
    },
    {
      id: 'latency',
      label: 'Avg Response Time',
      value: `${raw.avgResponseTime} ms`,
      icon: 'clock',
      color: 'orange',
      trend: Math.floor(Math.random() * 6) - 4,
      tooltip: `Mean response latency ${srcLabel}`,
    },
  ];
}

// ── Polling interval in ms ──
const POLL_INTERVAL = 3000;

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  // Data from backend
  const [rawMetrics, setRawMetrics] = useState(FALLBACK_METRICS);
  const [trafficData, setTrafficData] = useState(FALLBACK_TRAFFIC);
  const [instances, setInstances] = useState([]);
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [scaling, setScaling] = useState(null);

  // UI state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [metricsSource, setMetricsSource] = useState('offline');

  const pollRef = useRef(null);

  /**
   * Fetch all dashboard data from the backend.
   */
  const loadAll = useCallback(async () => {
    const health = await fetchHealth();
    const connected = health.success;
    setIsConnected(connected);

    if (connected) {
      const [metricsRes, trafficRes, instRes, eventsRes, settingsRes, scalingRes] =
        await Promise.all([
          fetchMetrics(),
          fetchTrafficData(),
          fetchInstances(),
          fetchEvents(),
          fetchSettings(),
          fetchScalingStatus(),
        ]);

      if (metricsRes.success) {
        setRawMetrics(metricsRes.data);
        setMetricsSource(metricsRes.data.metricsSource || 'live');
      }
      if (trafficRes.success) setTrafficData(trafficRes.data);
      if (instRes.success) setInstances(instRes.data);
      if (eventsRes.success) setEvents(eventsRes.data);
      if (settingsRes.success) setSettings(settingsRes.data);
      if (scalingRes.success) setScaling(scalingRes.data);
    } else {
      setMetricsSource('offline');
    }

    setIsLoading(false);
  }, []);

  // Initial load + polling
  useEffect(() => {
    loadAll();
    pollRef.current = setInterval(loadAll, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadAll]);

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAll();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [loadAll]);

  const metrics = formatMetrics(rawMetrics);
  const cpuValue = rawMetrics.cpuUtilization || 0;

  return (
    <div className="dashboard-shell">
      <Navbar activePage={activePage} onNavigate={setActivePage} />
      <ConnectionBanner isConnected={isConnected} metricsSource={metricsSource} />

      {activePage === 'dashboard' ? (
        <main className="main-content" role="main">
          <WelcomeSection
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            isConnected={isConnected}
            metricsSource={metricsSource}
          />
          <MetricsRow metrics={metrics} isLoading={isLoading} />

          {/* Middle grid: Video | Traffic Chart | Activity */}
          <div className="main-grid">
            <VideoCard />
            <TrafficChart data={trafficData} cpuPercent={cpuValue} />
            <ActivityCard events={events} />
          </div>

          {/* Scaling Engine Control (Stage 4) */}
          <div className="scaling-engine-row">
            <ScalingControlCard scaling={scaling} onRefresh={handleRefresh} />
          </div>

          {/* Bottom grid: Instances | Load Balancing | Auto-Scaling */}
          <div className="bottom-grid">
            <ServerInstancesCard instances={instances} isConnected={isConnected} />
            <LoadBalancingCard
              instances={instances}
              totalRpm={rawMetrics.requestsPerMinute}
              isConnected={isConnected}
            />
            <AutoScalingCard
              cpuPercent={cpuValue}
              settings={settings}
              isConnected={isConnected}
              onSettingsUpdated={(s) => setSettings(s)}
            />
          </div>
        </main>
      ) : activePage === 'instances' ? (
        <InstancesPage />
      ) : activePage === 'loadbalancing' ? (
        <LoadBalancingPage />
      ) : activePage === 'autoscaling' ? (
        <AutoScalingPage />
      ) : activePage === 'activity' ? (
        <ActivityPage />
      ) : activePage === 'settings' ? (
        <SettingsPage />
      ) : null}
    </div>
  );
}
