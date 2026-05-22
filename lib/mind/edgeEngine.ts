import { calculateRelationScore } from "./relationScore";
import type { GraphEdge, ThoughtNodeLike } from "./types";

type LegacyGraphEdge = Partial<GraphEdge> & {
  id?: string;
  source: string;
  target: string;
  strength?: number;
};

type SemanticEdgeOptions = {
  minScore?: number;
  maxEdges?: number;
};

type EdgeVisibilityMode =
  | "whiteHall"
  | "selected"
  | "innerSpace"
  | {
      selectedNodeId?: string | null;
      innerSpaceNodeIds?: Set<string>;
      maxVisibleSemanticEdges?: number;
      minSemanticScore?: number;
    };

function edgeKey(source: string, target: string) {
  return [source, target].sort().join("-");
}

function normalizeEdge(edge: LegacyGraphEdge, fallbackKind: GraphEdge["kind"] = "hierarchy"): GraphEdge {
  return {
    id: edge.id ?? `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    strength: typeof edge.strength === "number" ? edge.strength : 1,
    kind: edge.kind ?? fallbackKind,
    score: typeof edge.score === "number" ? edge.score : typeof edge.strength === "number" ? Math.min(1, edge.strength / 3.2) : 1,
    reasons: Array.isArray(edge.reasons) ? edge.reasons : [fallbackKind],
    generated: Boolean(edge.generated),
    createdAt: edge.createdAt,
  };
}

export function sanitizeGraphEdges(edges: LegacyGraphEdge[], nodeIds: Set<string>) {
  const seen = new Set<string>();
  const sanitized: GraphEdge[] = [];

  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    if (edge.source === edge.target) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;

    const key = edgeKey(edge.source, edge.target);
    if (seen.has(key)) continue;
    seen.add(key);
    sanitized.push(normalizeEdge(edge));
  }

  return sanitized;
}

export function rebuildEdgesFromHierarchy(nodes: ThoughtNodeLike[]) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const rebuilt = new Map<string, GraphEdge>();

  for (const node of nodes) {
    if (!node.parentId || !nodeIds.has(node.parentId)) continue;
    const id = `${node.parentId}-${node.id}`;
    rebuilt.set(id, {
      id,
      source: node.parentId,
      target: node.id,
      strength: node.level === "detail" ? 2.2 : 3.2,
      kind: "hierarchy",
      score: 1,
      reasons: ["hierarchy"],
      generated: false,
    });
  }

  return [...rebuilt.values()];
}

export function generateSemanticEdges(nodes: ThoughtNodeLike[], options: SemanticEdgeOptions = {}) {
  const minScore = options.minScore ?? 0.36;
  const maxEdges = options.maxEdges ?? 80;
  const edges: GraphEdge[] = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const source = nodes[i];
      const target = nodes[j];
      if (source.parentId === target.id || target.parentId === source.id || source.parentId === target.parentId) continue;

      const relation = calculateRelationScore(source, target);
      if (relation.score < minScore) continue;

      edges.push({
        id: `generated-${relation.kind}-${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        strength: 0.9 + relation.score * 1.8,
        kind: relation.kind,
        score: relation.score,
        reasons: relation.reasons,
        generated: true,
      });
    }
  }

  return edges
    .sort((a, b) => b.score - a.score)
    .slice(0, maxEdges);
}

export function mergeGraphEdges(baseEdges: GraphEdge[], generatedEdges: GraphEdge[]) {
  const merged = new Map<string, GraphEdge>();

  for (const edge of baseEdges) {
    merged.set(edgeKey(edge.source, edge.target), normalizeEdge(edge));
  }

  for (const edge of generatedEdges) {
    const key = edgeKey(edge.source, edge.target);
    const existing = merged.get(key);
    if (existing && !existing.generated) continue;
    if (existing && existing.score >= edge.score) continue;
    merged.set(key, normalizeEdge(edge, edge.kind));
  }

  return [...merged.values()];
}

export function getVisibleEdges(edges: GraphEdge[], mode: EdgeVisibilityMode = "whiteHall") {
  const hierarchyEdges = edges.filter((edge) => edge.kind === "hierarchy" || !edge.generated);
  if (mode === "whiteHall") return hierarchyEdges;

  const selectedNodeId = typeof mode === "object" ? mode.selectedNodeId : null;
  const innerSpaceNodeIds = typeof mode === "object" ? mode.innerSpaceNodeIds : undefined;
  const maxVisibleSemanticEdges = typeof mode === "object" ? mode.maxVisibleSemanticEdges ?? 6 : mode === "innerSpace" ? 12 : 6;
  const minSemanticScore = typeof mode === "object" ? mode.minSemanticScore ?? 0.68 : mode === "innerSpace" ? 0.52 : 0.68;

  if (!selectedNodeId && !innerSpaceNodeIds?.size) return hierarchyEdges;

  const semanticEdges = edges
    .filter((edge) => {
      if (!edge.generated) return false;
      if (edge.score < minSemanticScore) return false;
      if (innerSpaceNodeIds?.size) return innerSpaceNodeIds.has(edge.source) || innerSpaceNodeIds.has(edge.target);
      return edge.source === selectedNodeId || edge.target === selectedNodeId;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxVisibleSemanticEdges);

  return mergeGraphEdges(hierarchyEdges, semanticEdges);
}
