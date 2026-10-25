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
import ConnectionBanner from './components/ConnectionBanner';
import PlaceholderPage from './pages/PlaceholderPage';

import {
  fetchMetrics,
  fetchTrafficData,
  fetchInstances,
  fetchEvents,
  fetchSettings,
  fetchHealth,
} from './services/api';

// ── Fallback data when backend is unavailable ──
const FALLBACK_METRICS = {
  activeInstances: 2,
  cpuUtilization: 42,
  requestsPerMinute: 1240,
  avgResponseTime: 84,
  metricsSource: 'offline',
};

const FALLBACK_TRAFFIC = [
  { time: '06:00', rpm: 800 },
  { time: '07:00', rpm: 950 },
  { time: '08:00', rpm: 1100 },
  { time: '09:00', rpm: 1300 },
  { time: '10:00', rpm: 1240 },
  { time: '11:00', rpm: 1100 },
  { time: '12:00', rpm: 980 },
  { time: '13:00', rpm: 1050 },
  { time: '14:00', rpm: 1200 },
];

/**
 * Convert raw API metrics into the card format MetricsRow expects.
 */
function formatMetrics(raw) {
  return [
    {
      id: 'instances',
      label: 'Active Instances',
      value: String(raw.activeInstances),
      icon: 'server',
      color: 'blue',
      trend: 0,
      tooltip:
        raw.metricsSource === 'demo'
          ? 'Number of running server instances (demo data)'
          : 'Number of running server instances (offline fallback)',
    },
    {
      id: 'cpu',
      label: 'CPU Utilization',
      value: `${raw.cpuUtilization}%`,
      icon: 'cpu',
      color: 'green',
      trend: Math.floor(Math.random() * 10) - 3,
      tooltip:
        raw.metricsSource === 'demo'
          ? 'Simulated CPU usage (demo data from backend)'
          : 'CPU usage (offline fallback)',
    },
    {
      id: 'rpm',
      label: 'Requests / Min',
      value: raw.requestsPerMinute.toLocaleString(),
      icon: 'activity',
      color: 'yellow',
      trend: Math.floor(Math.random() * 12) + 1,
      tooltip:
        raw.metricsSource === 'demo'
          ? 'Total incoming RPM (demo data from backend)'
          : 'Requests per minute (offline fallback)',
    },
    {
      id: 'latency',
      label: 'Avg Response Time',
      value: `${raw.avgResponseTime} ms`,
      icon: 'clock',
      color: 'orange',
      trend: Math.floor(Math.random() * 6) - 4,
      tooltip:
        raw.metricsSource === 'demo'
          ? 'Mean response latency (demo data from backend)'
          : 'Response time (offline fallback)',
    },
  ];
}

// ── Polling interval in ms ──
const POLL_INTERVAL = 4000;

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  // Data from backend
  const [rawMetrics, setRawMetrics] = useState(FALLBACK_METRICS);
  const [trafficData, setTrafficData] = useState(FALLBACK_TRAFFIC);
  const [instances, setInstances] = useState([]);
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(null);

  // UI state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [metricsSource, setMetricsSource] = useState('offline');

  // Polling timer ref (for cleanup)
  const pollRef = useRef(null);

  /**
   * Fetch all dashboard data from the backend.
   */
  const loadAll = useCallback(async () => {
    // Check health first
    const health = await fetchHealth();
    const connected = health.success;
    setIsConnected(connected);

    if (connected) {
      // Fetch everything in parallel
      const [metricsRes, trafficRes, instRes, eventsRes, settingsRes] = await Promise.all([
        fetchMetrics(),
        fetchTrafficData(),
        fetchInstances(),
        fetchEvents(),
        fetchSettings(),
      ]);

      if (metricsRes.success) {
        setRawMetrics(metricsRes.data);
        setMetricsSource(metricsRes.data.metricsSource || 'demo');
      }
      if (trafficRes.success) setTrafficData(trafficRes.data);
      if (instRes.success) setInstances(instRes.data);
      if (eventsRes.success) setEvents(eventsRes.data);
      if (settingsRes.success) setSettings(settingsRes.data);
    } else {
      setMetricsSource('offline');
    }

    setIsLoading(false);
  }, []);

  // Initial load + polling
  useEffect(() => {
    loadAll();

    // Poll every POLL_INTERVAL ms
    pollRef.current = setInterval(loadAll, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadAll]);

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAll();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [loadAll]);

  // Format metrics for the MetricsRow component
  const metrics = formatMetrics(rawMetrics);
  const cpuValue = rawMetrics.cpuUtilization || 42;

  return (
    <div className="dashboard-shell">
      <Navbar activePage={activePage} onNavigate={setActivePage} />

      {/* Connection status banner */}
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
      ) : (
        <PlaceholderPage pageId={activePage} />
      )}
    </div>
  );
}
