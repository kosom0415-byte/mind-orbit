import { memo } from "react";

type Viewport = {
  width: number;
  height: number;
};

type Gaze = {
  x: number;
  y: number;
};

type SelectionRect = {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
};

type HUDLayerProps = {
  particles: Array<{ id: number; x: number; y: number; size: number; delay: number; duration: number; opacity: number }>;
  selectionRect: SelectionRect | null;
  selectionBounds: (rect: SelectionRect) => { left: number; top: number; right: number; bottom: number };
  selectedCount: number;
  isGazePanEnabled: boolean;
  setIsGazePanEnabled: (enabled: boolean) => void;
  uiLayerEvents: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  };
  showOnboarding: boolean;
  viewport: Viewport;
  gaze: Gaze;
  isPerformanceMode: boolean;
};

function HUDLayer({
  particles,
  selectionRect,
  selectionBounds,
  selectedCount,
  isGazePanEnabled,
  setIsGazePanEnabled,
  uiLayerEvents,
  showOnboarding,
  viewport,
  gaze,
}: HUDLayerProps) {
  return (
    <>
      <div className="conscious-space pointer-events-none absolute inset-0" />
      <div className="light-fog pointer-events-none absolute inset-0" />
      <div className="selection-debug ui-layer" {...uiLayerEvents}>
        Selected: {selectedCount}
      </div>
      {selectionRect && (
        <div
          className="selection-rectangle pointer-events-none"
          style={{
            left: selectionBounds(selectionRect).left,
            top: selectionBounds(selectionRect).top,
            width: selectionBounds(selectionRect).right - selectionBounds(selectionRect).left,
            height: selectionBounds(selectionRect).bottom - selectionBounds(selectionRect).top,
          }}
        />
      )}
      <div className="particle-field pointer-events-none absolute inset-0">
        {particles.map((particle) => (
          <span
            key={particle.id}
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
              opacity: particle.opacity,
            }}
          />
        ))}
      </div>

      <button
        aria-pressed={isGazePanEnabled}
        className={`gaze-toggle ui-layer ${isGazePanEnabled ? "gaze-toggle-on" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          setIsGazePanEnabled(!isGazePanEnabled);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
        {...uiLayerEvents}
      >
        👁
      </button>

      {showOnboarding && (
        <div className="onboarding-whisper pointer-events-none">
          Click a thought. Move through the space. Scroll only when you want distance.
        </div>
      )}
    </>
  );
}

export default memo(HUDLayer);
