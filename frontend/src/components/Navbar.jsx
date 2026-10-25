import { useState } from 'react';
import {
  Cloud,
  Bell,
  User,
  Menu,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'instances', label: 'Instances' },
  { id: 'loadbalancing', label: 'Load Balancing' },
  { id: 'autoscaling', label: 'Auto-Scaling' },
  { id: 'activity', label: 'Activity Logs' },
  { id: 'settings', label: 'Settings' },
];

export default function Navbar({ activePage, onNavigate }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (id) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <nav className="top-nav" role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <div className="nav-logo">
        <Cloud className="nav-logo-icon" aria-hidden="true" />
        <span>Vajra Cloud</span>
      </div>

      {/* Desktop Nav Links */}
      <ul className={`nav-links${mobileOpen ? ' mobile-open' : ''}`}>
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`nav-link${activePage === item.id ? ' active' : ''}`}
              onClick={() => handleNav(item.id)}
              aria-current={activePage === item.id ? 'page' : undefined}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      {/* Right-side actions */}
      <div className="nav-actions">
        {/* Mobile hamburger */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <button className="nav-action-btn" aria-label="Notifications">
          <Bell size={16} />
          <span className="notification-dot" aria-hidden="true" />
        </button>

        <div className="nav-avatar" role="img" aria-label="User profile">
          <User size={16} />
        </div>
      </div>
    </nav>
  );
}
