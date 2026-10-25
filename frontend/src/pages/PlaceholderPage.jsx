import {
  Server,
  GitBranch,
  Gauge,
  FileText,
  Settings,
} from 'lucide-react';

const PAGE_INFO = {
  instances: {
    icon: Server,
    title: 'Server Instances',
    description:
      'Manage and monitor all running server instances. Instance management features will be available in Stage 2.',
  },
  loadbalancing: {
    icon: GitBranch,
    title: 'Load Balancing',
    description:
      'Configure traffic distribution across instances. Full load balancing controls coming in Stage 2.',
  },
  autoscaling: {
    icon: Gauge,
    title: 'Auto-Scaling',
    description:
      'Set up automatic scaling rules based on CPU, memory, and traffic thresholds. Backend integration coming in Stage 2.',
  },
  activity: {
    icon: FileText,
    title: 'Activity Logs',
    description:
      'View detailed logs for scaling events, health checks, and system alerts. Full logging coming in Stage 2.',
  },
  settings: {
    icon: Settings,
    title: 'Settings',
    description:
      'Configure Vajra Cloud preferences, notification settings, and API keys. Settings panel coming in Stage 2.',
  },
};

export default function PlaceholderPage({ pageId }) {
  const info = PAGE_INFO[pageId];
  if (!info) return null;

  const Icon = info.icon;

  return (
    <div className="page-view">
      <h2>{info.title}</h2>
      <p>{info.description}</p>

      <div className="page-placeholder">
        <div className="page-placeholder-icon">
          <Icon size={24} aria-hidden="true" />
        </div>
        <h3>Coming in Stage 2</h3>
        <p>
          This section is under development. Return to the Dashboard to explore
          the current demo.
        </p>
      </div>
    </div>
  );
}
