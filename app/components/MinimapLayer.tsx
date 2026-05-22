import { memo } from "react";

type Viewport = {
  width: number;
  height: number;
};

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

type MinimapLayerProps = {
  viewport: Viewport;
  camera: Camera;
  visibleNodes: Array<{ id: string; x: number; y: number }>;
};

function MinimapLayer({ viewport, camera, visibleNodes }: MinimapLayerProps) {
  return (
    <div className="minimap-layer" aria-hidden="true" style={{ display: "none" }}>
      {/* Minimap hook / render structure ready for future integration */}
      <span className="sr-only">Minimap placeholder</span>
    </div>
  );
}

export default memo(MinimapLayer);
