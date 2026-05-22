import type { GraphEdge } from "./types";

export function isHierarchyEdge(edge: GraphEdge) {
  return edge.kind === "hierarchy" && !edge.generated;
}

export function isSemanticEdge(edge: GraphEdge) {
  return edge.generated || edge.kind === "semantic" || edge.kind === "emotion" || edge.kind === "goal" || edge.kind === "action";
}

export function edgeStrokeColor(edge: GraphEdge, opacity: number, fallback: string) {
  if (isHierarchyEdge(edge)) return `rgba(255, 255, 255, ${opacity})`;
  if (isSemanticEdge(edge)) return `rgba(84, 168, 255, ${opacity})`;
  return fallback;
}

export function edgeStrokeWidth(edge: GraphEdge, active: boolean, defaultWidth: number) {
  if (isHierarchyEdge(edge)) return active ? Math.max(defaultWidth, 3.4) : Math.max(defaultWidth, 2.2);
  if (isSemanticEdge(edge)) return active ? Math.max(defaultWidth, 3.8) : Math.max(defaultWidth, 2.5);
  return active ? Math.max(defaultWidth, 2.8) : defaultWidth;
}
