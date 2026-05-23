import type { GraphEdge } from "./types";

export type EdgeVisibilityMode = "whiteHall" | "focused" | "innerSpace";

export type EdgeVisibilityOptions = {
  focusedNodeId?: string | null;
  innerSpaceNodeIds?: Set<string>;
  mode?: EdgeVisibilityMode;
  hopDepth?: 1 | 2;
  maxVisibleEdgesPerNode?: number;
  maxVisibleSemanticEdges?: number;
  minSemanticScore?: number;
};

export type EdgeOpacityOptions = {
  focusedNodeId?: string | null;
  innerSpaceNodeIds?: Set<string>;
};

const DEFAULT_MIN_SEMANTIC_SCORE = 0.68;
const DEFAULT_MAX_VISIBLE_SEMANTIC_EDGES = 8;
const DEFAULT_MAX_VISIBLE_EDGES_PER_NODE = 4;

function isHierarchyEdge(edge: GraphEdge) {
  return edge.kind === "hierarchy" && !edge.generated;
}

function isTemporaryEdge(edge: GraphEdge) {
  return edge.kind === "temporary";
}

function isSemanticLikeEdge(edge: GraphEdge) {
  return edge.generated || edge.kind === "semantic" || edge.kind === "emotion" || edge.kind === "goal" || edge.kind === "action";
}

function edgeTouches(edge: GraphEdge, nodeIds: Set<string>) {
  return nodeIds.has(edge.source) || nodeIds.has(edge.target);
}

function buildHopNodeSet(edges: GraphEdge[], focusedNodeId: string, hopDepth: 1 | 2) {
  const nodeIds = new Set<string>([focusedNodeId]);
  const firstHop = new Set<string>();

  for (const edge of edges) {
    if (edge.source === focusedNodeId) firstHop.add(edge.target);
    if (edge.target === focusedNodeId) firstHop.add(edge.source);
  }

  for (const id of firstHop) nodeIds.add(id);
  if (hopDepth === 1) return nodeIds;

  for (const edge of edges) {
    if (firstHop.has(edge.source)) nodeIds.add(edge.target);
    if (firstHop.has(edge.target)) nodeIds.add(edge.source);
  }

  return nodeIds;
}

function limitEdgeDensity(edges: GraphEdge[], maxVisibleEdgesPerNode: number) {
  const counts = new Map<string, number>();
  const visible: GraphEdge[] = [];

  for (const edge of edges) {
    const sourceCount = counts.get(edge.source) ?? 0;
    const targetCount = counts.get(edge.target) ?? 0;
    if (sourceCount >= maxVisibleEdgesPerNode || targetCount >= maxVisibleEdgesPerNode) continue;

    visible.push(edge);
    counts.set(edge.source, sourceCount + 1);
    counts.set(edge.target, targetCount + 1);
  }

  return visible;
}

function uniqueEdges(edges: GraphEdge[]) {
  const seen = new Set<string>();
  const unique: GraphEdge[] = [];

  for (const edge of edges) {
    const key = [edge.source, edge.target].sort().join("-");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(edge);
  }

  return unique;
}

export function getVisibleEdges(edges: GraphEdge[], options: EdgeVisibilityOptions = {}) {
  const {
    focusedNodeId,
    innerSpaceNodeIds,
    mode = focusedNodeId ? "focused" : innerSpaceNodeIds?.size ? "innerSpace" : "whiteHall",
    hopDepth = mode === "innerSpace" ? 2 : 1,
    maxVisibleEdgesPerNode = DEFAULT_MAX_VISIBLE_EDGES_PER_NODE,
    maxVisibleSemanticEdges = mode === "innerSpace" ? 12 : DEFAULT_MAX_VISIBLE_SEMANTIC_EDGES,
    minSemanticScore = mode === "innerSpace" ? 0.52 : DEFAULT_MIN_SEMANTIC_SCORE,
  } = options;

  const hierarchyEdges = edges.filter(isHierarchyEdge);
  const temporaryEdges = edges.filter(isTemporaryEdge);

  if (mode === "whiteHall" || (!focusedNodeId && !innerSpaceNodeIds?.size)) {
    return uniqueEdges([...hierarchyEdges, ...temporaryEdges]);
  }

  const localNodeIds = innerSpaceNodeIds?.size
    ? innerSpaceNodeIds
    : focusedNodeId
      ? buildHopNodeSet(edges, focusedNodeId, hopDepth)
      : new Set<string>();

  const localSemanticEdges = edges
    .filter((edge) => isSemanticLikeEdge(edge))
    .filter((edge) => edge.score >= minSemanticScore)
    .filter((edge) => edgeTouches(edge, localNodeIds))
    .sort((a, b) => b.score - a.score);

  const densityLimitedSemanticEdges = limitEdgeDensity(localSemanticEdges, maxVisibleEdgesPerNode)
    .slice(0, maxVisibleSemanticEdges);

  return uniqueEdges([...hierarchyEdges, ...densityLimitedSemanticEdges, ...temporaryEdges]);
}

export function getEdgeOpacity(edge: GraphEdge, options: EdgeOpacityOptions = {}) {
  const focusedNodeId = options.focusedNodeId ?? null;
  const isFocused =
    Boolean(focusedNodeId && (edge.source === focusedNodeId || edge.target === focusedNodeId)) ||
    Boolean(options.innerSpaceNodeIds?.has(edge.source) || options.innerSpaceNodeIds?.has(edge.target));

  if (isTemporaryEdge(edge)) return isFocused ? 0.92 : 0.62;
  if (isHierarchyEdge(edge)) return isFocused ? 0.62 : 0.26;
  if (isSemanticLikeEdge(edge)) return isFocused ? 0.88 : 0.52;

  return isFocused ? 0.78 : 0.32;
}
