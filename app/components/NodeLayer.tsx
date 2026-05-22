import { memo, type MouseEvent, type KeyboardEvent } from "react";

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

type Viewport = {
  width: number;
  height: number;
};

type NodeOverride = {
  label?: string;
  color?: string;
};

type SimNode = {
  id: string;
  x: number;
  y: number;
  level: string;
  parentId?: string;
  color?: string;
  label: string;
  project: string;
  memo: { id: string };
  thoughtPocket?: unknown;
};

type ImageNode = {
  id: string;
  linkedNodeId: string;
  linkedLabel: string;
  level: string;
  x: number;
  y: number;
  z?: number;
  src?: string;
  name?: string;
  keywords?: string[];
};

type LinkNode = {
  id: string;
  linkedNodeId: string;
  linkedLabel: string;
  level: string;
  source: "youtube" | "instagram" | "web";
  x: number;
  y: number;
  z?: number;
  title?: string;
  thumbnailUrl?: string;
  url: string;
};

type Position = {
  x: number;
  y: number;
};

type NodeLayerProps = {
  visibleNodes: SimNode[];
  imageNodes: ImageNode[];
  linkNodes: LinkNode[];
  selectedNodeId: string | null;
  selectedImageId: string | null;
  selectedLinkId: string | null;
  hoveredNodeId: string | null;
  hoveredImageId: string | null;
  hoveredLinkId: string | null;
  selectedNodeIdSet: Set<string>;
  selectedNodeIds: string[];
  selectedAncestorTrail: string[];
  selectedNeighbors: Set<string>;
  selectedAncestors: Set<string>;
  currentPocketId: string | null;
  innerSpaceNodeIds: Set<string>;
  nodeOverrides: Record<string, NodeOverride>;
  isPerformanceMode: boolean;
  gaze: { x: number; y: number };
  camera: Camera;
  viewport: Viewport;
  editingNodeId: string | null;
  selectedNode: SimNode | null;
  worldFromPointer: (clientX: number, clientY: number) => Position;
  imageScreenPosition: (image: { x: number; y: number }) => Position;
  focusNode: (node: any) => void;
  enterThoughtPocket: (node: any) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeColor: (id: string, color: string) => void;
  addChildNode: (node: any) => void;
  deleteNode: (id: string) => void;
  focusImage: (image: any) => void;
  focusLink: (link: any) => void;
  setHoveredNodeId: (id: string | null) => void;
  setHoveredImageId: (id: string | null) => void;
  setHoveredLinkId: (id: string | null) => void;
  lastDragMovedRef: React.MutableRefObject<boolean>;
  selectedNodeIdsRef: React.MutableRefObject<string[]>;
  suppressNextCanvasClickRef: React.MutableRefObject<boolean>;
  dragNodeRef: React.MutableRefObject<any>;
  dragImageRef: React.MutableRefObject<any>;
  dragLinkRef: React.MutableRefObject<any>;
  updateSelectionDrag: (clientX: number, clientY: number) => boolean;
  enterInteractionSafeZone: () => void;
  leaveInteractionSafeZone: () => void;
  nodeClass: (level: any, selected: boolean, dimmed: boolean) => string;
  colorClass: (color?: string) => string;
};

