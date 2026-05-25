import { useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";

type NodeLevel = "project" | "category" | "detail";

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

const MIN_SAFE_ZOOM = 0.5;
const MAX_SAFE_ZOOM = 2;
const MAX_WHEEL_DELTA = 180;
const ZOOM_STEP = 0.065;

type Viewport = {
  width: number;
  height: number;
};

export type SelectionRect = {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
};

export type SelectionNode = {
  id: string;
  x: number;
  y: number;
  level: NodeLevel;
};

type DetailPosition = {
  x: number;
  y: number;
};

type DragNode = {
  id: string;
  moved: boolean;
  structure: boolean;
  lastX: number;
  lastY: number;
  ids?: Set<string>;
};

type DragMedia = {
  id: string;
  linkedNodeId: string;
  moved: boolean;
  lastX: number;
  lastY: number;
};

export type UseGesturesOptions = {
  viewport: Viewport;
  cameraRef: MutableRefObject<Camera>;
  targetCameraRef: MutableRefObject<Camera>;
  scheduleGaze: (event: ReactPointerEvent<HTMLElement>) => void;
  startSelectionDrag: (event: React.PointerEvent<HTMLElement>) => boolean;
  updateSelectionDrag: (clientX: number, clientY: number) => boolean;
  finishSelectionDrag: () => boolean;
  selectionRect: SelectionRect | null;
  worldFromPointer: (clientX: number, clientY: number) => { x: number; y: number };
  imageNodes: SelectionNode[];
  linkNodes: SelectionNode[];
  persistNodePositions: (ids: Set<string>) => void;
  moveImagesForNodes: (ids: Set<string>, dx: number, dy: number) => void;
  descendantIds: (rootId: string) => Set<string>;
  isStructureEdit: boolean;
  setInputPosition: (position: DetailPosition) => void;
  setIndexPosition: (position: DetailPosition) => void;
  setDetailPosition: (position: DetailPosition) => void;
  updateNodeImagePosition: (linkedNodeId: string, imageId: string, x: number, y: number) => void;
  updateNodeLinkPosition: (linkedNodeId: string, linkId: string, x: number, y: number) => void;
};

export function useGestures({
  viewport,
  cameraRef,
  targetCameraRef,
  scheduleGaze,
  startSelectionDrag,
  updateSelectionDrag,
  finishSelectionDrag,
  selectionRect,
  worldFromPointer,
  imageNodes,
  linkNodes,
  persistNodePositions,
  moveImagesForNodes,
  descendantIds,
  isStructureEdit,
  setInputPosition,
  setIndexPosition,
  setDetailPosition,
  updateNodeImagePosition,
  updateNodeLinkPosition,
}: UseGesturesOptions) {
  const lastDragMovedRef = useRef(false);
  const panRef = useRef<{ active: boolean; moved: boolean; x: number; y: number }>({ active: false, moved: false, x: 0, y: 0 });
  const layerDragRef = useRef<{ layer: "input" | "index" | "detail"; x: number; y: number; startX: number; startY: number } | null>(null);
  const dragNodeRef = useRef<DragNode | null>(null);
  const dragImageRef = useRef<DragMedia | null>(null);
  const dragLinkRef = useRef<DragMedia | null>(null);
  const groupImageDragRef = useRef<{ ids: Set<string>; dx: number; dy: number } | null>(null);
  const pendingImagePositionRef = useRef<{ linkedNodeId: string; imageId: string; x: number; y: number } | null>(null);
  const pendingLinkPositionRef = useRef<{ linkedNodeId: string; linkId: string; x: number; y: number } | null>(null);
  const mediaPositionFrameRef = useRef<number | null>(null);
  const pendingPointerMoveRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const pendingPointerMoveFrameRef = useRef<number | null>(null);

  const flushPendingMediaPosition = () => {
    mediaPositionFrameRef.current = null;
    const imagePosition = pendingImagePositionRef.current;
    const linkPosition = pendingLinkPositionRef.current;
    pendingImagePositionRef.current = null;
    pendingLinkPositionRef.current = null;

    if (imagePosition) {
      updateNodeImagePosition(imagePosition.linkedNodeId, imagePosition.imageId, imagePosition.x, imagePosition.y);
    }
    if (linkPosition) {
      updateNodeLinkPosition(linkPosition.linkedNodeId, linkPosition.linkId, linkPosition.x, linkPosition.y);
    }
  };

  const flushPendingPointerMove = () => {
    pendingPointerMoveFrameRef.current = null;
    const pending = pendingPointerMoveRef.current;
    pendingPointerMoveRef.current = null;
    if (!pending) return;

    if (updateSelectionDrag(pending.clientX, pending.clientY)) return;

    if (layerDragRef.current) {
      const dx = pending.clientX - layerDragRef.current.x;
      const dy = pending.clientY - layerDragRef.current.y;
      const next = {
        x: clamp(layerDragRef.current.startX + (layerDragRef.current.layer === "detail" ? -dx : dx), 12, viewport.width - 220),
        y: clamp(layerDragRef.current.startY + (layerDragRef.current.layer === "input" ? dy : -dy), 12, viewport.height - 160),
      };
      if (layerDragRef.current.layer === "input") setInputPosition(next);
      if (layerDragRef.current.layer === "index") setIndexPosition(next);
      if (layerDragRef.current.layer === "detail") setDetailPosition(next);
      return;
    }

    const imageDragging = dragImageRef.current;
    if (imageDragging) {
      const point = worldFromPointer(pending.clientX, pending.clientY);
      imageDragging.lastX = point.x;
      imageDragging.lastY = point.y;
      imageDragging.moved = true;
      scheduleImagePositionUpdate(imageDragging.linkedNodeId, imageDragging.id, point.x, point.y);
      return;
    }

    const linkDragging = dragLinkRef.current;
    if (linkDragging) {
      const point = worldFromPointer(pending.clientX, pending.clientY);
      linkDragging.lastX = point.x;
      linkDragging.lastY = point.y;
      linkDragging.moved = true;
      scheduleLinkPositionUpdate(linkDragging.linkedNodeId, linkDragging.id, point.x, point.y);
      return;
    }

    const dragging = dragNodeRef.current;
    if (dragging) {
      const point = worldFromPointer(pending.clientX, pending.clientY);
      const dx = point.x - dragging.lastX;
      const dy = point.y - dragging.lastY;
      const ids = dragging.ids ?? (dragging.structure ? descendantIds(dragging.id) : new Set([dragging.id]));
      dragging.lastX = point.x;
      dragging.lastY = point.y;
      dragging.moved = true;
      groupImageDragRef.current = {
        ids,
        dx: (groupImageDragRef.current?.dx ?? 0) + dx,
        dy: (groupImageDragRef.current?.dy ?? 0) + dy,
      };
      return;
    }

    if (!panRef.current.active) return;
    const dx = pending.clientX - panRef.current.x;
    const dy = pending.clientY - panRef.current.y;
    const next = {
      ...targetCameraRef.current,
      x: targetCameraRef.current.x - dx / cameraRef.current.zoom,
      y: targetCameraRef.current.y - dy / cameraRef.current.zoom,
    };
    targetCameraRef.current = next;
    cameraRef.current = next;
    panRef.current = {
      active: true,
      moved: panRef.current.moved || Math.abs(dx) > 2 || Math.abs(dy) > 2,
      x: pending.clientX,
      y: pending.clientY,
    };
  };

  const scheduleImagePositionUpdate = (linkedNodeId: string, imageId: string, x: number, y: number) => {
    pendingImagePositionRef.current = { linkedNodeId, imageId, x, y };
    if (mediaPositionFrameRef.current !== null) return;
    mediaPositionFrameRef.current = window.requestAnimationFrame(flushPendingMediaPosition);
  };

  const scheduleLinkPositionUpdate = (linkedNodeId: string, linkId: string, x: number, y: number) => {
    pendingLinkPositionRef.current = { linkedNodeId, linkId, x, y };
    if (mediaPositionFrameRef.current !== null) return;
    mediaPositionFrameRef.current = window.requestAnimationFrame(flushPendingMediaPosition);
  };

  const panStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.shiftKey) {
      startSelectionDrag(event);
      return;
    }
    panRef.current = { active: true, moved: false, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const panMove = (event: ReactPointerEvent<HTMLElement>) => {
    scheduleGaze(event);
    pendingPointerMoveRef.current = { clientX: event.clientX, clientY: event.clientY };
    if (pendingPointerMoveFrameRef.current !== null) return;
    pendingPointerMoveFrameRef.current = window.requestAnimationFrame(flushPendingPointerMove);
  };

  const panEnd = () => {
    if (pendingPointerMoveFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingPointerMoveFrameRef.current);
      pendingPointerMoveFrameRef.current = null;
      pendingPointerMoveRef.current = null;
    }
    if (finishSelectionDrag()) {
      lastDragMovedRef.current = true;
      return;
    }
    const wasPanMoved = panRef.current.moved;
    panRef.current.active = false;
    panRef.current.moved = false;
    layerDragRef.current = null;
    if (dragNodeRef.current) {
      const ids = dragNodeRef.current.ids ?? (dragNodeRef.current.structure ? descendantIds(dragNodeRef.current.id) : new Set([dragNodeRef.current.id]));
      if (dragNodeRef.current.moved) persistNodePositions(ids);
      if (dragNodeRef.current.moved && groupImageDragRef.current) {
        moveImagesForNodes(groupImageDragRef.current.ids, groupImageDragRef.current.dx, groupImageDragRef.current.dy);
      }
      lastDragMovedRef.current = dragNodeRef.current.moved;
    }
    dragNodeRef.current = null;
    groupImageDragRef.current = null;
    if (dragImageRef.current) {
      flushPendingMediaPosition();
      lastDragMovedRef.current = dragImageRef.current.moved;
    }
    dragImageRef.current = null;
    if (dragLinkRef.current) {
      flushPendingMediaPosition();
      lastDragMovedRef.current = dragLinkRef.current.moved;
    }
    dragLinkRef.current = null;
    if (!dragNodeRef.current && !dragImageRef.current && !dragLinkRef.current && wasPanMoved) {
      lastDragMovedRef.current = true;
    }
  };

  const zoomSpace = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const safeDelta = clamp(event.deltaY, -MAX_WHEEL_DELTA, MAX_WHEEL_DELTA);
    const direction = safeDelta > 0 ? -1 : 1;
    const nextZoom = clampZoom(targetCameraRef.current.zoom * (1 + direction * ZOOM_STEP));
    targetCameraRef.current = { ...targetCameraRef.current, zoom: nextZoom };
    cameraRef.current = { ...cameraRef.current, zoom: clampZoom(cameraRef.current.zoom) };
  };

  return {
    panStart,
    panMove,
    panEnd,
    zoomSpace,
    lastDragMovedRef,
    panRef,
    layerDragRef,
    dragNodeRef,
    dragImageRef,
    dragLinkRef,
    groupImageDragRef,
    pendingImagePositionRef,
    pendingLinkPositionRef,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampZoom(value: number) {
  if (!Number.isFinite(value)) return 1;
  return clamp(value, MIN_SAFE_ZOOM, MAX_SAFE_ZOOM);
}
