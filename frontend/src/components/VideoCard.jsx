import { useState, useRef } from 'react';
import { Play, Video } from 'lucide-react';

export default function VideoCard() {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef(null);

  const videoSrc = '/videos/cloudscale-demo.mp4';

  const handleError = () => {
    setHasError(true);
  };

  const handleLoaded = () => {
    setIsLoaded(true);
  };

  return (
    <div className="video-card">
      <div className="video-wrapper">
        {!hasError ? (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              playsInline
              preload="metadata"
              onError={handleError}
              onLoadedData={handleLoaded}
              aria-label="Vajra Cloud demo video"
              style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
            />
            {!isLoaded && (
              <div className="video-placeholder" aria-hidden="true">
                <div className="video-placeholder-icon">
                  <Video size={28} />
                </div>
                <p className="video-placeholder-text">Loading video…</p>
              </div>
            )}
          </>
        ) : (
          <div className="video-placeholder">
            <div className="video-placeholder-icon">
              <Play size={28} />
            </div>
            <p className="video-placeholder-text">
              Add your custom video to get started.
            </p>
            <p className="video-placeholder-text" style={{ fontSize: '0.65rem', marginTop: '-8px' }}>
              Place your MP4 at<br />
              <code style={{ fontSize: '0.65rem' }}>public/videos/cloudscale-demo.mp4</code>
            </p>
          </div>
        )}

        {/* Overlay label */}
        <div className="video-overlay-label">
          <span className="live-dot" aria-hidden="true" />
          Vajra Cloud Live Demo
        </div>
      </div>

      <div className="video-info">
        <div className="video-info-title">System Overview</div>
        <div className="video-info-sub">
          Replace with your own demo recording
        </div>
      </div>
    </div>
  );
}
