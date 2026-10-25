import {
  Zap,
  ArrowUp,
  ArrowDown,
  GitBranch,
  AlertTriangle,
  CheckCircle,
  Settings,
  Power,
} from 'lucide-react';

/**
 * Map event_type from backend to icon, dot color.
 */
const EVENT_STYLES = {
  startup:       { icon: Power, dot: 'blue' },
  scale_out:     { icon: ArrowUp, dot: 'green' },
  scale_in:      { icon: ArrowDown, dot: 'yellow' },
  health_check:  { icon: CheckCircle, dot: 'green' },
  config_update: { icon: Settings, dot: 'blue' },
  info:          { icon: GitBranch, dot: 'blue' },
  warning:       { icon: AlertTriangle, dot: 'orange' },
  error:         { icon: Zap, dot: 'red' },
};

const DEFAULT_STYLE = { icon: Zap, dot: 'yellow' };

/**
 * Format a datetime string into a compact display string.
 */
function formatTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      // If it's in SQLite format "2026-10-25 12:01:01", parse manually
      return dateStr;
    }
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Activity Card — shows recent scaling events from the backend.
 * Falls back to a "no events" message when empty.
 */
export default function ActivityCard({ events = [] }) {
  const total = events.length;

  return (
    <div className="dark-card">
      <div className="dark-card-header">
        <div className="dark-card-title">Scaling Events</div>
        <div>
          <span className="dark-card-count">{total}</span>
          <span className="dark-card-total"> events</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="timeline-empty">
          <p>No events recorded yet.</p>
          <p style={{ fontSize: '0.7rem', color: '#8a8a8a' }}>
            Events will appear when the backend logs activity.
          </p>
        </div>
      ) : (
        <div className="timeline-list" role="list" aria-label="Recent scaling events">
          {events.slice(0, 5).map((evt) => {
            const style = EVENT_STYLES[evt.event_type] || DEFAULT_STYLE;
            const Icon = style.icon;
            return (
              <div className="timeline-item" key={evt.id} role="listitem">
                <span className={`timeline-dot ${style.dot}`} aria-hidden="true" />
                <div className="timeline-content">
                  <div className="timeline-title">{evt.message}</div>
                  <div className="timeline-time">{formatTime(evt.created_at)}</div>
                </div>
                <div className="timeline-icon" aria-hidden="true">
                  <Icon size={14} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
