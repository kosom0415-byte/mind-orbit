import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

type NodeLevel = "project" | "category" | "detail";

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

type Viewport = {
  width: number;
  height: number;
};

type SelectionNodeBase = {
  id: string;
  x: number;
  y: number;
  level: NodeLevel;
};

export type SelectionNode = SelectionNodeBase;

export type SelectionRect = {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
};

type UseSelectionOptions = {
  visibleNodes: SelectionNode[];
  camera: Camera;
  viewport: Viewport;
  spaceRef: RefObject<HTMLElement | null>;
  addChildNode: (node: any) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedImageId: (id: string | null) => void;
  setSelectedLinkId: (id: string | null) => void;
  setSelectedMemoId: (id: string | null) => void;
  isInteractiveTarget: (target: EventTarget | null) => boolean;
};

export function useSelection({
  visibleNodes,
  camera,
  viewport,
  spaceRef,
  addChildNode,
  setSelectedNodeId,
  setSelectedImageId,
  setSelectedLinkId,
  setSelectedMemoId,
  isInteractiveTarget,
}: UseSelectionOptions) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const selectionRectRef = useRef<SelectionRect | null>(null);
  const selectionBaseIdsRef = useRef<Set<string>>(new Set());
  const selectedNodeIdsRef = useRef<string[]>([]);
  const suppressNextCanvasClickRef = useRef(false);

  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  useEffect(() => {
    if (selectedNodeIds.length === 0) return;
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    setSelectedNodeIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [visibleNodes]);

  const pointerInSpace = (clientX: number, clientY: number) => {
    const rect = spaceRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  };

  const selectionBounds = (rect: SelectionRect) => {
    const left = Math.min(rect.startX, rect.currentX);
    const right = Math.max(rect.startX, rect.currentX);
    const top = Math.min(rect.startY, rect.currentY);
    const bottom = Math.max(rect.startY, rect.currentY);
    return { left, right, top, bottom };
  };

  const screenPosition = (node: SelectionNode) => ({
    x: (node.x - camera.x) * camera.zoom + viewport.width / 2,
    y: (node.y - camera.y) * camera.zoom + viewport.height / 2,
  });

  const nodeIdsInSelection = (rect: SelectionRect) => {
    const bounds = selectionBounds(rect);
    return visibleNodes
      .filter((node) => {
        const position = screenPosition(node);
        return position.x >= bounds.left && position.x <= bounds.right && position.y >= bounds.top && position.y <= bounds.bottom;
      })
      .map((node) => node.id);
  };

  const hitTestVisibleNode = (clientX: number, clientY: number) => {
    const point = pointerInSpace(clientX, clientY);
    return visibleNodes
      .map((node) => {
        const position = screenPosition(node);
        const radius = node.level === "project" ? 120 : node.level === "category" ? 82 : 64;
        const distance = Math.hypot(position.x - point.x, position.y - point.y);
        return { node, distance, radius };
      })
      .filter((item) => item.distance <= item.radius)
      .sort((a, b) => a.distance - b.distance)[0]?.node;
  };

  const toggleNodeSelection = (id: string) => {
    setSelectedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const nextIds = [...next];
      selectedNodeIdsRef.current = nextIds;
      return nextIds;
    });
    setSelectedNodeId(null);
    setSelectedImageId(null);
    setSelectedLinkId(null);
    setSelectedMemoId(null);
  };

  const beginSelectionDrag = (clientX: number, clientY: number) => {
    const point = pointerInSpace(clientX, clientY);
    const next: SelectionRect = {
      active: true,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      additive: true,
    };
    selectionBaseIdsRef.current = new Set(selectedNodeIds);
    selectionRectRef.current = next;
    setSelectionRect(next);
    setSelectedNodeId(null);
    setSelectedImageId(null);
    setSelectedLinkId(null);
    setSelectedMemoId(null);
    return true;
  };

  const startSelectionDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return false;
    beginSelectionDrag(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    return true;
  };

  const updateSelectionDrag = (clientX: number, clientY: number) => {
    const current = selectionRectRef.current;
    if (!current?.active) return false;
    const point = pointerInSpace(clientX, clientY);
    const next = { ...current, currentX: point.x, currentY: point.y };
    selectionRectRef.current = next;
    setSelectionRect(next);
    const ids = new Set(selectionBaseIdsRef.current);
    nodeIdsInSelection(next).forEach((id) => ids.add(id));
    setSelectedNodeIds([...ids]);
    return true;
  };

  const finishSelectionDrag = () => {
    if (!selectionRectRef.current) return false;
    const ids = new Set(selectionBaseIdsRef.current);
    nodeIdsInSelection(selectionRectRef.current).forEach((id) => ids.add(id));
    const selectedIds = [...ids];
    selectedNodeIdsRef.current = selectedIds;
    setSelectedNodeIds(selectedIds);
    selectionRectRef.current = null;
    selectionBaseIdsRef.current = new Set();
    setSelectionRect(null);
    return true;
  };

  useEffect(() => {
    const insideSpace = (clientX: number, clientY: number) => {
      const rect = spaceRef.current?.getBoundingClientRect();
      if (!rect) return false;
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    };

    const stopNativeEvent = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !insideSpace(event.clientX, event.clientY) || isInteractiveTarget(event.target)) return;
      const node = hitTestVisibleNode(event.clientX, event.clientY);
      if (event.shiftKey) {
        suppressNextCanvasClickRef.current = true;
        if (node) {
          toggleNodeSelection(node.id);
        } else {
          beginSelectionDrag(event.clientX, event.clientY);
        }
        stopNativeEvent(event);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && node) {
        addChildNode(node);
        stopNativeEvent(event);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!selectionRectRef.current) return;
      updateSelectionDrag(event.clientX, event.clientY);
      stopNativeEvent(event);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (selectionRectRef.current) {
        finishSelectionDrag();
        stopNativeEvent(event);
        return;
      }
      if ((event.shiftKey || suppressNextCanvasClickRef.current) && insideSpace(event.clientX, event.clientY)) {
        stopNativeEvent(event);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
    };
  }, [camera, visibleNodes, viewport, addChildNode, isInteractiveTarget]);

  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  return {
    selectedNodeIds,
    setSelectedNodeIds,
    selectedNodeIdsRef,
    selectedNodeIdSet,
    selectionRect,
    selectionRectRef,
    selectionBounds,
    toggleNodeSelection,
    beginSelectionDrag,
    startSelectionDrag,
    updateSelectionDrag,
    finishSelectionDrag,
    hitTestVisibleNode,
    pointerInSpace,
    suppressNextCanvasClickRef,
  };
}
