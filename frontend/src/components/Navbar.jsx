import {
  Cloud,
  Bell,
  User,
  ChevronsUpDown,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'instances', label: 'Instances' },
  { id: 'loadbalancing', label: 'Load Balancing' },
  { id: 'autoscaling', label: 'Auto-Scaling' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
];

export default function Navbar({ activePage, onNavigate, isConnected = false }) {
  return (
    <nav className="top-nav" role="navigation" aria-label="Main navigation">
      {/* Row 1: breadcrumb + actions */}
      <div className="nav-bar">
        <div className="nav-breadcrumb">
          <div className="nav-logo">
            <span className="nav-logo-mark">
              <Cloud size={14} aria-hidden="true" />
            </span>
            <span>Vajra Cloud</span>
          </div>

          <span className="nav-slash" aria-hidden="true">/</span>

          <button className="nav-project" title="Project">
            <span className="nav-project-avatar" aria-hidden="true" />
            vajra-cloud
            <span className={`nav-env ${isConnected ? 'online' : 'offline'}`}>
              {isConnected ? 'Production' : 'Offline'}
            </span>
            <ChevronsUpDown size={14} className="nav-project-chevron" aria-hidden="true" />
          </button>
        </div>

        <div className="nav-actions">
          <button className="nav-action-btn" aria-label="Notifications">
            <Bell size={16} />
            <span className="notification-dot" aria-hidden="true" />
          </button>

          <div className="nav-avatar" role="img" aria-label="User profile">
            <User size={14} />
          </div>
        </div>
      </div>

      {/* Row 2: tabs */}
      <ul className="nav-links">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`nav-link${activePage === item.id ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-current={activePage === item.id ? 'page' : undefined}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
