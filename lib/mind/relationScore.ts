import type { GraphEdge, GraphEdgeKind, ThoughtNodeLike } from "./types";

type RelationScoreResult = {
  score: number;
  kind: GraphEdge["kind"];
  reasons: string[];
};

const GENERIC_WORDS = new Set([
  "그리고",
  "하지만",
  "그래서",
  "나는",
  "있는",
  "있다",
  "한다",
  "했다",
  "것을",
  "대한",
  "위해",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
]);

function tokenizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}&\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !GENERIC_WORDS.has(word));
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean).map((value) => value.toLowerCase()))];
}

function overlapScore(a: string[], b: string[]) {
  const left = unique(a);
  const right = unique(b);
  if (left.length === 0 || right.length === 0) return 0;

  const rightSet = new Set(right);
  const shared = left.filter((item) => rightSet.has(item)).length;

  return shared / Math.max(left.length, right.length);
}

function pocketKeywords(node: ThoughtNodeLike) {
  return unique([
    ...(node.tokens ?? []),
    ...(node.thoughtPocket?.associatedKeywords ?? []),
    node.thoughtPocket?.triggerKeyword ?? "",
  ].flatMap(tokenizeText));
}

function questionTerms(node: ThoughtNodeLike) {
  return unique([
    node.thoughtPocket?.question ?? "",
    ...(node.thoughtPocket?.nextQuestions ?? []),
  ].flatMap(tokenizeText));
}

function actionTerms(node: ThoughtNodeLike) {
  return unique([
    ...(node.thoughtPocket?.actionSuggestions ?? []),
  ].flatMap(tokenizeText));
}

function summaryTerms(node: ThoughtNodeLike) {
  return unique([
    node.label,
    node.thoughtPocket?.summary ?? "",
    node.thoughtPocket?.conflict ?? "",
    node.thoughtPocket?.conclusion ?? "",
    ...(node.thoughtPocket?.reasoningFlow ?? []),
  ].flatMap(tokenizeText));
}

function labelScore(nodeA: ThoughtNodeLike, nodeB: ThoughtNodeLike) {
  return overlapScore(tokenizeText(nodeA.label), tokenizeText(nodeB.label));
}

function inferKind(nodeA: ThoughtNodeLike, nodeB: ThoughtNodeLike, reasons: string[]): GraphEdgeKind {
  const joined = [
    nodeA.thoughtPocket?.emotion,
    nodeB.thoughtPocket?.emotion,
    nodeA.thoughtPocket?.conclusion,
    nodeB.thoughtPocket?.conclusion,
    ...(nodeA.thoughtPocket?.actionSuggestions ?? []),
    ...(nodeB.thoughtPocket?.actionSuggestions ?? []),
    ...reasons,
  ].join(" ");

  if (/행동|실행|시도|만들|정리|추가|선택|결정/u.test(joined)) return "action";
  if (/목표|결론|판단|방향|도달/u.test(joined)) return "goal";
  if (/감정|불안|피로|욕구|회피|갈등|답답/u.test(joined)) return "emotion";

  return "semantic";
}

export function calculateRelationScore(nodeA: ThoughtNodeLike, nodeB: ThoughtNodeLike): RelationScoreResult {
  if (nodeA.id === nodeB.id) return { score: 0, kind: "semantic", reasons: [] };

  let score = 0;
  const reasons: string[] = [];

  if (nodeA.parentId && nodeA.parentId === nodeB.parentId) {
    score += 0.18;
    reasons.push("same parent");
  }

  if (nodeA.project && nodeA.project === nodeB.project) {
    score += 0.12;
    reasons.push("same project");
  }

  if (nodeA.level === nodeB.level) {
    score += 0.04;
    reasons.push("same level");
  }

  const labels = labelScore(nodeA, nodeB);
  if (labels > 0) {
    score += labels * 0.2;
    reasons.push("label overlap");
  }

  const summaries = overlapScore(summaryTerms(nodeA), summaryTerms(nodeB));
  if (summaries > 0) {
    score += summaries * 0.18;
    reasons.push("summary overlap");
  }

  const keywords = overlapScore(pocketKeywords(nodeA), pocketKeywords(nodeB));
  if (keywords > 0) {
    score += keywords * 0.2;
    reasons.push("associated keyword overlap");
  }

  const questions = overlapScore(questionTerms(nodeA), questionTerms(nodeB));
  if (questions > 0) {
    score += questions * 0.14;
    reasons.push("question overlap");
  }

  const actions = overlapScore(actionTerms(nodeA), actionTerms(nodeB));
  if (actions > 0) {
    score += actions * 0.12;
    reasons.push("action suggestion overlap");
  }

  const normalizedScore = Math.max(0, Math.min(1, Number(score.toFixed(3))));

  return {
    score: normalizedScore,
    kind: inferKind(nodeA, nodeB, reasons),
    reasons,
  };
}
