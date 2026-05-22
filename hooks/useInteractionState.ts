import { useEffect, useMemo, useRef, useState } from "react";

type HoverState = {
  hoveredNodeId: string | null;
  hoveredImageId: string | null;
  hoveredLinkId: string | null;
  setHoveredNodeId: (id: string | null) => void;
  setHoveredImageId: (id: string | null) => void;
  setHoveredLinkId: (id: string | null) => void;
  isGazePanEnabled: boolean;
  setIsGazePanEnabled: (enabled: boolean) => void;
  pointerOverUiRef: React.MutableRefObject<boolean>;
  gazePanEnabledRef: React.MutableRefObject<boolean>;
  uiLayerEvents: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  };
};

export function useInteractionState(): HoverState {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [isGazePanEnabled, setIsGazePanEnabled] = useState(false);
  const pointerOverUiRef = useRef(false);
  const gazePanEnabledRef = useRef(false);

  useEffect(() => {
    gazePanEnabledRef.current = isGazePanEnabled;
  }, [isGazePanEnabled]);

  const uiLayerEvents = useMemo(
    () => ({
      onPointerEnter: () => {
        pointerOverUiRef.current = true;
      },
      onPointerLeave: () => {
        pointerOverUiRef.current = false;
      },
    }),
    [],
  );

  return {
    hoveredNodeId,
    hoveredImageId,
    hoveredLinkId,
    setHoveredNodeId,
    setHoveredImageId,
    setHoveredLinkId,
    isGazePanEnabled,
    setIsGazePanEnabled,
    pointerOverUiRef,
    gazePanEnabledRef,
    uiLayerEvents,
  };
}
