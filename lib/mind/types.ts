export type GraphEdgeKind =
  | "hierarchy"
  | "semantic"
  | "emotion"
  | "goal"
  | "action"
  | "memory"
  | "timeline"
  | "resource"
  | "temporary";

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  strength: number;
  kind: GraphEdgeKind;
  score: number;
  reasons: string[];
  generated: boolean;
  createdAt?: string;
};

export type ThoughtPocketLike = {
  question?: string;
  triggerKeyword?: string;
  summary?: string;
  conflict?: string;
  logic?: string[];
  emotion?: string;
  conclusion?: string;
  associatedKeywords?: string[];
  reasoningFlow?: string[];
  nextQuestions?: string[];
  possibleConclusions?: string[];
  actionSuggestions?: string[];
};

export type ThoughtNodeLike = {
  id: string;
  project: string;
  label: string;
  level: "project" | "category" | "detail";
  parentId?: string;
  tokens?: string[];
  thoughtPocket?: ThoughtPocketLike;
};
