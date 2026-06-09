import { useEffect, useMemo } from 'react';
import brandLight from '../assets/brand-light.png';
import desktopPos from '../assets/desktop-pos.png';
import kitchenDisplay from '../assets/kitchen-display.png';
import restaurantInterior from '../assets/restaurant-interior.jpg';
import restaurantService from '../assets/restaurant-service.jpg';
import './Loader.css';

const slides = [
  {
    image: desktopPos,
    label: 'Counter ready',
    metric: 'POS'
  },
  {
    image: kitchenDisplay,
    label: 'Kitchen synced',
    metric: 'KDS'
  },
  {
    image: restaurantInterior,
    label: 'Dining floor live',
    metric: 'OPS'
  },
  {
    image: restaurantService,
    label: 'Service connected',
    metric: 'SYNC'
  }
];

const Loader = function ({ status, dispatch }) {
  useEffect(
    function () {
      if (!window.electronAPI) return undefined;
      const handleEvents = function (_, event) {
        dispatch({ type: 'setStatus', payload: event });
      };
      window.electronAPI.handleLoading(handleEvents);
      return function () {
        window.electronAPI.removehandleLoading(handleEvents);
      };
    },
    [dispatch]
  );

  const statusDisplay = useMemo(() => {
    if (!status) return 'Starting Restaurant POS...';

    switch (status.type) {
      case 'retry':
        return `Reconnecting in ${status.remainingTime}s - attempt ${status.attempt}`;
      case 'install':
        return `Installing update - ${status.remainingTime}s remaining`;
      case 'download':
        return `Downloading update ${(status.transferred * 0.000001).toFixed(2)} MB of ${(
          status.total * 0.000001
        ).toFixed(2)} MB`;
      case 'check':
        return 'Checking for updates...';
      default:
        return status.status || 'Preparing workspace...';
    }
  }, [status]);

  const progress = Math.max(0, Math.min(100, Number(status?.progress || 0)));
  const speedDisplay = status?.speed
    ? `${(status.speed * 0.000001).toFixed(2)} MB/s`
    : 'Secure desktop shell';

  return (
    <main id="loader" className="loader-shell">
      <section className="loader-visual" aria-label="Restaurant POS loading preview">
        <div className="ambient-grid" />
        <div className="preview-stage">
          <div className="brand-strip">
            <img src={brandLight} alt="Restaurant POS" />
            <span>Desktop</span>
          </div>
          <div className="carousel-stack">
            {slides.map((slide, index) => (
              <article
                className="carousel-slide"
                style={{ '--slide-index': index }}
                key={slide.label}
              >
                <img src={slide.image} alt="" />
                <div className="slide-caption">
                  <strong>{slide.metric}</strong>
                  <span>{slide.label}</span>
                </div>
              </article>
            ))}
          </div>
          <div className="pulse-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      <section className="loader-content">
        <img className="loader-logo" src={brandLight} alt="Restaurant POS" />
        <div className="loader-copy">
          <p className="eyebrow">Launching secure workspace</p>
          <h1>Restaurant POS System</h1>
          <p>Preparing sales, kitchen display, inventory, and customer display services.</p>
        </div>

        <div className="progress-panel" role="status" aria-live="polite">
          <div className="progress-meta">
            <span>{statusDisplay}</span>
            <span>{speedDisplay}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <div className="progress-shimmer" />
          </div>
          <div className="boot-steps" aria-hidden="true">
            <span className="is-active">Updates</span>
            <span>Services</span>
            <span>Display</span>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Loader;
