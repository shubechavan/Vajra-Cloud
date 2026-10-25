import { Wifi, WifiOff } from 'lucide-react';

/**
 * Thin banner below the nav showing backend connection status.
 * Hidden when connected — only appears when there's a problem.
 */
export default function ConnectionBanner({ isConnected, metricsSource }) {
  if (isConnected) return null;

  return (
    <div
      className="connection-banner offline"
      role="alert"
      aria-live="polite"
    >
      <WifiOff size={14} aria-hidden="true" />
      <span>
        Backend not connected — showing offline fallback data.
        Start the backend with <code>cd backend &amp;&amp; npm run dev</code>
      </span>
    </div>
  );
}
