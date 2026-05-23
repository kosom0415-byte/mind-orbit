import { memo } from "react";
import { edgeStrokeColor, edgeStrokeWidth, isHierarchyEdge, isSemanticEdge } from "../../lib/mind/edgeRender";
import type { GraphEdge } from "../../lib/mind/types";

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

type Viewport = {
  width: number;
  height: number;
};

type ImageNode = {
  id: string;
  linkedNodeId: string;
  linkedLabel: string;
  level: string;
  x: number;
  y: number;
  z?: number;
  keywords?: string[];
};

type NodeLink = {
  id: string;
  linkedNodeId: string;
  linkedLabel: string;
  level: string;
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

type EdgeLayerProps = {
  visibleGraphEdges: GraphEdge[];
  imageNodes: ImageNode[];
  linkNodes: NodeLink[];
  simNodeMap: Map<string, { id: string; project: string; level: string }>;
  screenPositionMap: Map<string, Position>;
  selectedNodeId: string | null;
  selectedImageId: string | null;
  selectedLinkId: string | null;
  selectedNode: { id: string; project: string } | null;
  currentPocketId: string | null;
  innerSpaceNodeIds: Set<string>;
  projectLineColor: (project: string, seed: string, opacity: number) => string;
  imageScreenPosition: (image: { x: number; y: number }) => Position;
  edgeLineWidth: (source: any, target: any, active: boolean) => number;
  attachmentLineWidth: (active: boolean) => number;
  getEdgeOpacity: (
    edge: GraphEdge,
    options: {
      focusedNodeId: string | null;
      innerSpaceNodeIds?: Set<string>;
    },
  ) => number;
};

function EdgeLayer({
  visibleGraphEdges,
  imageNodes,
  linkNodes,
  simNodeMap,
  screenPositionMap,
  selectedNodeId,
  selectedImageId,
  selectedLinkId,
  selectedNode,
  currentPocketId,
  innerSpaceNodeIds,
  projectLineColor,
  imageScreenPosition,
  edgeLineWidth,
  attachmentLineWidth,
  getEdgeOpacity,
}: EdgeLayerProps) {
  return (
    <svg className="thought-links pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="mind-link" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(0, 0, 0, 0.02)" />
          <stop offset="50%" stopColor="rgba(0, 0, 0, 0.2)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0.04)" />
        </linearGradient>
        <filter id="semantic-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="active-edge-glow" x="-120%" y="-120%" width="240%" height="240%">
          <feFlood floodColor="rgba(46, 128, 255, 0.18)" result="glowColor" />
          <feComposite in="glowColor" in2="SourceGraphic" operator="in" result="glowMask" />
          <feGaussianBlur in="glowMask" stdDeviation="4" result="glowBlur" />
          <feMerge>
            <feMergeNode in="glowBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {visibleGraphEdges.map((edge) => {
        const source = simNodeMap.get(edge.source);
        const target = simNodeMap.get(edge.target);
        if (!source || !target) return null;

        const sourceScreen = screenPositionMap.get(edge.source);
        const targetScreen = screenPositionMap.get(edge.target);
        if (!sourceScreen || !targetScreen) return null;

        const active = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);
        const opacity = getEdgeOpacity(edge, {
          focusedNodeId: selectedNodeId,
          innerSpaceNodeIds: currentPocketId ? innerSpaceNodeIds : undefined,
        });
        const project = source.level === "project" ? source.project : target.project;
        const baseColor = projectLineColor(project, edge.id, 1);
        const stroke = edgeStrokeColor(edge, opacity, baseColor);
        const strokeWidth = edgeStrokeWidth(edge, Boolean(active), edgeLineWidth(source, target, Boolean(active))) + (active ? 0.4 : 0);
        const filter = active ? "url(#active-edge-glow)" : isSemanticEdge(edge) ? "url(#semantic-glow)" : undefined;
        const className = [`thought-link`, active ? "thought-link-active" : null, isHierarchyEdge(edge) ? "thought-link--hierarchy" : null, isSemanticEdge(edge) ? "thought-link--semantic" : null]
          .filter(Boolean)
          .join(" ");

        return (
          <line
            key={edge.id}
            x1={sourceScreen.x}
            x2={targetScreen.x}
            y1={sourceScreen.y}
            y2={targetScreen.y}
            className={className}
            opacity={active ? Math.max(opacity, 0.75) : opacity}
            stroke={stroke}
            strokeWidth={strokeWidth}
            filter={filter}
          />
        );
      })}

      {imageNodes.map((image) => {
        const source = simNodeMap.get(image.linkedNodeId);
        if (!source) return null;

        const sourceScreen = screenPositionMap.get(image.linkedNodeId);
        const targetScreen = imageScreenPosition(image);
        if (!sourceScreen) return null;

        const active = selectedImageId === image.id || selectedNodeId === image.linkedNodeId;
        const sameActiveProject = selectedNode ? source.project === selectedNode.project : true;

        return (
          <line
            className={active ? "thought-link thought-link-active" : "thought-link image-link"}
            key={`image-link-${image.id}`}
            opacity={active ? 0.82 : sameActiveProject ? 0.42 : 0.2}
            stroke={projectLineColor(source.project, image.id, 1)}
            strokeWidth={attachmentLineWidth(active)}
            x1={sourceScreen.x}
            x2={targetScreen.x}
            y1={sourceScreen.y}
            y2={targetScreen.y}
          />
        );
      })}

      {linkNodes.map((link) => {
        const source = simNodeMap.get(link.linkedNodeId);
        if (!source) return null;

        const sourceScreen = screenPositionMap.get(link.linkedNodeId);
        const targetScreen = imageScreenPosition(link);
        if (!sourceScreen) return null;

        const active = selectedLinkId === link.id || selectedNodeId === link.linkedNodeId;
        const sameActiveProject = selectedNode ? source.project === selectedNode.project : true;

        return (
          <line
            className={active ? "thought-link thought-link-active" : "thought-link image-link"}
            key={`link-line-${link.id}`}
            opacity={active ? 0.82 : sameActiveProject ? 0.4 : 0.18}
            stroke={projectLineColor(source.project, link.id, 1)}
            strokeDasharray="3 7"
            strokeWidth={attachmentLineWidth(active)}
            x1={sourceScreen.x}
            x2={targetScreen.x}
            y1={sourceScreen.y}
            y2={targetScreen.y}
          />
        );
      })}
    </svg>
  );
}

export default memo(EdgeLayer);
