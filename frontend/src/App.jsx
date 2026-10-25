import { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import './theme.css';

import Navbar from './components/Navbar';
import WelcomeSection from './components/WelcomeSection';
import MetricsRow from './components/MetricsRow';
import TopologyCard from './components/TopologyCard';
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
  avgResponseTime: null,
  memoryPercent: 0,
  minInstances: 0,
  maxInstances: 0,
  metricsSource: 'offline',
};

const FALLBACK_TRAFFIC = [];

const CPU_SOURCE_SUB = {
  'fleet-avg': 'average across workers',
  'os.cpus()': 'host CPU (no worker data)',
  'test-override': 'TEST OVERRIDE — not real',
};

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
      sub: `scaling range ${raw.minInstances}–${raw.maxInstances}`,
      tooltip: `Running worker processes ${srcLabel}`,
    },
    {
      id: 'cpu',
      label: 'CPU Utilization',
      value: `${raw.cpuUtilization}%`,
      icon: 'cpu',
      color: raw.cpuUtilization > 70 ? 'orange' : 'green',
      sub: CPU_SOURCE_SUB[raw.cpuSource] || 'measured',
      tooltip: `CPU used for scaling decisions ${srcLabel}`,
    },
    {
      id: 'rpm',
      label: 'Requests / Min',
      value: raw.requestsPerMinute.toLocaleString(),
      icon: 'activity',
      color: 'yellow',
      sub: raw.loadTestRunning ? 'stress test running' : 'measured at workers',
      tooltip: `Requests served by all workers ${srcLabel}`,
    },
    {
      id: 'latency',
      label: 'Avg Response Time',
      value: raw.avgResponseTime === null ? '—' : `${raw.avgResponseTime} ms`,
      icon: 'clock',
      color: 'orange',
      sub: raw.loadTestRunning ? 'client-side, incl. queueing' : 'server processing time',
      tooltip: `Mean response latency ${srcLabel}`,
    },
  ];
}

// ── Polling interval in ms ──
const POLL_INTERVAL = 2000;

export default function App() {
  // Keep the open tab in the URL hash so refreshes and links land on it
  const [activePage, setActivePage] = useState(
    () => window.location.hash.slice(1) || 'dashboard'
  );

  useEffect(() => {
    const onHash = () => setActivePage(window.location.hash.slice(1) || 'dashboard');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((page) => {
    window.location.hash = page === 'dashboard' ? '' : page;
    setActivePage(page);
  }, []);

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
      <Navbar activePage={activePage} onNavigate={navigate} isConnected={isConnected} />
      <ConnectionBanner isConnected={isConnected} metricsSource={metricsSource} />

      {activePage === 'dashboard' ? (
        <main className="main-content" role="main">
          <WelcomeSection
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            isConnected={isConnected}
            metricsSource={metricsSource}
            scalingEnabled={scaling?.enabled}
            stressRunning={scaling?.stress?.running}
          />
          <MetricsRow metrics={metrics} isLoading={isLoading} />

          {/* Middle grid: Topology | Traffic Chart | Activity */}
          <div className="main-grid">
            <TopologyCard
              instances={instances}
              totalRpm={rawMetrics.requestsPerMinute}
              nginx={scaling?.nginx}
              stressRunning={scaling?.stress?.running}
            />
            <TrafficChart
              data={trafficData}
              cpuPercent={cpuValue}
              memoryPercent={rawMetrics.memoryPercent}
              workers={rawMetrics.activeInstances}
              maxWorkers={rawMetrics.maxInstances}
            />
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