function NodeLayer({
  visibleNodes,
  imageNodes,
  linkNodes,
  selectedNodeId,
  selectedImageId,
  selectedLinkId,
  hoveredNodeId,
  hoveredImageId,
  hoveredLinkId,
  selectedNodeIdSet,
  selectedNodeIds,
  selectedAncestorTrail,
  selectedNeighbors,
  selectedAncestors,
  currentPocketId,
  innerSpaceNodeIds,
  nodeOverrides,
  isPerformanceMode,
  gaze,
  camera,
  viewport,
  editingNodeId,
  selectedNode,
  worldFromPointer,
  imageScreenPosition,
  focusNode,
  enterThoughtPocket,
  updateNodeLabel,
  updateNodeColor,
  addChildNode,
  deleteNode,
  focusImage,
  focusLink,
  setHoveredNodeId,
  setHoveredImageId,
  setHoveredLinkId,
  lastDragMovedRef,
  selectedNodeIdsRef,
  suppressNextCanvasClickRef,
  dragNodeRef,
  dragImageRef,
  dragLinkRef,
  updateSelectionDrag,
  enterInteractionSafeZone,
  leaveInteractionSafeZone,
  nodeClass,
  colorClass,
}: NodeLayerProps) {
  return (
    <>
      {visibleNodes.map((node) => {
        const position = { x: (node.x - camera.x) * camera.zoom + viewport.width / 2, y: (node.y - camera.y) * camera.zoom + viewport.height / 2 };
        const ancestorIndex = selectedAncestorTrail.indexOf(node.id);
        const ancestor = ancestorIndex >= 0;
        const distance = Math.hypot(node.x - camera.x, node.y - camera.y);
        const selected = selectedNodeId === node.id;
        const multiSelected = selectedNodeIdSet.has(node.id);
        const hovered = hoveredNodeId === node.id;
        const innerDimmed = Boolean(currentPocketId && !innerSpaceNodeIds.has(node.id));
        const dimmed = currentPocketId
          ? innerDimmed && !multiSelected
          : Boolean((selectedNodeId && !selectedNeighbors.has(node.id) && !ancestor) || (selectedNodeIds.length > 0 && !multiSelected));
        const neighbor = selectedNodeId ? selectedNeighbors.has(node.id) : false;
        const curveX = Math.min(1, Math.max(-1, (position.x - viewport.width / 2) / (viewport.width / 2)));
        const curveY = Math.min(1, Math.max(-1, (position.y - viewport.height / 2) / (viewport.height / 2)));
        const edgeDepth = (Math.abs(curveX) + Math.abs(curveY)) * -1180 * 0.42;
        const focusDepth = selected
          ? 120 * 1.32
          : ancestor
            ? 120 * 0.62
            : neighbor
              ? 120 * 0.32
              : 0;
        const zDepth = edgeDepth + focusDepth - Math.min(Math.max(distance / 18, 0), 1180);
        const ancestorOpacity = ancestor ? Math.min(Math.max(0.7 - ancestorIndex * 0.15, 0.32), 0.7) : 0;
        const ancestorBlur = isPerformanceMode ? 0 : ancestor ? Math.min(Math.max(0.25 + ancestorIndex * 0.12, 0.25), 0.5) : 0;
        const depthOpacity = selected || multiSelected || hovered ? 1 : ancestor ? ancestorOpacity : Math.min(Math.max(1 - distance / 1900 + zDepth / 1400, 0.46), 0.96);
        const depthBlur = isPerformanceMode || selected || multiSelected || hovered ? 0 : ancestor ? ancestorBlur : Math.min(Math.max(distance / 1600 - zDepth / 900, 0), 0.35);
        const edgeAmount = Math.min(1, Math.hypot(curveX, curveY));
        const curveRotateY = -curveX * 3.6 + gaze.x * 5.2 * 0.8;
        const curveRotateX = curveY * 3.6 * 0.72 - gaze.y * 5.2 * 0.6;
        const scale =
          (selected
            ? 1.72
            : multiSelected
              ? node.level === "project"
                ? 1.1
                : 0.94
              : ancestor
                ? Math.min(Math.max(1.2 + ancestorIndex * 0.15, 1.2), 1.5)
                : neighbor
                  ? node.level === "project"
                    ? 1.22
                    : 1.08
                  : node.level === "project"
                    ? 0.86
                    : node.level === "category"
                      ? 0.72
                      : 0.6) *
          (ancestor && !selected ? 1 : Math.min(Math.max(1 + zDepth / 900, 0.78), 1.16)) *
          (1 - edgeAmount * 0.1) *
          (hovered && !selected ? 1.08 : 1) *
          camera.zoom;

        const activateNode = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
          if (lastDragMovedRef.current) {
            lastDragMovedRef.current = false;
            return;
          }
          if (suppressNextCanvasClickRef.current) {
            suppressNextCanvasClickRef.current = false;
            event.preventDefault();
            return;
          }
          if (event.shiftKey) {
            event.preventDefault();
            return;
          }
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            addChildNode(node);
            return;
          }
          focusNode(node);
        };

        return (
          <div
            className={`${nodeClass(node.level, selected, dimmed)} ${colorClass(node.color)} ${multiSelected ? "thought-multi-selected" : ""} ${ancestor && !selected ? "thought-ancestor" : ""} ${editingNodeId === node.id ? "thought-editing" : ""}`}
            key={node.id}
            role="button"
            tabIndex={0}
            onClick={activateNode}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateNode(event);
              }
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              enterThoughtPocket(node);
            }}
            onPointerEnter={() => {
              if (!isPerformanceMode) setHoveredNodeId(node.id);
            }}
            onPointerLeave={() => {
              if (!isPerformanceMode) setHoveredNodeId(null);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (event.shiftKey) return;
              const point = worldFromPointer(event.clientX, event.clientY);
              const groupIds = selectedNodeIdSet.has(node.id) && selectedNodeIds.length > 1 ? new Set(selectedNodeIds) : undefined;
              const groupDrag = Boolean(groupIds) || node.level !== "detail";
              dragNodeRef.current = {
                id: node.id,
                moved: false,
                structure: groupDrag,
                lastX: point.x,
                lastY: point.y,
                ids: groupIds,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            style={{
              left: position.x,
              top: position.y,
              zIndex: selected ? 32 : multiSelected ? 28 : ancestor ? 30 - ancestorIndex : neighbor ? 18 : undefined,
              opacity: dimmed ? undefined : neighbor && !selected ? Math.max(depthOpacity, 0.58) : depthOpacity,
              filter: dimmed || depthBlur <= 0 ? undefined : `blur(${depthBlur}px)`,
              transform: `translate(-50%, -50%) translate3d(${gaze.x * 5.2 * 0.72}px, ${gaze.y * 5.2 * 0.58}px, ${zDepth}px) rotateX(${curveRotateX}deg) rotateY(${curveRotateY}deg) scale(${scale})`,
            }}
          >
            {editingNodeId === node.id ? (
              <span className="node-editor floating-action-layer" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                <input
                  autoFocus
                  value={nodeOverrides[node.id]?.label ?? node.label}
                  onChange={(event) => updateNodeLabel(node.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      updateNodeLabel(node.id, event.currentTarget.value);
                    }
                  }}
                />
                <button
                  className="node-add-child"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    addChildNode(node);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                >
                  +
                </button>
                <span className="color-orbit">
                  {Object.keys({ graphite: true, mist: true, iris: true, moss: true, clay: true }).map((color) => (
                    <button
                      className={`color-swatch thought-color-${color}`}
                      key={`${node.id}-${color}`}
                      onClick={() => updateNodeColor(node.id, color)}
                      type="button"
                    />
                  ))}
                </span>
              </span>
            ) : (
              node.label
            )}
            {selected && editingNodeId !== node.id && (
              <span className="node-actions floating-action-layer" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                <button onClick={() => updateNodeLabel(node.id, node.label)} type="button">
                  Edit
                </button>
                <button onClick={() => enterThoughtPocket(node)} type="button">
                  진입
                </button>
                <button onClick={() => addChildNode(node)} type="button">
                  +
                </button>
                <button
                  onClick={() => {
                    deleteNode(node.id);
                  }}
                  type="button"
                >
                  Del
                </button>
              </span>
            )}
          </div>
        );
      })}

      {imageNodes.map((image, index) => {
        const position = imageScreenPosition(image);
        const selected = selectedImageId === image.id;
        const hovered = hoveredImageId === image.id;
        const linkedNode = visibleNodes.find((node) => node.id === image.linkedNodeId);
        const innerHidden = Boolean(currentPocketId && image.linkedNodeId && !innerSpaceNodeIds.has(image.linkedNodeId));
        const distance = Math.hypot(image.x - camera.x, image.y - camera.y);
        const curveX = Math.min(1, Math.max(-1, (position.x - viewport.width / 2) / (viewport.width / 2)));
        const curveY = Math.min(1, Math.max(-1, (position.y - viewport.height / 2) / (viewport.height / 2)));
        const edgeAmount = Math.min(1, Math.hypot(curveX, curveY));
        const depthState = selected || (selectedNodeId && image.linkedNodeId === selectedNodeId)
          ? { opacity: 1, scale: selected ? 1.34 : 1 }
          : linkedNode && selectedNode && (selectedNeighbors.has(linkedNode.id) || selectedAncestors.has(linkedNode.id) || linkedNode.parentId === selectedNode.id || selectedNode.parentId === linkedNode.id || linkedNode.parentId === selectedNode.parentId)
            ? { opacity: 0.75, scale: 0.92 }
            : selectedNode && linkedNode?.project === selectedNode.project
              ? { opacity: 0.5, scale: 0.82 }
              : selectedNode
                ? { opacity: 0.32, scale: 0.72 }
                : { opacity: Math.min(Math.max(1 - distance / 2100, 0.54), 0.9), scale: image.level === "project" ? 1 : 0.84 };
        const opacity = innerHidden ? 0.16 : hovered && !selected ? Math.min(depthState.opacity + 0.25, 1) : depthState.opacity;
        const scale = (depthState.scale + (hovered && !selected ? 0.08 : 0)) * (1 - edgeAmount * 0.1) * camera.zoom;
        const zDepth = selected ? 180 : hovered ? 82 : image.z ?? 0;
        const rotateX = curveY * 3.6 * 0.45 - gaze.y * 5.2 * 0.45;
        const rotateY = -curveX * 3.6 * 0.7 + gaze.x * 5.2 * 0.65;

        return (
          <figure
            className={`image-node interaction-safe-zone ${selected ? "image-node-selected" : ""}`}
            key={`image-node-${image.id}`}
            onClick={(event) => {
              event.stopPropagation();
              if (lastDragMovedRef.current) {
                lastDragMovedRef.current = false;
                return;
              }
              focusImage(image);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              const point = worldFromPointer(event.clientX, event.clientY);
              dragImageRef.current = {
                id: image.id,
                linkedNodeId: image.linkedNodeId,
                moved: false,
                lastX: point.x,
                lastY: point.y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onMouseEnter={enterInteractionSafeZone}
            onMouseLeave={() => {
              leaveInteractionSafeZone();
            }}
            onMouseMove={(event) => {
              enterInteractionSafeZone();
              if (!dragImageRef.current) event.stopPropagation();
            }}
            onPointerEnter={() => {
              enterInteractionSafeZone();
            }}
            onPointerLeave={() => {
              leaveInteractionSafeZone();
            }}
            onPointerMove={(event) => {
              enterInteractionSafeZone();
              if (updateSelectionDrag(event.clientX, event.clientY)) return;
              if (!dragImageRef.current) event.stopPropagation();
            }}
            onWheel={(event) => event.stopPropagation()}
            style={{
              left: position.x,
              top: position.y,
              opacity,
              zIndex: selected ? 31 : hovered ? 22 : 10,
              transform: `translate(-50%, -50%) translate3d(${gaze.x * 5.2 * 0.9}px, ${gaze.y * 5.2 * 0.72}px, ${zDepth}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotate(${[-5, 3, -2, 6, -7, 4][index % 6]}deg) scale(${scale})`,
            }}
          >
            {image.src ? (
              <img
                className="interaction-safe-zone"
                alt={image.name}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                src={image.src}
              />
            ) : (
              <span className="image-placeholder interaction-safe-zone">Image</span>
            )}
            <figcaption>{image.linkedLabel}</figcaption>
          </figure>
        );
      })}

      {linkNodes.map((link, index) => {
        const position = imageScreenPosition(link);
        const selected = selectedLinkId === link.id;
        const hovered = hoveredLinkId === link.id;
        const innerHidden = Boolean(currentPocketId && !innerSpaceNodeIds.has(link.linkedNodeId));
        const distance = Math.hypot(link.x - camera.x, link.y - camera.y);
        const curveX = Math.min(1, Math.max(-1, (position.x - viewport.width / 2) / (viewport.width / 2)));
        const curveY = Math.min(1, Math.max(-1, (position.y - viewport.height / 2) / (viewport.height / 2)));
        const edgeAmount = Math.min(1, Math.hypot(curveX, curveY));
        const opacity = innerHidden ? 0.16 : selected || hovered ? 1 : Math.min(Math.max(1 - distance / 2100, 0.54), 0.94);
        const scale = (selected ? 1.25 : hovered ? 1.08 : 0.86) * (1 - edgeAmount * 0.1) * camera.zoom;
        const zDepth = selected ? 165 : hovered ? 72 : link.z ?? 0;
        const rotateX = curveY * 3.6 * 0.38 - gaze.y * 5.2 * 0.36;
        const rotateY = -curveX * 3.6 * 0.62 + gaze.x * 5.2 * 0.52;

        return (
          <figure
            className={`link-node interaction-safe-zone link-node-${link.source} ${selected ? "link-node-selected" : ""}`}
            key={`link-node-${link.id}`}
            onClick={(event) => {
              event.stopPropagation();
              if (lastDragMovedRef.current) {
                lastDragMovedRef.current = false;
                return;
              }
              focusLink(link);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              const point = worldFromPointer(event.clientX, event.clientY);
              dragLinkRef.current = {
                id: link.id,
                linkedNodeId: link.linkedNodeId,
                moved: false,
                lastX: point.x,
                lastY: point.y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onMouseEnter={enterInteractionSafeZone}
            onMouseLeave={() => {
              leaveInteractionSafeZone();
            }}
            onMouseMove={(event) => {
              enterInteractionSafeZone();
              if (!dragLinkRef.current) event.stopPropagation();
            }}
            onPointerEnter={() => {
              enterInteractionSafeZone();
            }}
            onPointerLeave={() => {
              leaveInteractionSafeZone();
            }}
            onPointerMove={(event) => {
              enterInteractionSafeZone();
              if (updateSelectionDrag(event.clientX, event.clientY)) return;
              if (!dragLinkRef.current) event.stopPropagation();
            }}
            onWheel={(event) => event.stopPropagation()}
            style={{
              left: position.x,
              top: position.y,
              opacity,
              zIndex: selected ? 31 : hovered ? 22 : 10,
              transform: `translate(-50%, -50%) translate3d(${gaze.x * 5.2 * 0.82}px, ${gaze.y * 5.2 * 0.64}px, ${zDepth}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotate(${[-3, 2, -1, 4][index % 4]}deg) scale(${scale})`,
            }}
          >
            {link.thumbnailUrl ? (
              <img
                className="interaction-safe-zone"
                alt={link.title ?? link.url}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                src={link.thumbnailUrl}
              />
            ) : (
              <span className="image-placeholder interaction-safe-zone">Link</span>
            )}
          </figure>
        );
      })}
    </>
  );
}

export default memo(NodeLayer);
