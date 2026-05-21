"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";

type NodeLevel = "project" | "category" | "detail";
type InputMode = "memo" | "question";

type ThoughtPocket = {
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

type AnalysisCategory = {
  title: string;
  summary: string;
  keywords: string[];
  thoughtPocket?: ThoughtPocket;
};

type SuggestedNode = {
  label: string;
  level: NodeLevel;
  parentLabel?: string;
};

type RelatedTextSnippet = {
  label: string;
  text: string;
};

type AnalysisDetail = {
  title: string;
  summary: string;
  keywords: string[];
  thoughtPocket?: ThoughtPocket;
};

type AnalysisResult = {
  projectTitle: string;
  projectSummary: string;
  categories: Array<AnalysisCategory & { details?: AnalysisDetail[] }>;
  keywords: string[];
  suggestedNodes: SuggestedNode[];
  relatedTextSnippets: RelatedTextSnippet[];
  thoughtPocket?: ThoughtPocket;
};

type ApiAnalysisResponse = {
  projectTitle: string;
  projectSummary: string;
  categories: Array<{
    title: string;
    summary: string;
    thoughtPocket?: ThoughtPocket;
    details: AnalysisDetail[];
  }>;
  keywords: string[];
  relatedSnippets: RelatedTextSnippet[];
  thoughtPocket?: ThoughtPocket;
};

type MemoItem = {
  id: string;
  text: string;
  keywords: string[];
  createdAt: string;
  updatedAt?: string;
  manualNodes?: ManualNode[];
  analysis?: AnalysisResult;
};

type ManualNode = {
  id: string;
  label: string;
  parentId: string;
  level: NodeLevel;
  color?: string;
};

type ThoughtNode = {
  id: string;
  memo: MemoItem;
  project: string;
  label: string;
  level: NodeLevel;
  parentId?: string;
  tokens: string[];
  color?: string;
  thoughtPocket?: ThoughtPocket;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  strength: number;
};

type SimNode = ThoughtNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pulse: number;
  locked?: boolean;
  fixed?: boolean;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
};

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

type Gaze = {
  x: number;
  y: number;
};

type SelectionRect = {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
};

type NodeImage = {
  id: string;
  src: string;
  name: string;
  createdAt: string;
  linkedNodeId?: string;
  keywords?: string[];
  prompt?: string;
  x?: number;
  y?: number;
  z?: number;
};

type ImageAsset = {
  id: string;
  src: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  fileName?: string;
  name?: string;
  createdAt?: string;
};

type LinkSource = "youtube" | "instagram" | "web";

type NodeLink = {
  id: string;
  type: "link";
  url: string;
  title?: string;
  thumbnailUrl?: string;
  source: LinkSource;
  linkedNodeId: string;
  createdAt: string;
  keywords?: string[];
  prompt?: string;
  x?: number;
  y?: number;
  z?: number;
};

type NodeOverride = {
  label?: string;
  color?: string;
  x?: number;
  y?: number;
  deleted?: boolean;
  images?: NodeImage[];
  links?: NodeLink[];
};

type DetailPosition = {
  x: number;
  y: number;
};

type StorageUsage = {
  bytes: number;
  limit: number;
  percent: number;
};

type LayerName = "input" | "index" | "detail";

type StoredLayout = {
  nodes?: Record<string, NodeOverride>;
  edges?: GraphEdge[];
  detail?: DetailPosition;
  input?: DetailPosition;
  index?: DetailPosition;
};

type BoardState = {
  memos: MemoItem[];
  nodeOverrides: Record<string, NodeOverride>;
  edges?: GraphEdge[];
  detailPosition: DetailPosition;
  inputPosition: DetailPosition;
  indexPosition: DetailPosition;
  collapsedIndexNodes: Record<string, boolean>;
  detailExpanded?: boolean;
};

type BoardSnapshot = {
  id: string;
  name: string;
  createdAt: string;
  data: BoardState;
  auto?: boolean;
};

type SharedBoardData = {
  board: BoardState;
  snapshots: BoardSnapshot[];
};

const STORAGE_KEY = "mind-orbit-memos";
const LAYOUT_STORAGE_KEY = "mind-orbit-layout";
const INDEX_STATE_STORAGE_KEY = "mind-orbit-index-state";
const SNAPSHOT_STORAGE_KEY = "mind-orbit-snapshots";
const HISTORY_STORAGE_KEY = "mind-orbit-history";
const IMAGE_ASSET_STORAGE_KEY = "mind-orbit-image-assets";
const GAZE_MODE_STORAGE_KEY = "mind-orbit-gaze-mode";
const PERFORMANCE_MODE_STORAGE_KEY = "mind-orbit-performance-mode";
const ANALYSIS_CACHE_STORAGE_KEY = "mind-orbit-analysis-cache";
const ANALYSIS_USAGE_STORAGE_KEY = "mind-orbit-analysis-usage";
const DAILY_ANALYSIS_LIMIT = 30;
const AI_ANALYSIS_MESSAGES = [
  "프로젝트 경계 분석 중...",
  "키워드 그룹 정리 중...",
  "문맥 연결 분석 중...",
  "중복 개념 제거 중...",
  "실행 단위 구조화 중...",
  "프로젝트 요약 생성 중...",
];
const LOCAL_STORAGE_ESTIMATED_LIMIT = 5 * 1024 * 1024;
const MAX_SNAPSHOTS = 3;
const MAX_HISTORY = 5;
const DEPTH_STRENGTH = 170;
const CURVE_STRENGTH = 11;
const FOCUS_ZOOM_STRENGTH = 120;
const SPACE_TILT_STRENGTH = 3.6;
const GAZE_PARALLAX_STRENGTH = 5.2;
const PERSPECTIVE_DEPTH = 1180;
const EDGE_DISTORTION_STRENGTH = 0.1;
const AUTO_PAN_MAX_SPEED = 24;
const AUTO_PAN_DEADZONE = 0.18;
const AUTO_PAN_STRENGTH = 1;
const FLOATING_INTERACTION_SELECTOR =
  ".ui-layer, .interaction-safe-zone, .floating-action-layer, .input-layer, .keyword-index, .detail-layer, .control-layer, .interaction-guide, .history-panel, .link-modal-overlay, .image-modal-overlay";
const colorLabels = ["graphite", "mist", "iris", "moss", "clay"];
const knownProjects = ["HanVino", "Nick&Nicole", "Mind Orbit"];
const strongConceptLabels = new Set(["ai", "codex", "hanvino", "nick&nicole", "mind orbit", "openai", "supabase", "next.js"]);
const fallbackProjects = ["Mind Orbit", "Inner Work", "Open Thread"];
const fallbackCategories = ["기획", "연결", "기록", "전환", "실험"];
const projectLinePalette = [
  { key: "hanvino", hue: 354, saturation: 36, lightness: 50 },
  { key: "mind orbit", hue: 214, saturation: 22, lightness: 42 },
  { key: "nick&nicole", hue: 342, saturation: 27, lightness: 58 },
  { key: "nick nicole", hue: 342, saturation: 27, lightness: 58 },
  { key: "ai factory", hue: 188, saturation: 34, lightness: 48 },
  { key: "sage", hue: 126, saturation: 18, lightness: 48 },
  { key: "gold", hue: 42, saturation: 34, lightness: 52 },
  { key: "lavender", hue: 262, saturation: 21, lightness: 56 },
];
const fallbackLinePalette = [
  { hue: 214, saturation: 22, lightness: 42 },
  { hue: 354, saturation: 34, lightness: 50 },
  { hue: 126, saturation: 18, lightness: 48 },
  { hue: 42, saturation: 34, lightness: 52 },
  { hue: 342, saturation: 27, lightness: 58 },
  { hue: 188, saturation: 32, lightness: 48 },
  { hue: 262, saturation: 21, lightness: 56 },
  { hue: 28, saturation: 24, lightness: 50 },
];
const genericWords = new Set([
  "콘텐츠",
  "브랜드",
  "제작",
  "시스템",
  "프로젝트",
  "생각",
  "구조",
  "메모",
  "아이디어",
  "사용자",
  "기능",
  "앱",
  "그리고",
  "하지만",
  "그래서",
  "나는",
  "오늘",
  "내일",
  "있다",
  "했다",
  "한다",
  "위해",
  "대한",
  "것을",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
]);

const abstractKeywordFragments = [
  "가능",
  "결론",
  "구조",
  "감정",
  "갈등",
  "동력",
  "기제",
  "동인",
  "동기",
  "배경",
  "병목",
  "불안",
  "사고",
  "실행",
  "심층",
  "심리",
  "전략",
  "증상",
  "욕망",
  "의존",
  "인정",
  "자아",
  "집착",
  "충동",
  "회피",
];
const abstractCategoryQuestions: Record<string, string> = {
  배경: "이 생각은 어떤 상황에서 처음 강해졌는가?",
  핵심: "이 사고가 계속 붙잡는 핵심 질문은 무엇인가?",
  증상: "어떤 반복 패턴이 지금의 문제를 드러내는가?",
  외적동기: "외부 인정은 왜 이 생각을 더 강하게 만드는가?",
  심층동기: "이 생각 뒤에 숨어 있는 욕구는 무엇인가?",
  실행: "이 생각은 어떤 구체적 행동으로 이어져야 하는가?",
  결론: "현재 내가 도달한 판단은 무엇이며 무엇을 남기는가?",
  동기: "나는 무엇에 의해 움직이고 무엇을 피하려 하는가?",
  구조: "이 생각을 실행으로 바꾸려면 어떤 연결 구조가 필요한가?",
  전략: "이 판단은 어떤 실행 방향으로 이어져야 하는가?",
  심리적원인: "결과보다 과정 피로가 더 크게 느껴지는 이유는 무엇인가?",
  패턴요약: "생각은 빠른데 실행은 항상 늦어지는 패턴이 반복된다",
  실행장애: "작업량이 커질수록 시작 자체를 회피하게 된다",
  행동마찰: "실행으로 넘어가는 순간마다 작은 마찰이 크게 느껴진다",
};
const incompleteNodeEndings = ["하고", "하며", "인지", "지만", "거나", "때문일까", "때문에", "위해", "라서", "에서", "으로", "로", "을", "를", "은", "는", "이", "가"];

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}&\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !genericWords.has(word));
}

function cleanPhrase(text: string) {
  return text
    .replace(/[^\p{L}\p{N}&\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAbstractKeyword(label: string) {
  const normalized = label.trim();
  if (!normalized) return false;
  const key = normalized.toLowerCase();
  if (strongConceptLabels.has(key)) return false;
  if (knownProjects.some((project) => project.toLowerCase() === key)) return false;
  if (/[A-Z&.]/.test(normalized)) return false;
  if (/\s/.test(normalized)) return false;
  if (normalized.length > 8) return false;
  if (!/[가-힣]/.test(normalized)) return false;

  return abstractKeywordFragments.some((fragment) => normalized.includes(fragment));
}

function isIncompleteNodeLabel(label: string) {
  const normalized = label.trim().replace(/[.?!。！？]+$/u, "");
  if (!normalized) return true;
  const key = normalized.toLowerCase();
  if (strongConceptLabels.has(key)) return true;
  if (abstractCategoryQuestions[normalized]) return true;
  if (normalized.length < 18) return true;
  return incompleteNodeEndings.some((ending) => normalized.endsWith(ending));
}

function expandNodeLabel(label: string, context = "") {
  const normalized = label.trim();
  if (abstractCategoryQuestions[normalized]) return abstractCategoryQuestions[normalized];
  if (!isAbstractKeyword(normalized)) return normalized;
  const contextKey = context.toLowerCase();

  if (normalized.includes("외적") || normalized.includes("인정")) {
    return "나는 왜 외부 인정에 강하게 반응하는가?";
  }
  if (normalized.includes("심리") || normalized.includes("기제")) {
    if (contextKey.includes("ai") || context.includes("자동화")) {
      return "AI 자동화에 집착하게 되는 내면 심리는 무엇인가?";
    }
    return "이 행동을 반복하게 만드는 내면 심리는 무엇인가?";
  }
  if (normalized.includes("동기")) {
    return "나는 무엇에 의해 움직이고 있는가?";
  }
  if (normalized.includes("불안")) {
    return "이 불안은 무엇을 보호하려는 신호인가?";
  }
  if (normalized.includes("회피")) {
    return "나는 무엇을 마주하지 않기 위해 우회하고 있는가?";
  }
  if (normalized.includes("집착")) {
    return "나는 왜 이 생각을 쉽게 놓지 못하는가?";
  }
  if (normalized.includes("갈등")) {
    return "내 안에서 충돌하는 욕구는 무엇인가?";
  }
  if (normalized.includes("감정")) {
    return "이 감정은 어떤 판단이나 욕구에서 생겨나는가?";
  }

  return `${normalized}은 지금 내 사고에서 어떤 질문으로 이어지는가?`;
}

function compactThoughtState(value: string) {
  return value
    .replace(/^나는\s*/u, "")
    .replace(/하게 되었을까\?/u, "하는가?")
    .replace(/하게 되었는가\?/u, "하는가?")
    .replace(/되었을까\?/u, "되었는가?")
    .replace(/\s+/g, " ")
    .trim();
}

function cognitiveFallbackLabel(fallback: string, context = "") {
  const expanded = expandNodeLabel(fallback, context);
  if (expanded !== fallback && expanded.length >= 18) return expanded;
  const contextKey = context.toLowerCase();

  if (contextKey.includes("ai") || context.includes("자동화")) {
    return "생각은 빠른데 실행은 항상 늦어지는 상태가 반복된다";
  }
  if (fallback.includes("실행")) return "작업량이 커질수록 시작 자체를 회피하게 된다";
  if (fallback.includes("심리") || fallback.includes("원인")) return "결과보다 과정 피로가 더 크게 느껴진다";
  if (fallback.includes("패턴")) return "생각은 빠른데 실행은 항상 늦어지는 패턴이 반복된다";

  return "이 생각은 아직 말로 정리되지 않은 인지 상태로 남아 있다";
}

function thoughtStateLabelFromPocket(pocket: ThoughtPocket | undefined, fallback: string, context = "") {
  const candidates = [
    pocket?.question,
    pocket?.conclusion,
    pocket?.summary,
    ...(pocket?.reasoningFlow ?? []),
    expandNodeLabel(fallback, context),
  ];
  const selected = candidates.find((candidate) => {
    if (!candidate) return false;
    const compact = compactThoughtState(candidate);
    return compact.length >= 18 && !isIncompleteNodeLabel(compact);
  });
  const label = compactThoughtState(selected ?? expandNodeLabel(fallback, context));
  if (!isIncompleteNodeLabel(label)) return label.length > 42 ? `${label.slice(0, 40).trim()}...` : label;
  if (strongConceptLabels.has(fallback.trim().toLowerCase())) return `${fallback.trim()}은 어떤 사고 상태를 가리키는가?`;
  return cognitiveFallbackLabel(fallback, context);
}

function uniqueLabels(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function normalizeThoughtPocket(value: unknown): ThoughtPocket | undefined {
  if (!value || typeof value !== "object") return undefined;
  const pocket = value as Partial<ThoughtPocket>;
  const normalized: ThoughtPocket = {};

  if (typeof pocket.question === "string" && pocket.question.trim()) normalized.question = pocket.question;
  if (typeof pocket.triggerKeyword === "string" && pocket.triggerKeyword.trim()) normalized.triggerKeyword = pocket.triggerKeyword;
  if (typeof pocket.summary === "string" && pocket.summary.trim()) normalized.summary = pocket.summary;
  if (typeof pocket.conflict === "string" && pocket.conflict.trim()) normalized.conflict = pocket.conflict;
  if (typeof pocket.emotion === "string" && pocket.emotion.trim()) normalized.emotion = pocket.emotion;
  if (typeof pocket.conclusion === "string" && pocket.conclusion.trim()) normalized.conclusion = pocket.conclusion;

  const logic = stringArray(pocket.logic);
  const associatedKeywords = stringArray(pocket.associatedKeywords);
  const reasoningFlow = stringArray(pocket.reasoningFlow);
  const nextQuestions = stringArray(pocket.nextQuestions);
  const possibleConclusions = stringArray(pocket.possibleConclusions);
  const actionSuggestions = stringArray(pocket.actionSuggestions);

  if (logic.length > 0) normalized.logic = logic;
  if (associatedKeywords.length > 0) normalized.associatedKeywords = associatedKeywords;
  if (reasoningFlow.length > 0) normalized.reasoningFlow = reasoningFlow;
  if (nextQuestions.length > 0) normalized.nextQuestions = nextQuestions;
  if (possibleConclusions.length > 0) normalized.possibleConclusions = possibleConclusions;
  if (actionSuggestions.length > 0) normalized.actionSuggestions = actionSuggestions;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeAnalysis(value: unknown): AnalysisResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  const analysis = value as Partial<AnalysisResult>;
  const projectTitle = typeof analysis.projectTitle === "string" ? analysis.projectTitle : "";
  const projectSummary = typeof analysis.projectSummary === "string" ? analysis.projectSummary : "";

  if (!projectTitle && !projectSummary) return undefined;

  return {
    projectTitle,
    projectSummary,
    categories: Array.isArray(analysis.categories)
      ? analysis.categories.map((category) => ({
          title: typeof category.title === "string" ? category.title : "Untitled",
          summary: typeof category.summary === "string" ? category.summary : "",
          keywords: stringArray(category.keywords),
          thoughtPocket: normalizeThoughtPocket(category.thoughtPocket),
          details: Array.isArray(category.details)
            ? category.details.map((detail) => ({
                title: typeof detail.title === "string" ? detail.title : "Untitled",
                summary: typeof detail.summary === "string" ? detail.summary : "",
                keywords: stringArray(detail.keywords),
                thoughtPocket: normalizeThoughtPocket(detail.thoughtPocket),
              }))
            : [],
        }))
      : [],
    keywords: stringArray(analysis.keywords),
    suggestedNodes: Array.isArray(analysis.suggestedNodes)
      ? analysis.suggestedNodes.map((node) => ({
          label: typeof node.label === "string" ? node.label : "새 생각",
          level: node.level === "project" || node.level === "category" || node.level === "detail" ? node.level : "detail",
          parentLabel: typeof node.parentLabel === "string" ? node.parentLabel : undefined,
        }))
      : [],
    relatedTextSnippets: Array.isArray(analysis.relatedTextSnippets)
      ? analysis.relatedTextSnippets.map((snippet) => ({
          label: typeof snippet.label === "string" ? snippet.label : "",
          text: typeof snippet.text === "string" ? snippet.text : "",
        }))
      : [],
    thoughtPocket: normalizeThoughtPocket(analysis.thoughtPocket),
  };
}

function normalizeMemo(value: Partial<MemoItem>, index: number): MemoItem {
  const text = typeof value.text === "string" ? value.text : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString();
  const id =
    typeof value.id === "string" && value.id.trim()
      ? value.id
      : `memo-${hashString(`${text}-${createdAt}`)}-${index}`;
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : undefined;
  const keywords = Array.isArray(value.keywords)
    ? value.keywords.filter((keyword): keyword is string => typeof keyword === "string")
    : [];
  const manualNodes = Array.isArray(value.manualNodes)
    ? value.manualNodes
        .filter((node) => Boolean(node) && typeof node === "object")
        .map((node, nodeIndex) => {
          const manualNode = node as Partial<ManualNode>;

          return {
            id: typeof manualNode.id === "string" && manualNode.id ? manualNode.id : `${id}-manual-${nodeIndex}`,
            label: typeof manualNode.label === "string" && manualNode.label ? manualNode.label : "새 생각",
            parentId: typeof manualNode.parentId === "string" ? manualNode.parentId : "",
            level: manualNode.level === "project" || manualNode.level === "category" || manualNode.level === "detail" ? manualNode.level : "detail",
            color: typeof manualNode.color === "string" ? manualNode.color : undefined,
          };
        })
        .filter((node) => node.parentId)
    : undefined;

  return { id, text, keywords, createdAt, updatedAt, manualNodes, analysis: normalizeAnalysis(value.analysis) };
}

function detectProject(text: string, memoIndex: number) {
  const known = knownProjects.find((project) => text.toLowerCase().includes(project.toLowerCase()));
  if (known) return known;

  const named = text.match(/\b[A-Z][A-Za-z0-9&]*(?:\s+[A-Z][A-Za-z0-9&]*){0,2}\b/u)?.[0];
  if (named && !["AI"].includes(named)) return named;

  return fallbackProjects[memoIndex % fallbackProjects.length];
}

function makeSymbolicLabel(text: string, fallback: string) {
  const words = tokenize(text);
  const compact = uniqueLabels(words).slice(0, 3);
  if (compact.length === 0) return fallback;

  return compact
    .map((word) => {
      if (word === "ai") return "AI";
      return word.length > 12 ? word.slice(0, 12) : word;
    })
    .join(" ");
}

function extractStructure(memo: MemoItem, memoIndex: number) {
  if (memo.analysis) {
    const project = memo.analysis.projectTitle || detectProject(memo.text, memoIndex);
    const categories = (memo.analysis.categories.length > 0 ? memo.analysis.categories : [{ title: project, summary: "", keywords: memo.analysis.keywords }])
      .slice(0, 3)
      .map((category, categoryIndex) => ({
        label: category.title,
        details: uniqueLabels(
          category.details && category.details.length > 0
            ? category.details.map((detail) => detail.title)
            : category.keywords.length > 0
              ? category.keywords
              : memo.analysis?.keywords ?? [],
        ).slice(0, 3),
        index: categoryIndex,
      }));

    return {
      project,
      categories: categories.map((category) => ({
        ...category,
        details: category.details.length > 0 ? category.details : [`${category.label} 1`],
      })),
    };
  }

  const project = detectProject(memo.text, memoIndex);
  const clauses = memo.text
    .split(/[\n.!?。！？,，;；:：]+/u)
    .map(cleanPhrase)
    .filter(Boolean);
  const sources = clauses.length > 0 ? clauses : [memo.text];
  const categoryLabels = uniqueLabels(
    sources.map((clause, index) => makeSymbolicLabel(clause.replace(project, ""), fallbackCategories[index % fallbackCategories.length])),
  )
    .filter((label) => label.toLowerCase() !== project.toLowerCase())
    .slice(0, 3);
  const categories = uniqueLabels([...categoryLabels, ...fallbackCategories]).slice(0, 3);

  return {
    project,
    categories: categories.map((category, categoryIndex) => {
      const categoryTokens = tokenize(category);
      const detailSources = sources.filter((source) => {
        const sourceTokens = tokenize(source);
        return categoryTokens.some((token) => sourceTokens.includes(token));
      });
      const details = uniqueLabels((detailSources.length > 0 ? detailSources : sources).map((source, detailIndex) => {
        const label = makeSymbolicLabel(
          tokenize(source)
            .filter((token) => !categoryTokens.includes(token))
            .join(" "),
          `${category} ${detailIndex + 1}`,
        );
        return label === category ? `${category} ${detailIndex + 1}` : label;
      })).slice(0, 2);

      return {
        label: category,
        details: details.length > 0 ? details : [`${category} 1`],
        index: categoryIndex,
      };
    }),
  };
}

function similarity(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let shared = 0;

  for (const token of setA) {
    if (setB.has(token)) shared += 1;
  }

  return shared / Math.max(setA.size, setB.size);
}

function projectAnchor(index: number, total: number) {
  const spacing = 720;
  const start = -((total - 1) * spacing) / 2;
  const y = index % 2 === 0 ? -80 : 120;

  return { x: start + index * spacing, y };
}

function sanitizeGraphEdges(edges: GraphEdge[], nodeIds: Set<string>) {
  const seen = new Set<string>();
  const sanitized: GraphEdge[] = [];

  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    if (edge.source === edge.target) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;

    const key = [edge.source, edge.target].sort().join("-");
    if (seen.has(key)) continue;
    seen.add(key);
    sanitized.push(edge);
  }

  return sanitized;
}

function rebuildEdgesFromHierarchy(nodes: Array<ThoughtNode | SimNode>) {
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
    });
  }

  return [...rebuilt.values()];
}

function buildThoughtGraph(memos: MemoItem[]) {
  const structures = memos.map((memo, index) => ({ memo, structure: extractStructure(memo, index) }));
  const projectCounts = new Map<string, number>();
  const projectNames: string[] = [];
  const nodes: ThoughtNode[] = [];
  const edges = new Map<string, GraphEdge>();
  const projectNodeByMemo = new Map<string, ThoughtNode>();

  structures.forEach(({ memo, structure }, projectIndex) => {
    const count = projectCounts.get(structure.project) ?? 0;
    projectCounts.set(structure.project, count + 1);
    const project = count === 0 ? structure.project : `${structure.project} ${count + 1}`;

    const nodeLabel = thoughtStateLabelFromPocket(memo.analysis?.thoughtPocket, project, memo.text);
    const node: ThoughtNode = {
      id: `${memo.id}-project-${hashString(project)}-${projectIndex}`,
      memo,
      project,
      label: nodeLabel,
      level: "project",
      tokens: tokenize([project, nodeLabel, ...(memo.analysis?.thoughtPocket?.reasoningFlow ?? [])].join(" ")),
      thoughtPocket: memo.analysis?.thoughtPocket,
    };

    projectNames.push(project);
    projectNodeByMemo.set(memo.id, node);
    nodes.push(node);
  });

  for (const { memo, structure } of structures) {
    const projectNode = projectNodeByMemo.get(memo.id);
    if (!projectNode) continue;

    let previousCategoryId = projectNode.id;
    structure.categories.forEach((category, categoryIndex) => {
      const categoryId = `${memo.id}-category-${categoryIndex}-${hashString(`${projectNode.project}-${category.label}`)}`;
      const analysisCategory = memo.analysis?.categories.find((item) => item.title === category.label);
      const categoryLabel = thoughtStateLabelFromPocket(analysisCategory?.thoughtPocket, category.label, memo.text);
      const categoryNode: ThoughtNode = {
        id: categoryId,
        memo,
        project: projectNode.project,
        label: categoryLabel,
        level: "category",
        parentId: projectNode.id,
        tokens: tokenize([category.label, categoryLabel, ...(analysisCategory?.thoughtPocket?.reasoningFlow ?? []), ...(analysisCategory?.thoughtPocket?.associatedKeywords ?? [])].join(" ")),
        thoughtPocket: analysisCategory?.thoughtPocket,
      };

      nodes.push(categoryNode);
      edges.set(`${projectNode.id}-${categoryId}`, {
        id: `${projectNode.id}-${categoryId}`,
        source: projectNode.id,
        target: categoryId,
        strength: 3.2,
      });
      if (previousCategoryId !== projectNode.id) {
        edges.set(`${previousCategoryId}-${categoryId}-flow`, {
          id: `${previousCategoryId}-${categoryId}-flow`,
          source: previousCategoryId,
          target: categoryId,
          strength: 2.8,
        });
      }
      previousCategoryId = categoryId;

      let previousFlowId = categoryId;
      category.details.forEach((detail, detailIndex) => {
        const detailId = `${memo.id}-detail-${categoryIndex}-${detailIndex}-${hashString(detail)}`;
        const analysisDetail = analysisCategory?.details?.find((item) => item.title === detail);
        const detailLabel = thoughtStateLabelFromPocket(analysisDetail?.thoughtPocket, detail, memo.text);
        const detailNode: ThoughtNode = {
          id: detailId,
          memo,
          project: projectNode.project,
          label: detailLabel,
          level: "detail",
          parentId: categoryId,
          tokens: tokenize([detail, detailLabel, ...(analysisDetail?.thoughtPocket?.reasoningFlow ?? []), ...(analysisDetail?.thoughtPocket?.associatedKeywords ?? [])].join(" ")),
          thoughtPocket: analysisDetail?.thoughtPocket,
        };

        nodes.push(detailNode);
        edges.set(`${categoryId}-${detailId}`, {
          id: `${categoryId}-${detailId}`,
          source: categoryId,
          target: detailId,
          strength: 2.2,
        });
        if (previousFlowId !== categoryId) {
          edges.set(`${previousFlowId}-${detailId}-flow`, {
            id: `${previousFlowId}-${detailId}-flow`,
            source: previousFlowId,
            target: detailId,
            strength: 2.4,
          });
        }
        previousFlowId = detailId;
      });
    });
  }

  for (const memo of memos) {
    for (const manual of memo.manualNodes ?? []) {
      const parent = nodes.find((node) => node.id === manual.parentId);
      if (!parent) continue;

      const manualNode: ThoughtNode = {
        id: manual.id,
        memo,
        project: parent.project,
        label: manual.label,
        level: manual.level,
        parentId: parent.id,
        tokens: tokenize(manual.label),
        color: manual.color,
      };

      nodes.push(manualNode);
      edges.set(`${parent.id}-${manual.id}`, {
        id: `${parent.id}-${manual.id}`,
        source: parent.id,
        target: manual.id,
        strength: 2.5,
      });
    }
  }

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.parentId === b.id || b.parentId === a.id || a.parentId === b.parentId) continue;

      const score = similarity(a.tokens, b.tokens);
      if (score < 0.42) continue;

      edges.set(`${a.id}-${b.id}`, {
        id: `${a.id}-${b.id}`,
        source: a.id,
        target: b.id,
        strength: 1.2 + score * 1.7,
      });
    }
  }

  return { nodes, edges: sanitizeGraphEdges([...edges.values()], new Set(nodes.map((node) => node.id))), projects: projectNames };
}

function getInitialNode(node: ThoughtNode, index: number, projectIndex: number, projectTotal: number): SimNode {
  const hash = hashString(node.id);
  const anchor = projectAnchor(projectIndex, projectTotal);

  if (node.level === "project") {
    return {
      ...node,
      x: anchor.x,
      y: anchor.y,
      vx: 0,
      vy: 0,
      pulse: 0.5,
    };
  }

  const angle = ((hash % 360) / 180) * Math.PI;
  const radius = node.level === "category" ? 230 : 410;

  return {
    ...node,
    x: anchor.x + Math.cos(angle) * (radius + (index % 3) * 42),
    y: anchor.y + Math.sin(angle) * (radius * 0.68),
    vx: (Math.sin(hash) - 0.5) * 0.5,
    vy: (Math.cos(hash) - 0.5) * 0.5,
    pulse: (hash % 100) / 100,
  };
}

function nodeClass(level: NodeLevel, selected: boolean, dimmed: boolean) {
  const levelClass = {
    project: "thought-project",
    category: "thought-category",
    detail: "thought-detail",
  }[level];

  return `thought-node ${levelClass} ${selected ? "thought-selected" : ""} ${dimmed ? "thought-dimmed" : ""}`;
}

function colorClass(color?: string) {
  return `thought-color-${colorLabels.includes(color ?? "") ? color : "graphite"}`;
}

function projectLineBase(project: string) {
  const normalized = project.toLowerCase();
  const named = projectLinePalette.find((color) => normalized.includes(color.key));
  if (named) return named;

  return fallbackLinePalette[hashString(project) % fallbackLinePalette.length];
}

function projectLineColor(project: string, seed: string, opacity: number) {
  const base = projectLineBase(project);
  const hash = hashString(`${project}-${seed}`);
  const hue = base.hue + (hash % 13) - 6;
  const lightness = clamp(base.lightness + ((hash >> 3) % 11) - 5, 34, 64);
  const saturation = clamp(base.saturation + ((hash >> 5) % 7) - 3, 16, 42);

  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`;
}

function edgeLineWidth(source: SimNode, target: SimNode, active: boolean) {
  const levels = new Set([source.level, target.level]);
  if (levels.has("project") && levels.has("category")) return active ? 3.4 : 2.45;
  if (levels.has("category") && levels.has("detail")) return active ? 2.55 : 1.85;
  return active ? 2.05 : 1.3;
}

function attachmentLineWidth(active: boolean) {
  return active ? 2.05 : 1.15;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function storageByteSize(value: string) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
  return value.length * 2;
}

function readStorageUsage(): StorageUsage {
  if (typeof window === "undefined") {
    return { bytes: 0, limit: LOCAL_STORAGE_ESTIMATED_LIMIT, percent: 0 };
  }

  const bytes = [STORAGE_KEY, LAYOUT_STORAGE_KEY, INDEX_STATE_STORAGE_KEY, SNAPSHOT_STORAGE_KEY, HISTORY_STORAGE_KEY, IMAGE_ASSET_STORAGE_KEY, GAZE_MODE_STORAGE_KEY, PERFORMANCE_MODE_STORAGE_KEY, ANALYSIS_CACHE_STORAGE_KEY, ANALYSIS_USAGE_STORAGE_KEY].reduce(
    (total, key) => total + storageByteSize(window.localStorage.getItem(key) ?? ""),
    0,
  );

  return {
    bytes,
    limit: LOCAL_STORAGE_ESTIMATED_LIMIT,
    percent: clamp((bytes / LOCAL_STORAGE_ESTIMATED_LIMIT) * 100, 0, 100),
  };
}

function formatStorageSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatSnapshotName(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function cloneBoardState(state: BoardState): BoardState {
  return JSON.parse(JSON.stringify(state)) as BoardState;
}

function lightweightBoardState(state: BoardState): BoardState {
  saveImageAssetsFromOverrides(state.nodeOverrides);

  const compactOverrides = Object.fromEntries(
    Object.entries(state.nodeOverrides ?? {}).map(([nodeId, override]) => [
      nodeId,
      {
        ...override,
        images: override.images?.map((image) => ({
          id: image.id,
          src: "",
          name: image.name,
          createdAt: image.createdAt,
          linkedNodeId: image.linkedNodeId,
          keywords: image.keywords,
          prompt: image.prompt,
          x: image.x,
          y: image.y,
          z: image.z,
        })),
        links: override.links?.map((link) => ({
          ...link,
          thumbnailUrl: link.thumbnailUrl?.startsWith("data:") ? undefined : link.thumbnailUrl,
        })),
      },
    ]),
  );

  return cloneBoardState({
    ...state,
    nodeOverrides: compactOverrides,
  });
}

function loadImageAssets(): Record<string, ImageAsset> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(IMAGE_ASSET_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, ImageAsset>;
  } catch (error) {
    console.warn("Mind Orbit image assets could not be read.", error);
    return {};
  }
}

function saveImageAssets(assets: Record<string, ImageAsset>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(IMAGE_ASSET_STORAGE_KEY, JSON.stringify(assets));
  } catch (error) {
    console.warn("Mind Orbit skipped image asset storage.", error);
  }
}

function saveImageAsset(asset: ImageAsset) {
  if (!asset.id || !asset.src) return;

  const assets = loadImageAssets();
  assets[asset.id] = {
    ...assets[asset.id],
    ...asset,
    src: asset.src,
  };
  saveImageAssets(assets);
}

function saveImageAssetsFromOverrides(overrides: Record<string, NodeOverride> = {}) {
  if (typeof window === "undefined") return;

  const assets = loadImageAssets();
  let changed = false;

  for (const override of Object.values(overrides)) {
    for (const image of override.images ?? []) {
      if (!image.id || !image.src) continue;
      const previous = assets[image.id];
      if (previous?.src === image.src && previous?.fileName === image.name && previous?.createdAt === image.createdAt) continue;
      assets[image.id] = {
        ...previous,
        id: image.id,
        src: image.src,
        fileName: image.name,
        name: image.name,
        createdAt: image.createdAt,
      };
      changed = true;
    }
  }

  if (changed) saveImageAssets(assets);
}

function hydrateImageNode(image: NodeImage): NodeImage {
  const asset = loadImageAssets()[image.id];

  return {
    ...image,
    src: image.src || asset?.src || "",
    name: image.name || asset?.fileName || asset?.name || "Image",
    createdAt: image.createdAt || asset?.createdAt || new Date().toISOString(),
  };
}

function hydrateImageNodes(images: NodeImage[] = []) {
  return images.map((image) => hydrateImageNode(image));
}

function hydrateNodeOverrides(overrides: Record<string, NodeOverride> = {}) {
  return Object.fromEntries(
    Object.entries(overrides).map(([nodeId, override]) => [
      nodeId,
      {
        ...override,
        images: hydrateImageNodes(override.images ?? []),
      },
    ]),
  );
}

function mergeMediaSources(incoming: Record<string, NodeOverride>, current: Record<string, NodeOverride>) {
  saveImageAssetsFromOverrides(current);
  saveImageAssetsFromOverrides(incoming);

  const assetMap = loadImageAssets();
  const imageById = new Map<string, NodeImage>();
  const linkById = new Map<string, NodeLink>();

  for (const override of Object.values(current)) {
    for (const image of override.images ?? []) {
      imageById.set(image.id, image);
    }
    for (const link of override.links ?? []) {
      linkById.set(link.id, link);
    }
  }

  const nodeIds = new Set([...Object.keys(current ?? {}), ...Object.keys(incoming ?? {})]);
  const merged: Record<string, NodeOverride> = {};

  for (const nodeId of nodeIds) {
    const currentOverride = current[nodeId] ?? {};
    const incomingOverride = incoming[nodeId] ?? {};
    const imageMap = new Map<string, NodeImage>();
    const linkMap = new Map<string, NodeLink>();

    for (const image of currentOverride.images ?? []) {
      imageMap.set(image.id, image);
    }
    for (const image of incomingOverride.images ?? []) {
      const original = imageById.get(image.id);
      const asset = assetMap[image.id];
      imageMap.set(image.id, {
        ...image,
        src: original?.src || image.src || asset?.src || "",
        name: original?.name || image.name,
        createdAt: original?.createdAt || image.createdAt,
        keywords: original?.keywords || image.keywords,
        prompt: original?.prompt || image.prompt,
      });
    }

    for (const link of currentOverride.links ?? []) {
      linkMap.set(link.id, link);
    }
    for (const link of incomingOverride.links ?? []) {
      const original = linkById.get(link.id);
      linkMap.set(link.id, {
        ...link,
        url: original?.url || link.url,
        title: original?.title || link.title,
        thumbnailUrl: original?.thumbnailUrl || link.thumbnailUrl,
        source: original?.source || link.source,
        createdAt: original?.createdAt || link.createdAt,
        keywords: original?.keywords || link.keywords,
        prompt: original?.prompt || link.prompt,
      });
    }

    merged[nodeId] = {
      ...currentOverride,
      ...incomingOverride,
      images: [...imageMap.values()].map((image) => hydrateImageNode(image)),
      links: [...linkMap.values()].filter((link) => link.url),
    };
  }

  return merged;
}

function sanitizeLoadedBoard(board: Partial<BoardState>, currentOverrides: Record<string, NodeOverride> = {}) {
  const memos = Array.isArray(board.memos) ? board.memos.map((memo, index) => normalizeMemo(memo, index)) : [];
  const graph = buildThoughtGraph(memos);
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const mergedOverrides = hydrateNodeOverrides(mergeMediaSources(board.nodeOverrides ?? {}, currentOverrides));
  const nodeOverrides: Record<string, NodeOverride> = {};

  for (const [nodeId, override] of Object.entries(mergedOverrides)) {
    if (!nodeIds.has(nodeId)) continue;
    nodeOverrides[nodeId] = {
      ...override,
      images: (override.images ?? []).filter((image) => !image.linkedNodeId || nodeIds.has(image.linkedNodeId)),
      links: (override.links ?? []).filter((link) => link.url && nodeIds.has(link.linkedNodeId)),
    };
  }

  return cloneBoardState({
    memos,
    nodeOverrides,
    edges: sanitizeGraphEdges(board.edges ?? graph.edges, nodeIds),
    detailPosition: board.detailPosition ?? { x: 28, y: 34 },
    inputPosition: board.inputPosition ?? { x: 28, y: 26 },
    indexPosition: board.indexPosition ?? { x: 28, y: 34 },
    collapsedIndexNodes: board.collapsedIndexNodes ?? {},
    detailExpanded: Boolean(board.detailExpanded),
  });
}

function safeSetStorageItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Mind Orbit skipped ${key} storage.`, error);
    return false;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    const message = JSON.stringify(error);
    return message && message !== "{}" ? message : "알 수 없는 오류";
  } catch {
    return "알 수 없는 오류";
  }
}

function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

function youtubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/").filter(Boolean)[1] ?? "";
      return parsed.searchParams.get("v") ?? "";
    }
  } catch {
    return "";
  }

  return "";
}

function makeLinkNode(urlValue: string, linkedNodeId: string, linkedNode?: SimNode): NodeLink | null {
  try {
    const url = new URL(urlValue.trim());
    const videoId = youtubeVideoId(url.href);
    const isInstagram = url.hostname.includes("instagram.com");
    const source: LinkSource = videoId ? "youtube" : isInstagram ? "instagram" : "web";
    const angle = ((hashString(`${url.href}-${Date.now()}`) % 360) / 180) * Math.PI;
    const radius = linkedNode?.level === "project" ? 290 : 190;

    return {
      id: crypto.randomUUID(),
      type: "link",
      url: url.href,
      title: videoId ? "YouTube" : isInstagram ? "Instagram" : url.hostname.replace(/^www\./, ""),
      thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined,
      source,
      linkedNodeId,
      createdAt: new Date().toISOString(),
      x: (linkedNode?.x ?? 0) + Math.cos(angle) * radius,
      y: (linkedNode?.y ?? 0) + Math.sin(angle) * radius * 0.72,
      z: source === "youtube" ? 20 : 8,
    };
  } catch {
    return null;
  }
}

function splitTextUnits(text: string) {
  const paragraphs = text
    .split(/\n+/)
    .map((unit) => unit.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;

  return (
    text
      .match(/[^.!?。！？]+[.!?。！？]?/gu)
      ?.map((unit) => unit.trim())
      .filter(Boolean) ?? [text.trim()].filter(Boolean)
  );
}

function trimDetailText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function summarizeMemoText(text: string, level: NodeLevel) {
  const units = splitTextUnits(text);
  const maxUnits = level === "project" ? 4 : level === "category" ? 3 : 2;
  const maxLength = level === "project" ? 480 : level === "category" ? 360 : 260;

  return trimDetailText(units.slice(0, maxUnits).join("\n\n"), maxLength);
}

function relatedMemoText(text: string, label: string, level: NodeLevel) {
  const units = splitTextUnits(text);
  const labelKey = label.toLowerCase();
  const tokens = tokenize(label);
  const matches = units.filter((unit) => {
    const key = unit.toLowerCase();
    return key.includes(labelKey) || tokens.some((token) => key.includes(token));
  });
  const maxUnits = level === "category" ? 3 : 2;
  const maxLength = level === "category" ? 360 : 260;

  if (matches.length > 0) {
    return trimDetailText(matches.slice(0, maxUnits).join("\n\n"), maxLength);
  }

  return trimDetailText(summarizeMemoText(text, level), maxLength);
}

function createThoughtPocket(text: string, label: string, level: NodeLevel, mode: InputMode): ThoughtPocket {
  const relatedText = relatedMemoText(text, label, level);
  const expandedQuestion = expandNodeLabel(label, text);
  const tokens = uniqueLabels([label, ...tokenize(`${label} ${relatedText}`)]).slice(0, 8);
  const question =
    expandedQuestion !== label
        ? expandedQuestion
        : !isIncompleteNodeLabel(label)
          ? compactThoughtState(label)
        : `${label}에 대해 무엇을 더 확인해야 할까?`;
  const units = splitTextUnits(relatedText || text).slice(0, 3);
  const conflict = isAbstractKeyword(label)
    ? `${label}이 단순 개념으로 남아 있어서, 실제 욕구와 선택의 긴장을 아직 드러내지 못하고 있습니다.`
    : `${label}을 중심으로 무엇을 선택하고 무엇을 보류할지 정리해야 합니다.`;
  const logic = units.length > 0 ? units : [`${label}이 현재 사고의 출발점입니다.`];
  const emotion = isAbstractKeyword(label)
    ? "반응의 강도, 집착, 회피, 인정 욕구 같은 감정 신호를 함께 살펴봐야 합니다."
    : "이 노드와 연결된 감정 강도는 추가 메모를 통해 더 선명해질 수 있습니다.";
  const conclusion = `${label}은 키워드라기보다 다음 판단을 열기 위한 사고 상태로 다뤄야 합니다.`;

  return {
    question,
    triggerKeyword: label,
    summary: summarizeMemoText(relatedText || text, level),
    conflict,
    logic,
    emotion,
    conclusion,
    associatedKeywords: tokens,
    reasoningFlow: [
      `질문: ${question}`,
      `갈등: ${conflict}`,
      ...logic.map((item) => `논리: ${item}`),
      `감정: ${emotion}`,
      `결론: ${conclusion}`,
    ].slice(0, 7),
    nextQuestions: [
      `${label}이 다른 생각과 어떻게 연결될까?`,
      `${label}에서 지금 결정해야 할 것은 무엇일까?`,
    ],
    possibleConclusions: [conclusion],
    actionSuggestions: ["관련 메모를 추가해 연결을 확인하기", "다음 질문을 하나 선택해 새 Thought Pocket 만들기"],
  };
}

function createFlowAnalysis(text: string, mode: InputMode = "memo"): AnalysisResult {
  const lower = text.toLowerCase();
  const mentionsAi = lower.includes("ai") || text.includes("자동화");
  const coreQuestion = mode === "question" || /[?？]/u.test(text)
    ? "왜 AI 자동화에 집착하는가?"
    : "이 생각의 핵심 질문은 무엇인가?";
  const projectTitle = mentionsAi ? "왜 AI 자동화에 집착하는가?" : coreQuestion;
  const projectSummary = mentionsAi
    ? "아이디어 생성 속도와 실행 속도의 차이가 자동화 욕구를 만들고 있습니다."
    : summarizeMemoText(text, "project");
  const baseKeywords = uniqueLabels([...tokenize(text), "질문", "갈등", "실행", "결론"]).slice(0, 10);
  const states = [
    {
      title: mentionsAi ? "AI 자동화에 대한 집착은 어디서 시작되는가?" : "이 질문은 어떤 상황에서 시작되었는가?",
      summary: "사고의 출발 상황을 잡아야 같은 질문이 반복되는 이유를 볼 수 있습니다.",
      details: [
        mentionsAi ? "생각과 실행의 간극이 자동화를 부른다" : "생각과 실행 사이의 간극이 문제를 드러낸다",
        "반복되는 정리 과정에서 에너지가 소모된다",
      ],
    },
    {
      title: "반복 노동에서 벗어나고 싶은 욕구가 충돌한다",
      summary: "시간 절약 욕구와 실행 통제 욕구가 함께 움직입니다.",
      details: [
        "단순한 시간 절약인지 내면의 회피인지 구분해야 한다",
        "AI에게 어디까지 맡겨도 되는가?",
      ],
    },
    {
      title: "결과보다 과정 피로가 더 크게 느껴진다",
      summary: "실행 과정의 마찰이 결과에 대한 기대보다 더 크게 체감됩니다.",
      details: [
        "정리와 지시서 작성 단계에서 사고 에너지가 빠져나간다",
        "작업량이 커질수록 시작 자체를 회피하게 된다",
      ],
    },
    {
      title: "생각은 빠른데 실행은 항상 늦어지는 패턴이 반복된다",
      summary: "인지 속도와 실행 속도의 차이가 자동화 욕구를 강화합니다.",
      details: [
        "떠오른 생각이 작업 단위로 바뀌지 못한다",
        "실행으로 넘어가는 순간마다 작은 마찰이 크게 느껴진다",
      ],
    },
    {
      title: "생각을 실행으로 바꾸는 구조가 필요하다",
      summary: "결론은 자동화 자체가 아니라 사고가 작업으로 이어지는 흐름을 만드는 것입니다.",
      details: [
        "작업 지시서로 변환되는 중간 구조가 필요하다",
        "작은 실행 단위로 배포까지 연결해야 한다",
      ],
    },
    {
      title: "AI에게 어디까지 맡겨도 되는가?",
      summary: "다음 질문은 자동화 범위를 정하고 사고 주도권을 유지하는 문제로 이어집니다.",
      details: [
        "자동화가 사고를 대체하지 않고 실행을 보조해야 한다",
        "다음 실험은 작은 작업 흐름 하나를 자동화하는 것이다",
      ],
    },
  ];
  const projectPocket: ThoughtPocket = {
    question: coreQuestion,
    triggerKeyword: mentionsAi ? "AI 자동화" : "핵심 질문",
    summary: projectSummary,
    conflict: "생각은 빠르게 생기지만 정리, 지시, 구현, 배포로 이어지는 과정에서 에너지가 줄어듭니다.",
    logic: [
      "아이디어 생성 속도는 빠르지만 실행 속도는 따라오지 못합니다.",
      "반복 노동은 사고의 흐름을 끊고 에너지를 소모시킵니다.",
      "따라서 원하는 것은 자동화 자체가 아니라 생각이 실행으로 이어지는 구조입니다.",
    ],
    emotion: "반복 과정에서 피로와 답답함이 생기고, 그 감정이 자동화 욕구를 강화합니다.",
    conclusion: "생각과 실행의 간극이 자동화를 부른다",
    associatedKeywords: baseKeywords,
    reasoningFlow: [
      `질문: ${coreQuestion}`,
      "갈등: 시간을 아끼고 싶은 마음과 반복 노동에서 벗어나고 싶은 욕구가 겹쳐 있습니다.",
      "판단: 문제는 자동화 도구 부족이 아니라 생각을 실행 단위로 바꾸는 구조의 부재입니다.",
      "결론: 생각과 실행의 간극이 자동화를 부른다",
    ],
    nextQuestions: ["AI에게 어디까지 맡겨도 되는가?", "생각을 작업 지시서로 바꾸는 최소 구조는 무엇인가?"],
    possibleConclusions: ["생각과 실행의 간극이 자동화를 부른다", "반복 노동에서 벗어나려는 욕구가 자동화 집착을 강화한다"],
    actionSuggestions: ["반복되는 정리 작업을 단계별로 적어보기", "메모를 작업 지시서로 바꾸는 템플릿 만들기"],
  };

  return {
    projectTitle,
    projectSummary,
    categories: states.map((state) => ({
      title: state.title,
      summary: state.summary,
      keywords: baseKeywords,
      thoughtPocket: createThoughtPocket(text, state.title, "category", mode),
      details: state.details.map((detail) => ({
        title: detail,
        summary: detail,
        keywords: baseKeywords,
        thoughtPocket: createThoughtPocket(text, detail, "detail", mode),
      })),
    })),
    keywords: baseKeywords,
    suggestedNodes: [
      { label: projectTitle, level: "project" },
      ...states.flatMap((state) => [
        { label: state.title, level: "category" as const, parentLabel: projectTitle },
        ...state.details.map((detail) => ({ label: detail, level: "detail" as const, parentLabel: state.title })),
      ]),
    ],
    relatedTextSnippets: states.map((state) => ({ label: state.title, text: state.summary })),
    thoughtPocket: projectPocket,
  };
}

function analyzeMemoLocally(text: string, mode: InputMode = "memo"): AnalysisResult {
  if (mode === "question" || text.length > 120 || /[?？]/u.test(text)) return createFlowAnalysis(text, mode);

  const draftMemo = { id: "analysis-draft", text, keywords: [], createdAt: new Date().toISOString() };
  const structure = extractStructure(draftMemo, 0);
  const units = splitTextUnits(text);
  const keywords = uniqueLabels([
    structure.project,
    ...structure.categories.flatMap((category) => [category.label, ...category.details]),
  ]).slice(0, 10);

  return {
    projectTitle: structure.project,
    projectSummary: summarizeMemoText(text, "project"),
    categories: structure.categories.map((category) => ({
      title: category.label,
      summary: relatedMemoText(text, category.label, "category"),
      keywords: category.details,
      thoughtPocket: createThoughtPocket(text, category.label, "category", mode),
      details: category.details.map((detail) => ({
        title: detail,
        summary: relatedMemoText(text, detail, "detail"),
        keywords: uniqueLabels([detail, ...tokenize(relatedMemoText(text, detail, "detail"))]).slice(0, 6),
        thoughtPocket: createThoughtPocket(text, detail, "detail", mode),
      })),
    })),
    keywords,
    suggestedNodes: [
      { label: structure.project, level: "project" },
      ...structure.categories.flatMap((category) => [
        { label: category.label, level: "category" as const, parentLabel: structure.project },
        ...category.details.map((detail) => ({ label: detail, level: "detail" as const, parentLabel: category.label })),
      ]),
    ],
    relatedTextSnippets: keywords.slice(0, 6).map((keyword) => ({
      label: keyword,
      text: relatedMemoText(text, keyword, "detail") || units[0] || "",
    })),
    thoughtPocket: createThoughtPocket(text, structure.project, "project", mode),
  };
}

function mapApiAnalysisToPreview(analysis: ApiAnalysisResponse): AnalysisResult {
  const projectPocket = normalizeThoughtPocket(analysis.thoughtPocket);
  const projectTitle = thoughtStateLabelFromPocket(projectPocket, analysis.projectTitle, analysis.projectSummary);
  const categories = analysis.categories.map((category) => {
    const categoryPocket = normalizeThoughtPocket(category.thoughtPocket);
    const categoryTitle = thoughtStateLabelFromPocket(categoryPocket, category.title, analysis.projectSummary);
    const details = category.details.map((detail) => {
      const detailPocket = normalizeThoughtPocket(detail.thoughtPocket);
      const detailTitle = thoughtStateLabelFromPocket(detailPocket, detail.title, detail.summary);

      return {
        ...detail,
        title: detailTitle,
        thoughtPocket: detailPocket,
      };
    });

    return {
      title: categoryTitle,
      summary: category.summary,
      keywords: [
        ...details.flatMap((detail) => [detail.title, ...detail.keywords]),
      ],
      details,
      thoughtPocket: categoryPocket,
    };
  });

  return {
    projectTitle,
    projectSummary: analysis.projectSummary,
    categories,
    keywords: analysis.keywords,
    suggestedNodes: [
      { label: projectTitle, level: "project" },
      ...categories.flatMap((category) => [
        { label: category.title, level: "category" as const, parentLabel: projectTitle },
        ...category.details.map((detail) => ({ label: detail.title, level: "detail" as const, parentLabel: category.title })),
      ]),
    ],
    relatedTextSnippets: analysis.relatedSnippets,
    thoughtPocket: projectPocket,
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function analysisCacheKey(text: string, mode: InputMode) {
  return `analysis-${mode}-${hashString(text.trim())}-${text.trim().length}`;
}

function readAnalysisCache(): Record<string, AnalysisResult> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ANALYSIS_CACHE_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAnalysisCache(cache: Record<string, AnalysisResult>) {
  if (typeof window === "undefined") return;
  const entries = Object.entries(cache).slice(-20);
  try {
    window.localStorage.setItem(ANALYSIS_CACHE_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (error) {
    console.warn("Mind Orbit skipped analysis cache storage.", error);
  }
}

function readAnalysisUsage() {
  if (typeof window === "undefined") return { date: todayKey(), count: 0 };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ANALYSIS_USAGE_STORAGE_KEY) ?? "{}") as { date?: string; count?: number };
    if (parsed.date === todayKey()) return { date: parsed.date, count: typeof parsed.count === "number" ? parsed.count : 0 };
  } catch {
    return { date: todayKey(), count: 0 };
  }
  return { date: todayKey(), count: 0 };
}

function incrementAnalysisUsage() {
  const usage = readAnalysisUsage();
  const next = { date: todayKey(), count: usage.count + 1 };
  window.localStorage.setItem(ANALYSIS_USAGE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function resizeImageFile(file: File): Promise<NodeImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 760;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("이미지를 처리할 수 없습니다."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({
          id: crypto.randomUUID(),
          src: canvas.toDataURL("image/jpeg", 0.76),
          name: file.name,
          createdAt: new Date().toISOString(),
        });
      };
      image.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("textarea, input, button, [contenteditable='true']"));
}

function autoPanAxis(value: number) {
  const distance = Math.abs(value);
  if (distance <= AUTO_PAN_DEADZONE) return 0;
  const eased = Math.pow((distance - AUTO_PAN_DEADZONE) / (1 - AUTO_PAN_DEADZONE), 1.45);
  return Math.sign(value) * eased * AUTO_PAN_MAX_SPEED * AUTO_PAN_STRENGTH;
}

export default function Home() {
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
  const [text, setText] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("memo");
  const [analysisPreview, setAnalysisPreview] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiProgressIndex, setAiProgressIndex] = useState(0);
  const [imageNotice, setImageNotice] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [boardId, setBoardId] = useState("mind-orbit-demo");
  const [isSharing, setIsSharing] = useState(false);
  const [previewImage, setPreviewImage] = useState<NodeImage | null>(null);
  const [galleryMode, setGalleryMode] = useState<"slide" | "grid">("slide");
  const [linkModalNodeId, setLinkModalNodeId] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [memosLoaded, setMemosLoaded] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [currentPocketId, setCurrentPocketId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ width: 1200, height: 800 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [gaze, setGaze] = useState<Gaze>({ x: 0, y: 0 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [isGazePanEnabled, setIsGazePanEnabled] = useState(false);
  const [isPerformanceMode, setIsPerformanceMode] = useState(true);
  const [isStructureEdit, setIsStructureEdit] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [detailEditMode, setDetailEditMode] = useState<"summary" | "full" | null>(null);
  const [detailDraft, setDetailDraft] = useState("");
  const [nodeOverrides, setNodeOverrides] = useState<Record<string, NodeOverride>>({});
  const [repairedEdges, setRepairedEdges] = useState<GraphEdge[] | null>(null);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [detailPosition, setDetailPosition] = useState<DetailPosition>({ x: 28, y: 34 });
  const [inputPosition, setInputPosition] = useState<DetailPosition>({ x: 28, y: 26 });
  const [indexPosition, setIndexPosition] = useState<DetailPosition>({ x: 28, y: 34 });
  const [activeLayer, setActiveLayer] = useState<LayerName | "controls" | "guide" | "history">("input");
  const [indexSearch, setIndexSearch] = useState("");
  const [collapsedIndexNodes, setCollapsedIndexNodes] = useState<Record<string, boolean>>({});
  const [storageUsage, setStorageUsage] = useState<StorageUsage>({
    bytes: 0,
    limit: LOCAL_STORAGE_ESTIMATED_LIMIT,
    percent: 0,
  });
  const [snapshots, setSnapshots] = useState<BoardSnapshot[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const [historyPast, setHistoryPast] = useState<BoardState[]>([]);
  const [historyFuture, setHistoryFuture] = useState<BoardState[]>([]);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const spaceRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<SimNode[]>([]);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const targetCameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const dragNodeRef = useRef<{ id: string; moved: boolean; structure: boolean; lastX: number; lastY: number; ids?: Set<string> } | null>(null);
  const dragImageRef = useRef<{ id: string; linkedNodeId: string; moved: boolean; lastX: number; lastY: number } | null>(null);
  const dragLinkRef = useRef<{ id: string; linkedNodeId: string; moved: boolean; lastX: number; lastY: number } | null>(null);
  const groupImageDragRef = useRef<{ ids: Set<string>; dx: number; dy: number } | null>(null);
  const historyTimerRef = useRef<number | null>(null);
  const layoutStorageTimerRef = useRef<number | null>(null);
  const mediaPositionFrameRef = useRef<number | null>(null);
  const pendingImagePositionRef = useRef<{ linkedNodeId: string; imageId: string; x: number; y: number } | null>(null);
  const pendingLinkPositionRef = useRef<{ linkedNodeId: string; linkId: string; x: number; y: number } | null>(null);
  const historySeededRef = useRef(false);
  const skipHistoryRef = useRef(false);
  const lastHistorySignatureRef = useRef("");
  const gazeFrameRef = useRef(0);
  const pendingGazeRef = useRef<Gaze>({ x: 0, y: 0 });
  const autoPanFrameRef = useRef(0);
  const autoPanCursorRef = useRef({ active: false, x: 0, y: 0 });
  const viewportRef = useRef(viewport);
  const autoPanBlockedRef = useRef(false);
  const gazePanEnabledRef = useRef(false);
  const pointerOverUiRef = useRef(false);
  const lastDragMovedRef = useRef(false);
  const suppressNextCanvasClickRef = useRef(false);
  const selectionRectRef = useRef<SelectionRect | null>(null);
  const selectionBaseIdsRef = useRef<Set<string>>(new Set());
  const selectedNodeIdsRef = useRef<string[]>([]);
  const panRef = useRef<{ active: boolean; moved: boolean; x: number; y: number }>({ active: false, moved: false, x: 0, y: 0 });
  const layerDragRef = useRef<{
    layer: LayerName;
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);

  const { nodes, edges, projects } = useMemo(() => buildThoughtGraph(memos), [memos]);
  const graphEdges = repairedEdges ?? edges;
  const modeLabel = currentPocketId ? "Inner Space" : editingNodeId ? "Node Edit" : isStructureEdit ? "Structure Edit" : "Explore";
  const uiLayerEvents = {
    onPointerEnter: () => {
      pointerOverUiRef.current = true;
      autoPanCursorRef.current.active = false;
    },
    onPointerLeave: () => {
      pointerOverUiRef.current = false;
    },
  };
  const enterInteractionSafeZone = () => {
    pointerOverUiRef.current = true;
    autoPanCursorRef.current.active = false;
    pendingGazeRef.current = { x: 0, y: 0 };
  };
  const leaveInteractionSafeZone = () => {
    pointerOverUiRef.current = false;
  };
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  useEffect(() => {
    gazePanEnabledRef.current = isGazePanEnabled;
  }, [isGazePanEnabled]);

  useEffect(() => {
    autoPanBlockedRef.current = Boolean(previewImage || linkModalNodeId || editingNodeId || detailEditMode);
  }, [detailEditMode, editingNodeId, linkModalNodeId, previewImage]);

  useEffect(() => {
    if (!isAiAnalyzing) {
      setAiProgressIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setAiProgressIndex((index) => (index + 1) % AI_ANALYSIS_MESSAGES.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [isAiAnalyzing]);

  const visibleNodes = useMemo(
    () =>
      simNodes
        .filter((node) => !nodeOverrides[node.id]?.deleted)
        .map((node) => ({
          ...node,
          label: nodeOverrides[node.id]?.label ?? node.label,
          color: nodeOverrides[node.id]?.color ?? node.color ?? "graphite",
        })),
    [nodeOverrides, simNodes],
  );
  const selectedNode = useMemo(() => visibleNodes.find((node) => node.id === selectedNodeId) ?? null, [selectedNodeId, visibleNodes]);
  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const currentPocketNode = useMemo(
    () => visibleNodes.find((node) => node.id === currentPocketId) ?? null,
    [currentPocketId, visibleNodes],
  );
  const activeThoughtPocket = selectedNode?.thoughtPocket;
  const innerSpaceNodeIds = useMemo(() => {
    if (!currentPocketNode) return new Set<string>();
    const pocket = currentPocketNode.thoughtPocket;
    const terms = uniqueLabels([
      currentPocketNode.label,
      pocket?.triggerKeyword ?? "",
      pocket?.question ?? "",
      pocket?.conflict ?? "",
      pocket?.emotion ?? "",
      pocket?.conclusion ?? "",
      ...(pocket?.logic ?? []),
      ...(pocket?.reasoningFlow ?? []),
      ...(pocket?.associatedKeywords ?? []),
      ...(pocket?.nextQuestions ?? []),
    ]).flatMap(tokenize);
    const termSet = new Set(terms);
    const ids = new Set<string>([currentPocketNode.id]);

    for (const node of visibleNodes) {
      if (node.id === currentPocketNode.id) continue;
      const nodeTerms = tokenize([
        node.label,
        node.thoughtPocket?.triggerKeyword ?? "",
        node.thoughtPocket?.question ?? "",
        node.thoughtPocket?.conflict ?? "",
        node.thoughtPocket?.emotion ?? "",
        node.thoughtPocket?.conclusion ?? "",
        ...(node.thoughtPocket?.logic ?? []),
        ...(node.thoughtPocket?.reasoningFlow ?? []),
        ...(node.thoughtPocket?.associatedKeywords ?? []),
        ...(node.thoughtPocket?.nextQuestions ?? []),
      ].join(" "));
      if (nodeTerms.some((term) => termSet.has(term))) ids.add(node.id);
    }

    return ids;
  }, [currentPocketNode, visibleNodes]);
  const selectedMemo = useMemo(
    () => {
      if (!selectedNode) return null;
      return memos.find((memo) => memo.id === selectedMemoId) ?? selectedNode.memo ?? null;
    },
    [memos, selectedMemoId, selectedNode],
  );
  const selectedDetailText = useMemo(() => {
    if (!selectedNode || !selectedMemo) return "";
    if (selectedNode.level === "project") {
      return selectedMemo.analysis?.projectSummary || summarizeMemoText(selectedMemo.text, selectedNode.level);
    }
    const savedSnippet = selectedMemo.analysis?.relatedTextSnippets.find((snippet) => snippet.label === selectedNode.label);
    if (savedSnippet?.text) return savedSnippet.text;
    return relatedMemoText(selectedMemo.text, selectedNode.label, selectedNode.level);
  }, [selectedMemo, selectedNode]);
  const selectedNeighbors = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const ids = new Set<string>([selectedNodeId]);

    for (const edge of graphEdges) {
      if (edge.source === selectedNodeId) ids.add(edge.target);
      if (edge.target === selectedNodeId) ids.add(edge.source);
    }

    return ids;
  }, [graphEdges, selectedNodeId]);
  const selectedAncestorTrail = useMemo(() => {
    const ids: string[] = [];
    let current = visibleNodes.find((node) => node.id === selectedNodeId);

    while (current?.parentId) {
      const parent = visibleNodes.find((node) => node.id === current?.parentId);
      if (!parent) break;
      ids.push(parent.id);
      current = parent;
    }

    return ids;
  }, [selectedNodeId, visibleNodes]);
  const selectedAncestors = useMemo(() => new Set(selectedAncestorTrail), [selectedAncestorTrail]);
  const imageNodes = useMemo(
    () =>
      visibleNodes.flatMap((node) =>
        (nodeOverrides[node.id]?.images ?? []).map((rawImage, index) => {
          const image = hydrateImageNode(rawImage);
          const angle = ((hashString(image.id) % 360) / 180) * Math.PI;
          const radius = node.level === "project" ? 240 : 150;
          const linkedNodeId = image.linkedNodeId ?? node.id;
          const groupImageDelta = groupImageDragRef.current?.ids.has(linkedNodeId) ? groupImageDragRef.current : null;

          return {
            ...image,
            linkedNodeId,
            linkedLabel: node.label,
            level: node.level,
            x: typeof image.x === "number" ? image.x + (groupImageDelta?.dx ?? 0) : node.x + Math.cos(angle) * (radius + index * 18),
            y: typeof image.y === "number" ? image.y + (groupImageDelta?.dy ?? 0) : node.y + Math.sin(angle) * radius * 0.68,
            z: image.z ?? 0,
          };
        }),
      ),
    [nodeOverrides, visibleNodes],
  );
  const linkNodes = useMemo(
    () =>
      visibleNodes.flatMap((node) =>
        (Array.isArray(nodeOverrides[node.id]?.links) ? nodeOverrides[node.id]?.links ?? [] : []).map((link, index) => {
          const angle = ((hashString(link.id) % 360) / 180) * Math.PI;
          const radius = node.level === "project" ? 300 : 205;
          const linkedNodeId = link.linkedNodeId ?? node.id;
          const groupLinkDelta = groupImageDragRef.current?.ids.has(linkedNodeId) ? groupImageDragRef.current : null;

          return {
            ...link,
            linkedNodeId,
            linkedLabel: node.label,
            level: node.level,
            x: typeof link.x === "number" ? link.x + (groupLinkDelta?.dx ?? 0) : node.x + Math.cos(angle) * (radius + index * 22),
            y: typeof link.y === "number" ? link.y + (groupLinkDelta?.dy ?? 0) : node.y + Math.sin(angle) * radius * 0.7,
            z: link.z ?? 8,
          };
        }),
      ),
    [nodeOverrides, visibleNodes],
  );
  const galleryImages = useMemo(() => {
    if (!previewImage) return [];
    const linkedNodeId = previewImage.linkedNodeId;
    return imageNodes.filter((image) => image.linkedNodeId === linkedNodeId);
  }, [imageNodes, previewImage]);
  const galleryIndex = useMemo(() => {
    if (!previewImage) return 0;
    return Math.max(0, galleryImages.findIndex((image) => image.id === previewImage.id));
  }, [galleryImages, previewImage]);
  const galleryKeyword = useMemo(
    () => visibleNodes.find((node) => node.id === previewImage?.linkedNodeId)?.label ?? previewImage?.keywords?.[0] ?? "Image",
    [previewImage, visibleNodes],
  );

  useEffect(() => {
    setParticles(
      Array.from({ length: 68 }, (_, index) => ({
        id: index,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 100 + Math.random() * 300,
        delay: Math.random() * 9,
        duration: 20 + Math.random() * 26,
        opacity: 0.035 + Math.random() * 0.1,
      })),
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowOnboarding(false), 3800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(INDEX_STATE_STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") setCollapsedIndexNodes(parsed as Record<string, boolean>);
    } catch {
      window.localStorage.removeItem(INDEX_STATE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    setIsGazePanEnabled(window.localStorage.getItem(GAZE_MODE_STORAGE_KEY) === "on");
    setIsPerformanceMode(window.localStorage.getItem(PERFORMANCE_MODE_STORAGE_KEY) !== "false");
    const board = new URLSearchParams(window.location.search).get("board");
    if (board?.trim()) setBoardId(board.trim());
  }, []);

  useEffect(() => {
    const board = new URLSearchParams(window.location.search).get("board");
    if (!board || !memosLoaded || !layoutLoaded) return;
    void loadSharedBoard(board.trim(), true);
  }, [layoutLoaded, memosLoaded]);

  useEffect(() => {
    try {
      const rawSnapshots = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY) ?? "[]";
      const savedSnapshots = JSON.parse(rawSnapshots);
      if (Array.isArray(savedSnapshots)) {
        setSnapshots(savedSnapshots.slice(0, MAX_SNAPSHOTS).map((snapshot: BoardSnapshot) => ({
          ...snapshot,
          data: {
            ...snapshot.data,
            nodeOverrides: hydrateNodeOverrides(snapshot.data?.nodeOverrides ?? {}),
          },
        })));
      }

      const rawHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? "{}";
      if (storageByteSize(rawHistory) > 350_000) {
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
        return;
      }
      const savedHistory = JSON.parse(rawHistory);
      if (Array.isArray(savedHistory.past)) {
        setHistoryPast(savedHistory.past.slice(-MAX_HISTORY).map((state: BoardState) => lightweightBoardState({
          ...state,
          nodeOverrides: hydrateNodeOverrides(state.nodeOverrides ?? {}),
        })));
      }
      if (Array.isArray(savedHistory.future)) {
        setHistoryFuture(savedHistory.future.slice(0, MAX_HISTORY).map((state: BoardState) => lightweightBoardState({
          ...state,
          nodeOverrides: hydrateNodeOverrides(state.nodeOverrides ?? {}),
        })));
      }
    } catch {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    } finally {
      setArchiveLoaded(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(INDEX_STATE_STORAGE_KEY, JSON.stringify(collapsedIndexNodes));
    setStorageUsage(readStorageUsage());
  }, [collapsedIndexNodes]);

  useEffect(() => {
    window.localStorage.setItem(GAZE_MODE_STORAGE_KEY, isGazePanEnabled ? "on" : "off");
    setStorageUsage(readStorageUsage());
  }, [isGazePanEnabled]);

  useEffect(() => {
    window.localStorage.setItem(PERFORMANCE_MODE_STORAGE_KEY, isPerformanceMode ? "true" : "false");
    if (isPerformanceMode) {
      setIsGazePanEnabled(false);
      autoPanCursorRef.current.active = false;
      pendingGazeRef.current = { x: 0, y: 0 };
      setGaze({ x: 0, y: 0 });
    }
    setStorageUsage(readStorageUsage());
  }, [isPerformanceMode]);

  useEffect(() => {
    if (!archiveLoaded) return;
    const safeSnapshots = snapshots.slice(0, MAX_SNAPSHOTS).map((snapshot) => ({
      ...snapshot,
      data: lightweightBoardState(snapshot.data),
    }));
    if (!safeSetStorageItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(safeSnapshots))) {
      if (!safeSetStorageItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(safeSnapshots.slice(0, 1)))) {
        window.localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
      }
    }
    setStorageUsage(readStorageUsage());
  }, [archiveLoaded, snapshots]);

  useEffect(() => {
    if (!archiveLoaded) return;
    const historyPayload = {
      past: historyPast.slice(-MAX_HISTORY).map(lightweightBoardState),
      future: historyFuture.slice(0, MAX_HISTORY).map(lightweightBoardState),
    };
    if (!safeSetStorageItem(HISTORY_STORAGE_KEY, JSON.stringify(historyPayload))) {
      const smallerPayload = {
        past: historyPayload.past.slice(-1),
        future: [],
      };
      if (!safeSetStorageItem(HISTORY_STORAGE_KEY, JSON.stringify(smallerPayload))) {
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      }
    }
    setStorageUsage(readStorageUsage());
  }, [archiveLoaded, historyFuture, historyPast]);

  useEffect(() => {
    setStorageUsage(readStorageUsage());
  }, []);

  useEffect(() => {
    setDetailExpanded(false);
    setDetailEditMode(null);
    setDetailDraft("");
  }, [selectedNodeId]);

  useEffect(() => {
    if (currentPocketId && !visibleNodes.some((node) => node.id === currentPocketId)) {
      setCurrentPocketId(null);
    }
  }, [currentPocketId, visibleNodes]);

  useEffect(() => {
    if (selectedNodeIds.length === 0) return;
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    setSelectedNodeIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [selectedNodeIds.length, visibleNodes]);

  useEffect(() => {
    if (!isGazePanEnabled || isPerformanceMode) {
      autoPanCursorRef.current.active = false;
      return;
    }

    const tick = () => {
      const cursor = autoPanCursorRef.current;
      const currentViewport = viewportRef.current;
      const activeElement = document.activeElement;
      const hoveredElement = document.elementFromPoint(cursor.x, cursor.y);
      const blocked =
        !cursor.active ||
        !gazePanEnabledRef.current ||
        isPerformanceMode ||
        currentViewport.width < 760 ||
        pointerOverUiRef.current ||
        autoPanBlockedRef.current ||
        panRef.current.active ||
        Boolean(layerDragRef.current || dragNodeRef.current || dragImageRef.current || dragLinkRef.current) ||
        (activeElement instanceof HTMLElement && Boolean(activeElement.closest("textarea, input"))) ||
        (hoveredElement instanceof HTMLElement && Boolean(hoveredElement.closest(FLOATING_INTERACTION_SELECTOR))) ||
        Boolean(document.querySelector(".interaction-safe-zone:hover"));

      if (!blocked) {
        const normalizedX = clamp((cursor.x - currentViewport.width / 2) / (currentViewport.width / 2), -1, 1);
        const normalizedY = clamp((cursor.y - currentViewport.height / 2) / (currentViewport.height / 2), -1, 1);
        const speedX = autoPanAxis(normalizedX);
        const speedY = autoPanAxis(normalizedY);

        if (Math.abs(speedX) > 0.01 || Math.abs(speedY) > 0.01) {
          targetCameraRef.current = {
            ...targetCameraRef.current,
            x: targetCameraRef.current.x + speedX / cameraRef.current.zoom,
            y: targetCameraRef.current.y + speedY / cameraRef.current.zoom,
          };
        }
      }

      autoPanFrameRef.current = requestAnimationFrame(tick);
    };

    autoPanFrameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(autoPanFrameRef.current);
      autoPanCursorRef.current.active = false;
    };
  }, [isGazePanEnabled, isPerformanceMode]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (!files || files.length === 0) return;
      if (!Array.from(files).some((file) => file.type.startsWith("image/"))) return;
      event.preventDefault();
      void uploadToActiveNode(files);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [selectedNodeId, simNodes]);

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
      console.log("RAW DOCUMENT POINTER DOWN", event.shiftKey, node?.id ?? "space", event.target);
      if (event.shiftKey) {
        suppressNextCanvasClickRef.current = true;
        if (node) {
          console.log("RAW NODE POINTER DOWN", node.id, event.shiftKey);
          toggleNodeSelection(node.id);
        } else {
          beginSelectionDrag(event.clientX, event.clientY);
        }
        stopNativeEvent(event);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && node) {
        console.log("RAW NODE POINTER DOWN", node.id, event.shiftKey);
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
        console.log("selection persisted", selectedNodeIdsRef.current.length);
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
  }, [camera, selectedNodeIds, visibleNodes, viewport]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey;
      const isRedo =
        ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "z") ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y");
      if ((isUndo || isRedo) && isInteractiveTarget(event.target)) return;
      if (isUndo || isRedo) {
        event.preventDefault();
        if (isUndo) undoBoard();
        if (isRedo) redoBoard();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && !isInteractiveTarget(event.target)) {
        if (selectedNodeIds.length > 0 || selectedNodeId) {
          event.preventDefault();
          deleteSelectedNodes();
          return;
        }
      }
      if (event.key === "Escape") {
        if (selectionRectRef.current) {
          finishSelectionDrag();
          setSelectedNodeIds([]);
          return;
        }
        if (selectedNodeIds.length > 0 || selectedNodeId) {
          setSelectedNodeIds([]);
          setSelectedNodeId(null);
          return;
        }
        if (detailEditMode) {
          setDetailEditMode(null);
          setDetailDraft("");
          return;
        }
        closeImageModal();
        setLinkModalNodeId(null);
        setLinkError("");
      }
      if (!previewImage) return;
      if (event.key === "ArrowLeft") shiftGallery(-1);
      if (event.key === "ArrowRight") shiftGallery(1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailEditMode, galleryImages, galleryIndex, historyFuture, historyPast, previewImage, selectedNodeId, selectedNodeIds]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setMemosLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        setMemosLoaded(true);
        return;
      }
      setMemos(parsed.map((memo, index) => normalizeMemo(memo, index)));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setMemosLoaded(true);
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!saved) {
      setLayoutLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as StoredLayout;
      saveImageAssetsFromOverrides(parsed.nodes ?? {});
      setNodeOverrides(hydrateNodeOverrides(parsed.nodes ?? {}));
      if (Array.isArray(parsed.edges)) setRepairedEdges(parsed.edges);
      if (parsed.detail) setDetailPosition(parsed.detail);
      if (parsed.input) setInputPosition(parsed.input);
      if (parsed.index) setIndexPosition(parsed.index);
    } catch {
      window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } finally {
      setLayoutLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!memosLoaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
    setStorageUsage(readStorageUsage());
  }, [memos, memosLoaded]);

  useEffect(() => {
    if (!layoutLoaded) return;

    if (layoutStorageTimerRef.current) window.clearTimeout(layoutStorageTimerRef.current);
    layoutStorageTimerRef.current = window.setTimeout(() => {
      if (dragNodeRef.current || dragImageRef.current || dragLinkRef.current || layerDragRef.current || panRef.current.active || selectionRectRef.current) return;

      saveImageAssetsFromOverrides(nodeOverrides);
      const compactNodes = lightweightBoardState(currentBoardState()).nodeOverrides;
      window.localStorage.setItem(
        LAYOUT_STORAGE_KEY,
        JSON.stringify({
          nodes: compactNodes,
          edges: graphEdges,
          detail: detailPosition,
          input: inputPosition,
          index: indexPosition,
        }),
      );
      setStorageUsage(readStorageUsage());
    }, 500);

    return () => {
      if (layoutStorageTimerRef.current) window.clearTimeout(layoutStorageTimerRef.current);
    };
  }, [detailPosition, graphEdges, indexPosition, inputPosition, layoutLoaded, nodeOverrides]);

  useEffect(() => {
    if (!memosLoaded || !layoutLoaded || !archiveLoaded) return;

    const state = lightweightBoardState(currentBoardState());
    const signature = JSON.stringify(state);

    if (!historySeededRef.current) {
      historySeededRef.current = true;
      lastHistorySignatureRef.current = signature;
      if (snapshots.length === 0 && memos.length > 0) {
        setSnapshots([
          {
            id: crypto.randomUUID(),
            name: `Auto Save - ${formatSnapshotName()}`,
            createdAt: new Date().toISOString(),
            data: lightweightBoardState(state),
            auto: true,
          },
        ]);
      }
      return;
    }

    if (
      skipHistoryRef.current ||
      signature === lastHistorySignatureRef.current ||
      dragNodeRef.current ||
      dragImageRef.current ||
      dragLinkRef.current ||
      layerDragRef.current ||
      panRef.current.active ||
      selectionRectRef.current
    ) {
      return;
    }

    if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = window.setTimeout(() => {
      const previous = JSON.parse(lastHistorySignatureRef.current) as BoardState;
      setHistoryPast((current) => [...current, previous].slice(-MAX_HISTORY));
      setHistoryFuture([]);
      lastHistorySignatureRef.current = signature;
    }, 650);

    return () => {
      if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current);
    };
  }, [
    collapsedIndexNodes,
    archiveLoaded,
    detailPosition,
    detailExpanded,
    indexPosition,
    inputPosition,
    layoutLoaded,
    memos,
    memosLoaded,
    nodeOverrides,
    snapshots.length,
  ]);

  useEffect(() => {
    if (!selectedMemoId || selectedNodeId || simNodes.length === 0) return;

    const freshNode =
      simNodes.find((node) => node.memo.id === selectedMemoId && node.level === "project") ??
      simNodes.find((node) => node.memo.id === selectedMemoId);

    if (freshNode) focusNode(freshNode);
  }, [selectedMemoId, selectedNodeId, simNodes]);

  useEffect(() => {
    const updateViewport = () => {
      const rect = spaceRef.current?.getBoundingClientRect();
      setViewport({
        width: rect?.width ?? window.innerWidth,
        height: rect?.height ?? window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "z") setIsStructureEdit(true);
      if (event.key === "Escape") setEditingNodeId(null);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "z") setIsStructureEdit(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const previous = new Map(simRef.current.map((node) => [node.id, node]));
    const projectIndex = new Map(projects.map((project, index) => [project, index]));

    simRef.current = nodes.filter((node) => !nodeOverrides[node.id]?.deleted).map((node, index) => {
      const override = nodeOverrides[node.id];
      const existing = previous.get(node.id);
      if (existing) {
        return {
          ...existing,
          ...node,
          label: override?.label ?? node.label,
          color: override?.color ?? node.color,
          x: override?.x ?? existing.x,
          y: override?.y ?? existing.y,
          fixed: typeof override?.x === "number" && typeof override?.y === "number",
        };
      }

      const initial = getInitialNode(node, index, projectIndex.get(node.project) ?? 0, Math.max(projects.length, 1));
      return {
        ...initial,
        label: override?.label ?? initial.label,
        color: override?.color ?? initial.color,
        x: override?.x ?? initial.x,
        y: override?.y ?? initial.y,
        fixed: typeof override?.x === "number" && typeof override?.y === "number",
      };
    });

    setSimNodes(simRef.current.map((node) => ({ ...node })));
  }, [nodeOverrides, nodes, projects]);

  useEffect(() => {
    let frame = 0;
    let animationId = 0;

    const tick = () => {
      const current = simRef.current;
      const byId = new Map(current.map((node) => [node.id, node]));
      const projectIndex = new Map(projects.map((project, index) => [project, index]));

      for (let i = 0; i < current.length; i += 1) {
        const a = current[i];

        for (let j = i + 1; j < current.length; j += 1) {
          const b = current[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distanceSq = Math.max(dx * dx + dy * dy, 160);
          const distance = Math.sqrt(distanceSq);
          const force = (a.project === b.project ? 5400 : 7800) / distanceSq;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          if (!a.locked && !a.fixed && a.level !== "project") {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (!b.locked && !b.fixed && b.level !== "project") {
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      for (const edge of graphEdges) {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const desired = target.level === "category" ? 220 : 150;
        const force = (distance - desired) * 0.006 * edge.strength;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        if (!source.locked && !source.fixed && source.level !== "project") {
          source.vx += fx;
          source.vy += fy;
        }
        if (!target.locked && !target.fixed && target.level !== "project") {
          target.vx -= fx;
          target.vy -= fy;
        }
      }

      for (const node of current) {
        const anchor = projectAnchor(projectIndex.get(node.project) ?? 0, Math.max(projects.length, 1));

        if (node.level === "project") {
          if (!node.locked && !node.fixed) {
            node.x += (anchor.x - node.x) * 0.08;
            node.y += (anchor.y - node.y) * 0.08;
          }
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        if (!node.locked && !node.fixed) {
          const drift = Math.sin(frame * 0.012 + node.pulse * Math.PI * 2) * 0.018;
          node.vx += (anchor.x - node.x) * (node.level === "category" ? 0.00055 : 0.00024);
          node.vy += (anchor.y - node.y) * (node.level === "category" ? 0.00055 : 0.00024);
          node.vx += Math.cos(frame * 0.011 + node.pulse * 5) * drift;
          node.vy += Math.sin(frame * 0.013 + node.pulse * 6) * drift;
          node.vx *= 0.9;
          node.vy *= 0.9;
          node.x += node.vx;
          node.y += node.vy;
        }
      }

      const cameraNow = cameraRef.current;
      const cameraTarget = targetCameraRef.current;
      cameraNow.x += (cameraTarget.x - cameraNow.x) * 0.065;
      cameraNow.y += (cameraTarget.y - cameraNow.y) * 0.065;
      cameraNow.zoom += (cameraTarget.zoom - cameraNow.zoom) * 0.08;

      frame += 1;
      const cameraMoving =
        Math.abs(cameraTarget.x - cameraNow.x) > 0.02 ||
        Math.abs(cameraTarget.y - cameraNow.y) > 0.02 ||
        Math.abs(cameraTarget.zoom - cameraNow.zoom) > 0.001;
      const publishNodes = frame % 3 === 0 || Boolean(dragNodeRef.current || dragImageRef.current || dragLinkRef.current);

      if (cameraMoving || publishNodes) setCamera({ ...cameraNow });
      if (publishNodes) setSimNodes(current.map((node) => ({ ...node })));
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [graphEdges, projects]);

  function focusNode(node: SimNode) {
    setSelectedNodeId(node.id);
    setSelectedNodeIds([]);
    setSelectedImageId(null);
    setSelectedLinkId(null);
    setSelectedMemoId(node.level === "project" ? node.memo.id : null);
    targetCameraRef.current = {
      x: node.x,
      y: node.y,
      zoom: targetCameraRef.current.zoom,
    };
  }

  function toggleNodeSelection(id: string) {
    console.log("shift node click", id);
    setSelectedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const nextIds = [...next];
      selectedNodeIdsRef.current = nextIds;
      console.log("selectedNodeIds", nextIds);
      console.log("selection persisted", nextIds.length);
      return nextIds;
    });
    setSelectedNodeId(null);
    setSelectedImageId(null);
    setSelectedLinkId(null);
    setSelectedMemoId(null);
  }

  function enterThoughtPocket(node: SimNode) {
    setCurrentPocketId(node.id);
    focusNode(node);
  }

  function focusImage(image: { id: string; x: number; y: number; linkedNodeId?: string }) {
    setSelectedImageId(image.id);
    setSelectedLinkId(null);
    if (image.linkedNodeId) {
      const linkedNode = simRef.current.find((node) => node.id === image.linkedNodeId);
      setSelectedNodeId(linkedNode?.id ?? null);
      setSelectedMemoId(linkedNode?.level === "project" ? linkedNode.memo.id : null);
    }
    targetCameraRef.current = {
      x: image.x,
      y: image.y,
      zoom: targetCameraRef.current.zoom,
    };
  }

  function focusLink(link: { id: string; x: number; y: number; linkedNodeId?: string }) {
    setSelectedLinkId(link.id);
    setSelectedImageId(null);
    if (link.linkedNodeId) {
      const linkedNode = simRef.current.find((node) => node.id === link.linkedNodeId);
      setSelectedNodeId(linkedNode?.id ?? null);
      setSelectedMemoId(linkedNode?.level === "project" ? linkedNode.memo.id : null);
    }
    targetCameraRef.current = {
      x: link.x,
      y: link.y,
      zoom: targetCameraRef.current.zoom,
    };
  }

  function centerView() {
    const current = simRef.current;

    if (current.length === 0) {
      targetCameraRef.current = { x: 0, y: 0, zoom: targetCameraRef.current.zoom };
      return;
    }

    const center = current.reduce(
      (sum, node) => ({
        x: sum.x + node.x / current.length,
        y: sum.y + node.y / current.length,
      }),
      { x: 0, y: 0 },
    );

    targetCameraRef.current = {
      x: center.x,
      y: center.y,
      zoom: targetCameraRef.current.zoom,
    };
  }

  function resetLayout() {
    const projectIndex = new Map(projects.map((project, index) => [project, index]));
    const nextOverrides: Record<string, NodeOverride> = {};

    for (const [id, override] of Object.entries(nodeOverrides)) {
      const preserved: NodeOverride = {};
      if (override.label) preserved.label = override.label;
      if (override.color) preserved.color = override.color;
      if (override.images) {
        preserved.images = override.images.map((image) => ({ ...image, x: undefined, y: undefined, z: undefined }));
      }
      if (Array.isArray(override.links)) {
        preserved.links = override.links.map((link) => ({ ...link, x: undefined, y: undefined, z: undefined }));
      }
      if (override.deleted) preserved.deleted = override.deleted;
      if (preserved.label || preserved.color || preserved.images || preserved.links || preserved.deleted) nextOverrides[id] = preserved;
    }

    simRef.current = nodes.map((node, index) => {
      const initial = getInitialNode(node, index, projectIndex.get(node.project) ?? 0, Math.max(projects.length, 1));
      const override = nextOverrides[node.id];

      return {
        ...initial,
        label: override?.label ?? initial.label,
        color: override?.color ?? initial.color,
        fixed: false,
        locked: false,
      };
    });

    setNodeOverrides(nextOverrides);
    setSimNodes(simRef.current.map((node) => ({ ...node })));
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedImageId(null);
    setSelectedLinkId(null);
    setSelectedMemoId(null);
    setEditingNodeId(null);
    setPreviewImage(null);
    setLinkModalNodeId(null);
    setLinkError("");
    groupImageDragRef.current = null;
    dragNodeRef.current = null;
    dragImageRef.current = null;
    dragLinkRef.current = null;
    panRef.current = { active: false, moved: false, x: 0, y: 0 };
    targetCameraRef.current = { x: 0, y: 0, zoom: 1 };
    cameraRef.current = { x: 0, y: 0, zoom: 1 };
    setCamera({ x: 0, y: 0, zoom: 1 });

    window.requestAnimationFrame(centerView);
  }

  function toggleIndexNode(id: string) {
    setCollapsedIndexNodes((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function screenPosition(node: SimNode) {
    return {
      x: (node.x - camera.x) * camera.zoom + viewport.width / 2,
      y: (node.y - camera.y) * camera.zoom + viewport.height / 2,
    };
  }

  function imageScreenPosition(image: { x: number; y: number }) {
    return {
      x: (image.x - camera.x) * camera.zoom + viewport.width / 2,
      y: (image.y - camera.y) * camera.zoom + viewport.height / 2,
    };
  }

  function pointerInSpace(clientX: number, clientY: number) {
    const rect = spaceRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  }

  function selectionBounds(rect: SelectionRect) {
    const left = Math.min(rect.startX, rect.currentX);
    const right = Math.max(rect.startX, rect.currentX);
    const top = Math.min(rect.startY, rect.currentY);
    const bottom = Math.max(rect.startY, rect.currentY);
    return { left, right, top, bottom };
  }

  function nodeIdsInSelection(rect: SelectionRect) {
    const bounds = selectionBounds(rect);
    return visibleNodes
      .filter((node) => {
        const position = screenPosition(node);
        return position.x >= bounds.left && position.x <= bounds.right && position.y >= bounds.top && position.y <= bounds.bottom;
      })
      .map((node) => node.id);
  }

  function hitTestVisibleNode(clientX: number, clientY: number) {
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
  }

  function beginSelectionDrag(clientX: number, clientY: number) {
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
    console.log("selection start");
    setSelectedNodeId(null);
    setSelectedImageId(null);
    setSelectedLinkId(null);
    setSelectedMemoId(null);
    return true;
  }

  function startSelectionDrag(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0) return false;
    beginSelectionDrag(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    return true;
  }

  function updateSelectionDrag(clientX: number, clientY: number) {
    const current = selectionRectRef.current;
    if (!current?.active) return false;
    const point = pointerInSpace(clientX, clientY);
    const next = { ...current, currentX: point.x, currentY: point.y };
    selectionRectRef.current = next;
    setSelectionRect(next);
    const ids = new Set(selectionBaseIdsRef.current);
    nodeIdsInSelection(next).forEach((id) => ids.add(id));
    const nextIds = [...ids];
    console.log("selection move", nextIds);
    setSelectedNodeIds(nextIds);
    return true;
  }

  function finishSelectionDrag() {
    if (!selectionRectRef.current) return false;
    const ids = new Set(selectionBaseIdsRef.current);
    nodeIdsInSelection(selectionRectRef.current).forEach((id) => ids.add(id));
    const selectedIds = [...ids];
    selectedNodeIdsRef.current = selectedIds;
    console.log("selection end", selectedIds);
    setSelectedNodeIds(selectedIds);
    selectionRectRef.current = null;
    selectionBaseIdsRef.current = new Set();
    setSelectionRect(null);
    console.log("selection persisted", selectedIds.length);
    return true;
  }

  function currentBoardState(): BoardState {
    return cloneBoardState({
      memos,
      nodeOverrides,
      edges: graphEdges,
      detailPosition,
      inputPosition,
      indexPosition,
      collapsedIndexNodes,
      detailExpanded,
    });
  }

  function restoreBoardState(state: BoardState) {
    const nextState = sanitizeLoadedBoard(state, nodeOverrides);
    const restoredOverrides = nextState.nodeOverrides;
    skipHistoryRef.current = true;
    setMemos(Array.isArray(nextState.memos) ? nextState.memos.map((memo, index) => normalizeMemo(memo, index)) : []);
    setNodeOverrides(restoredOverrides);
    setRepairedEdges(Array.isArray(nextState.edges) ? nextState.edges : null);
    setDetailPosition(nextState.detailPosition ?? { x: 28, y: 34 });
    setInputPosition(nextState.inputPosition ?? { x: 28, y: 26 });
    setIndexPosition(nextState.indexPosition ?? { x: 28, y: 34 });
    setCollapsedIndexNodes(nextState.collapsedIndexNodes ?? {});
    setDetailExpanded(Boolean(nextState.detailExpanded));
    clearFocus();
    setLinkModalNodeId(null);
    setLinkError("");
    groupImageDragRef.current = null;
    dragNodeRef.current = null;
    dragImageRef.current = null;
    dragLinkRef.current = null;
    panRef.current = { active: false, moved: false, x: 0, y: 0 };
    lastHistorySignatureRef.current = JSON.stringify(lightweightBoardState({
      ...nextState,
      nodeOverrides: restoredOverrides,
    }));
    window.setTimeout(() => {
      skipHistoryRef.current = false;
    }, 0);
  }

  function saveBoardSnapshot(auto = false) {
    const defaultName = `${auto ? "Auto Save" : "Snapshot"} - ${formatSnapshotName()}`;
    const name = auto ? defaultName : window.prompt("저장 시점 이름", defaultName);
    if (name === null) return;

    const snapshot: BoardSnapshot = {
      id: crypto.randomUUID(),
      name: name.trim() || defaultName,
      createdAt: new Date().toISOString(),
      data: lightweightBoardState(currentBoardState()),
      auto,
    };

    setSnapshots((current) => [snapshot, ...current].slice(0, MAX_SNAPSHOTS));
  }

  function currentSharedBoardData(): SharedBoardData {
    const board = sanitizeLoadedBoard(currentBoardState(), nodeOverrides);
    return {
      board,
      snapshots: snapshots.slice(0, MAX_SNAPSHOTS),
    };
  }

  async function saveSharedBoard() {
    const client = supabaseClient();
    if (!client) {
      const message = "Supabase 환경변수가 없습니다. 로컬 모드는 계속 사용할 수 있습니다.";
      setShareNotice(message);
      alert(message);
      return;
    }

    const id = boardId.trim() || "mind-orbit-demo";
    const data = currentSharedBoardData();
    const size = storageByteSize(JSON.stringify(data));
    const payload = {
      id,
      name: id,
      data,
      updated_at: new Date().toISOString(),
    };
    console.log("saving board", payload);
    console.log("boardId", id);
    console.log("payload size", size);
    setShareNotice(`클라우드 저장 요청: ${id}`);
    if (size > 3_500_000 && !window.confirm("보드 데이터가 큽니다. 이미지가 많으면 저장이 실패할 수 있습니다. 계속할까요?")) {
      return;
    }

    setIsSharing(true);
    setShareNotice("클라우드 저장 중...");
    try {
      const result = await client.from("boards").upsert(payload).select();
      console.log(result);
      const { error } = result;

      if (error) {
        const message = getErrorMessage(error);
        console.warn("클라우드 저장 실패:", message);
        setShareNotice(`클라우드 저장 실패: ${message}`);
        alert(`클라우드 저장 실패: ${message}`);
        return;
      }
      setBoardId(id);
      setShareNotice(`클라우드 저장 완료: ${id}`);
      alert("클라우드 저장 완료");
    } catch (error) {
      const message = getErrorMessage(error);
      console.warn("클라우드 저장 실패:", message);
      setShareNotice(`클라우드 저장 실패: ${message}`);
      alert(`클라우드 저장 실패: ${message}`);
    } finally {
      setIsSharing(false);
    }
  }

  async function loadSharedBoard(id = boardId.trim() || "mind-orbit-demo", fromUrl = false) {
    const client = supabaseClient();
    if (!client) {
      const message = "Supabase 환경변수가 없습니다. 로컬 모드는 계속 사용할 수 있습니다.";
      setShareNotice(message);
      alert(message);
      return;
    }
    if (!fromUrl && !window.confirm("현재 로컬 상태가 덮어쓰기 됩니다. 계속할까요?")) return;
    if (fromUrl && !window.confirm(`공유 보드 "${id}"를 불러올까요? 현재 로컬 상태가 덮어쓰기 됩니다.`)) return;

    setIsSharing(true);
    setShareNotice("클라우드 불러오는 중...");
    try {
      const result = await client.from("boards").select("data").eq("id", id).single();
      console.log("load board result", result);
      const { data, error } = result;
      if (error) {
        const message = getErrorMessage(error);
        console.warn("클라우드 불러오기 실패:", message);
        setShareNotice(`클라우드 불러오기 실패: ${message}`);
        alert(`클라우드 불러오기 실패: ${message}`);
        return;
      }

      const shared = data?.data as Partial<SharedBoardData> | BoardState | undefined;
      const board = shared && "board" in shared ? shared.board : (shared as BoardState | undefined);
      if (!board) throw new Error("저장된 보드 데이터가 없습니다.");

      restoreBoardState(board);
      if (shared && "snapshots" in shared && Array.isArray(shared.snapshots)) {
        setSnapshots(shared.snapshots.slice(0, MAX_SNAPSHOTS));
      }
      setBoardId(id);
      setShareNotice(`클라우드 불러오기 완료: ${id}`);
      alert("클라우드 불러오기 완료");
    } catch (error) {
      const message = getErrorMessage(error);
      console.warn("클라우드 불러오기 실패:", message);
      setShareNotice(`클라우드 불러오기 실패: ${message}`);
      alert(`클라우드 불러오기 실패: ${message}`);
    } finally {
      setIsSharing(false);
    }
  }

  async function copyShareLink() {
    const id = boardId.trim() || "mind-orbit-demo";
    setBoardId(id);
    const url = `${window.location.origin}?board=${encodeURIComponent(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice("공유 링크가 복사되었습니다");
      alert("공유 링크 복사 완료");
    } catch {
      const message = `공유 링크 복사 실패: ${url}`;
      setShareNotice(message);
      alert(message);
    }
  }

  function repairCurrentConnections() {
    const previous = lightweightBoardState(currentBoardState());
    const nextEdges = rebuildEdgesFromHierarchy(visibleNodes);
    const repaired = lightweightBoardState({
      ...sanitizeLoadedBoard(previous, nodeOverrides),
      edges: nextEdges,
    });
    console.log("edges before repair", graphEdges.length);
    console.log("edges after repair", nextEdges.length);

    setHistoryPast((current) => [...current, previous].slice(-MAX_HISTORY));
    setHistoryFuture([]);
    skipHistoryRef.current = true;
    setMemos(repaired.memos);
    setNodeOverrides(repaired.nodeOverrides);
    setRepairedEdges(nextEdges);
    setDetailPosition(repaired.detailPosition);
    setInputPosition(repaired.inputPosition);
    setIndexPosition(repaired.indexPosition);
    setCollapsedIndexNodes(repaired.collapsedIndexNodes);
    setDetailExpanded(Boolean(repaired.detailExpanded));
    clearFocus();

    safeSetStorageItem(STORAGE_KEY, JSON.stringify(repaired.memos));
    safeSetStorageItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        nodes: repaired.nodeOverrides,
        edges: nextEdges,
        detail: repaired.detailPosition,
        input: repaired.inputPosition,
        index: repaired.indexPosition,
      }),
    );
    setStorageUsage(readStorageUsage());
    setShareNotice("연결선 강제 정리 완료");

    window.setTimeout(() => {
      skipHistoryRef.current = false;
      lastHistorySignatureRef.current = JSON.stringify(repaired);
    }, 0);
  }

  function restoreSnapshot(snapshot: BoardSnapshot) {
    if (!window.confirm("현재 보드 상태를 이 시점으로 복원할까요?")) return;
    setHistoryPast((current) => [...current, lightweightBoardState(currentBoardState())].slice(-MAX_HISTORY));
    setHistoryFuture([]);
    restoreBoardState(snapshot.data);
  }

  function deleteSnapshot(id: string) {
    setSnapshots((current) => current.filter((snapshot) => snapshot.id !== id));
  }

  function undoBoard() {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((current) => current.slice(0, -1));
    setHistoryFuture((current) => [lightweightBoardState(currentBoardState()), ...current].slice(0, MAX_HISTORY));
    restoreBoardState(previous);
  }

  function redoBoard() {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((current) => current.slice(1));
    setHistoryPast((current) => [...current, lightweightBoardState(currentBoardState())].slice(-MAX_HISTORY));
    restoreBoardState(next);
  }

  function worldFromPointer(clientX: number, clientY: number) {
    const rect = spaceRef.current?.getBoundingClientRect();
    const x = clientX - (rect?.left ?? 0);
    const y = clientY - (rect?.top ?? 0);

    return {
      x: (x - viewport.width / 2) / cameraRef.current.zoom + cameraRef.current.x,
      y: (y - viewport.height / 2) / cameraRef.current.zoom + cameraRef.current.y,
    };
  }

  function scheduleGaze(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || viewport.width < 760) return;
    if (isPerformanceMode || !gazePanEnabledRef.current) {
      autoPanCursorRef.current.active = false;
      return;
    }
    if (pointerOverUiRef.current || (event.target instanceof HTMLElement && event.target.closest(FLOATING_INTERACTION_SELECTOR))) {
      autoPanCursorRef.current.active = false;
      return;
    }

    autoPanCursorRef.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
    };

    const next = {
      x: clamp((event.clientX - viewport.width / 2) / (viewport.width / 2), -1, 1),
      y: clamp((event.clientY - viewport.height / 2) / (viewport.height / 2), -1, 1),
    };
    pendingGazeRef.current = next;
    if (gazeFrameRef.current) return;

    gazeFrameRef.current = requestAnimationFrame(() => {
      gazeFrameRef.current = 0;
      setGaze((current) => ({
        x: current.x + (pendingGazeRef.current.x - current.x) * 0.16,
        y: current.y + (pendingGazeRef.current.y - current.y) * 0.16,
      }));
    });
  }

  function descendantIds(rootId: string) {
    const ids = new Set<string>([rootId]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const node of simRef.current) {
        if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
          ids.add(node.id);
          changed = true;
        }
      }
    }

    return ids;
  }

  function persistNodePositions(ids: Set<string>) {
    setNodeOverrides((current) => {
      const next = { ...current };
      for (const id of ids) {
        const node = simRef.current.find((item) => item.id === id);
        if (!node) continue;
        next[id] = {
          ...next[id],
          x: node.x,
          y: node.y,
          label: node.label,
          color: node.color,
        };
      }
      return next;
    });
  }

  function updateMemoText(id: string, value: string) {
    setMemos((current) =>
      current.map((memo) =>
        memo.id === id
          ? {
              ...memo,
              text: value,
              updatedAt: new Date().toISOString(),
            }
          : memo,
      ),
    );
  }

  function startDetailEdit(mode: "summary" | "full") {
    setDetailEditMode(mode);
    setDetailDraft(mode === "full" ? selectedMemo?.text ?? "" : selectedDetailText);
  }

  function saveDetailEdit() {
    if (!selectedMemo || !selectedNode || !detailEditMode) return;

    if (detailEditMode === "full") {
      updateMemoText(selectedMemo.id, detailDraft);
    } else {
      setMemos((current) =>
        current.map((memo) => {
          if (memo.id !== selectedMemo.id) return memo;
          const analysis = memo.analysis ?? {
            projectTitle: selectedNode.project,
            projectSummary: "",
            categories: [],
            keywords: memo.keywords,
            suggestedNodes: [],
            relatedTextSnippets: [],
          };

          if (selectedNode.level === "project") {
            return {
              ...memo,
              analysis: {
                ...analysis,
                projectSummary: detailDraft,
              },
              updatedAt: new Date().toISOString(),
            };
          }

          const snippets = analysis.relatedTextSnippets ?? [];
          const hasSnippet = snippets.some((snippet) => snippet.label === selectedNode.label);

          return {
            ...memo,
            analysis: {
              ...analysis,
              relatedTextSnippets: hasSnippet
                ? snippets.map((snippet) => (snippet.label === selectedNode.label ? { ...snippet, text: detailDraft } : snippet))
                : [...snippets, { label: selectedNode.label, text: detailDraft }],
            },
            updatedAt: new Date().toISOString(),
          };
        }),
      );
    }

    setDetailEditMode(null);
    setDetailDraft("");
  }

  function cancelDetailEdit() {
    setDetailEditMode(null);
    setDetailDraft("");
  }

  function startLayerDrag(
    layer: LayerName,
    event: React.PointerEvent<HTMLElement>,
    position: DetailPosition,
  ) {
    event.stopPropagation();
    setActiveLayer(layer);
    if (isInteractiveTarget(event.target)) return;
    layerDragRef.current = {
      layer,
      x: event.clientX,
      y: event.clientY,
      startX: position.x,
      startY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateNodeLabel(id: string, label: string) {
    setNodeOverrides((current) => ({
      ...current,
      [id]: {
        ...current[id],
        label,
      },
    }));
    setMemos((current) =>
      current.map((memo) => ({
        ...memo,
        manualNodes: memo.manualNodes?.map((node) => (node.id === id ? { ...node, label } : node)),
        updatedAt: memo.manualNodes?.some((node) => node.id === id) ? new Date().toISOString() : memo.updatedAt,
      })),
    );
    simRef.current = simRef.current.map((node) => (node.id === id ? { ...node, label } : node));
    setSimNodes(simRef.current.map((node) => ({ ...node })));
  }

  function updateNodeColor(id: string, color: string) {
    setNodeOverrides((current) => ({
      ...current,
      [id]: {
        ...current[id],
        color,
      },
    }));
    setMemos((current) =>
      current.map((memo) => ({
        ...memo,
        manualNodes: memo.manualNodes?.map((node) => (node.id === id ? { ...node, color } : node)),
        updatedAt: memo.manualNodes?.some((node) => node.id === id) ? new Date().toISOString() : memo.updatedAt,
      })),
    );
    simRef.current = simRef.current.map((node) => (node.id === id ? { ...node, color } : node));
    setSimNodes(simRef.current.map((node) => ({ ...node })));
  }

  function deleteNode(id: string) {
    deleteNodeIds(descendantIds(id));
  }

  function deleteNodeIds(ids: Set<string>) {
    if (ids.size === 0) return;
    setNodeOverrides((current) => ({
      ...current,
      ...Array.from(ids).reduce<Record<string, NodeOverride>>((next, nodeId) => {
        next[nodeId] = {
          ...current[nodeId],
          deleted: true,
        };
        return next;
      }, {}),
    }));
    simRef.current = simRef.current.filter((node) => !ids.has(node.id));
    setSimNodes(simRef.current.map((node) => ({ ...node })));
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedMemoId(null);
    setSelectedLinkId(null);
    setCurrentPocketId((current) => (current && ids.has(current) ? null : current));
    setEditingNodeId(null);
  }

  function deleteSelectedNodes() {
    if (selectedNodeIds.length > 0) {
      deleteNodeIds(new Set(selectedNodeIds));
      return;
    }
    if (selectedNodeId) deleteNodeIds(new Set([selectedNodeId]));
  }

  async function addImagesToNode(id: string, files: FileList | null) {
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, 6);
    if (imageFiles.length === 0) return;
    setImageNotice("");

    try {
      const linkedNode = simRef.current.find((node) => node.id === id);
      const resized = await Promise.all(imageFiles.map((file, index) => resizeImageFile(file).then((image) => {
        const angle = ((hashString(`${image.id}-${index}`) % 360) / 180) * Math.PI;
        const radius = linkedNode?.level === "project" ? 250 : 160;

        return {
          ...image,
          linkedNodeId: id,
          keywords: linkedNode ? [linkedNode.label] : [],
          x: (linkedNode?.x ?? targetCameraRef.current.x) + Math.cos(angle) * (radius + index * 26),
          y: (linkedNode?.y ?? targetCameraRef.current.y) + Math.sin(angle) * radius * 0.7,
          z: index * 12,
        };
      })));
      resized.forEach((image) => saveImageAsset({
        id: image.id,
        src: image.src,
        fileName: image.name,
        name: image.name,
        createdAt: image.createdAt,
      }));
      setNodeOverrides((current) => ({
        ...current,
        [id]: {
          ...current[id],
          images: [...(current[id]?.images ?? []), ...resized].slice(0, 8),
        },
      }));
    } catch (error) {
      setImageNotice(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    }
  }

  function deleteNodeImage(nodeId: string, imageId: string) {
    setNodeOverrides((current) => ({
      ...current,
      [nodeId]: {
        ...current[nodeId],
        images: current[nodeId]?.images?.filter((image) => image.id !== imageId) ?? [],
      },
    }));
    setPreviewImage((current) => (current?.id === imageId ? null : current));
    setSelectedImageId((current) => (current === imageId ? null : current));
  }

  function openLinkUrl(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function addLinkToNode(nodeId: string) {
    const linkedNode = simRef.current.find((node) => node.id === nodeId);
    const link = makeLinkNode(linkUrl, nodeId, linkedNode);
    if (!link) {
      setLinkError("올바른 URL을 입력해주세요.");
      return;
    }

    setNodeOverrides((current) => ({
      ...current,
      [nodeId]: {
        ...current[nodeId],
        links: [...(current[nodeId]?.links ?? []), link],
      },
    }));
    setLinkModalNodeId(null);
    setLinkUrl("");
    setLinkError("");
  }

  function deleteNodeLink(nodeId: string, linkId: string) {
    setNodeOverrides((current) => ({
      ...current,
      [nodeId]: {
        ...current[nodeId],
        links: current[nodeId]?.links?.filter((link) => link.id !== linkId) ?? [],
      },
    }));
    setSelectedLinkId((current) => (current === linkId ? null : current));
  }

  function closeImageModal() {
    setPreviewImage(null);
    setSelectedImageId(null);
    setGalleryMode("slide");
  }

  function showGalleryImage(index: number) {
    if (galleryImages.length === 0) return;
    const nextIndex = (index + galleryImages.length) % galleryImages.length;
    setPreviewImage(galleryImages[nextIndex]);
    setSelectedImageId(galleryImages[nextIndex].id);
  }

  function shiftGallery(direction: number) {
    showGalleryImage(galleryIndex + direction);
  }

  function updateNodeImagePosition(linkedNodeId: string, imageId: string, x: number, y: number) {
    setNodeOverrides((current) => ({
      ...current,
      [linkedNodeId]: {
        ...current[linkedNodeId],
        images: current[linkedNodeId]?.images?.map((image) => (image.id === imageId ? { ...image, x, y } : image)) ?? [],
      },
    }));
  }

  function updateNodeLinkPosition(linkedNodeId: string, linkId: string, x: number, y: number) {
    setNodeOverrides((current) => ({
      ...current,
      [linkedNodeId]: {
        ...current[linkedNodeId],
        links: current[linkedNodeId]?.links?.map((link) => (link.id === linkId ? { ...link, x, y } : link)) ?? [],
      },
    }));
  }

  function flushPendingMediaPosition() {
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
  }

  function scheduleImagePositionUpdate(linkedNodeId: string, imageId: string, x: number, y: number) {
    pendingImagePositionRef.current = { linkedNodeId, imageId, x, y };
    if (mediaPositionFrameRef.current !== null) return;
    mediaPositionFrameRef.current = window.requestAnimationFrame(flushPendingMediaPosition);
  }

  function scheduleLinkPositionUpdate(linkedNodeId: string, linkId: string, x: number, y: number) {
    pendingLinkPositionRef.current = { linkedNodeId, linkId, x, y };
    if (mediaPositionFrameRef.current !== null) return;
    mediaPositionFrameRef.current = window.requestAnimationFrame(flushPendingMediaPosition);
  }

  function moveImagesForNodes(ids: Set<string>, dx: number, dy: number) {
    setNodeOverrides((current) => {
      let changed = false;
      const next = { ...current };

      for (const [ownerNodeId, override] of Object.entries(next)) {
        const images = override.images;
        if (!images?.length) continue;

        next[ownerNodeId] = {
          ...override,
          images: images.map((image) => {
            const linkedNodeId = image.linkedNodeId ?? ownerNodeId;
            if (!ids.has(linkedNodeId)) return image;

            if (typeof image.x !== "number" || typeof image.y !== "number") return image;

            changed = true;

            return {
              ...image,
              linkedNodeId,
              x: image.x + dx,
              y: image.y + dy,
            };
          }),
        };
      }

      for (const [ownerNodeId, override] of Object.entries(next)) {
        const links = override.links;
        if (!links?.length) continue;

        next[ownerNodeId] = {
          ...next[ownerNodeId],
          links: links.map((link) => {
            const linkedNodeId = link.linkedNodeId ?? ownerNodeId;
            if (!ids.has(linkedNodeId)) return link;

            if (typeof link.x !== "number" || typeof link.y !== "number") return link;

            changed = true;

            return {
              ...link,
              linkedNodeId,
              x: link.x + dx,
              y: link.y + dy,
            };
          }),
        };
      }

      return changed ? next : current;
    });
  }

  function generateImageForNode(nodeId: string, prompt: string) {
    setImageNotice(`"${prompt || nodeId}" 이미지 생성은 다음 단계에서 연결 예정입니다.`);
  }

  function addChildNode(parent: SimNode) {
    const childLevel: NodeLevel = parent.level === "project" ? "category" : "detail";
    const childId = `${parent.memo.id}-manual-${crypto.randomUUID()}`;
    const angle = ((hashString(childId) % 360) / 180) * Math.PI;
    const distance = parent.level === "project" ? 230 : 150;
    const x = parent.x + Math.cos(angle) * distance;
    const y = parent.y + Math.sin(angle) * distance * 0.72;

    setMemos((current) =>
      current.map((memo) =>
        memo.id === parent.memo.id
          ? {
              ...memo,
              manualNodes: [
                ...(memo.manualNodes ?? []),
                {
                  id: childId,
                  label: "새 생각",
                  parentId: parent.id,
                  level: childLevel,
                  color: parent.color,
                },
              ],
              updatedAt: new Date().toISOString(),
            }
          : memo,
      ),
    );
    setNodeOverrides((current) => ({
      ...current,
      [childId]: {
        label: "새 생각",
        color: parent.color,
        x,
        y,
      },
    }));
    setSelectedMemoId(parent.memo.id);
    setSelectedNodeId(childId);
    setEditingNodeId(childId);
  }

  function addMemo() {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!analysisPreview) {
      setAnalysisPreview(analyzeMemoLocally(trimmed, inputMode));
      return;
    }

    const memo: MemoItem = {
      id: crypto.randomUUID(),
      text: trimmed,
      keywords: analysisPreview.keywords,
      createdAt: new Date().toISOString(),
      analysis: analysisPreview,
    };

    setMemos((current) => [memo, ...current]);
    if (memos.length === 0 || analysisPreview.suggestedNodes.length > 0) {
      setSnapshots((current) =>
        [
          {
            id: crypto.randomUUID(),
            name: `Auto Save - ${formatSnapshotName()}`,
            createdAt: new Date().toISOString(),
            data: lightweightBoardState({ ...currentBoardState(), memos: [memo, ...memos] }),
            auto: true,
          },
          ...current,
        ].slice(0, MAX_SNAPSHOTS),
      );
    }
    setSelectedMemoId(memo.id);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setText("");
    setAnalysisPreview(null);
  }

  async function analyzeWithAi() {
    const trimmed = text.trim();
    if (!trimmed || isAiAnalyzing) return;

    setAnalysisError("");
    setAiProgressIndex(0);

    const cacheKey = analysisCacheKey(trimmed, inputMode);
    const cache = readAnalysisCache();
    if (cache[cacheKey]) {
      setAnalysisPreview(cache[cacheKey]);
      return;
    }

    const usage = readAnalysisUsage();
    if (usage.count >= DAILY_ANALYSIS_LIMIT) {
      setAnalysisError(`오늘 AI 구조화 한도 ${DAILY_ANALYSIS_LIMIT}회를 모두 사용했습니다.`);
      return;
    }

    setIsAiAnalyzing(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: trimmed, mode: inputMode }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "AI 분석에 실패했습니다.");
      }

      const preview = mapApiAnalysisToPreview(data as ApiAnalysisResponse);
      setAnalysisPreview(preview);
      writeAnalysisCache({ ...cache, [cacheKey]: preview });
      incrementAnalysisUsage();
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "AI 분석에 실패했습니다.");
    } finally {
      setIsAiAnalyzing(false);
    }
  }

  function clearAll() {
    setMemos([]);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedImageId(null);
    setSelectedMemoId(null);
    setCurrentPocketId(null);
    setNodeOverrides({});
    setAnalysisPreview(null);
  }

  function clearFocus() {
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedImageId(null);
    setSelectedLinkId(null);
    setSelectedMemoId(null);
    setCurrentPocketId(null);
    setEditingNodeId(null);
    setPreviewImage(null);
    setLinkModalNodeId(null);
  }

  function panStart(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (event.shiftKey) {
      suppressNextCanvasClickRef.current = true;
      startSelectionDrag(event);
      return;
    }
    panRef.current = { active: true, moved: false, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function panMove(event: React.PointerEvent<HTMLElement>) {
    scheduleGaze(event);

    if (updateSelectionDrag(event.clientX, event.clientY)) return;

    if (layerDragRef.current) {
      const dx = event.clientX - layerDragRef.current.x;
      const dy = event.clientY - layerDragRef.current.y;
      const next = {
        x: clamp(
          layerDragRef.current.startX + (layerDragRef.current.layer === "detail" ? -dx : dx),
          12,
          viewport.width - 220,
        ),
        y: clamp(
          layerDragRef.current.startY + (layerDragRef.current.layer === "input" ? dy : -dy),
          12,
          viewport.height - 160,
        ),
      };
      if (layerDragRef.current.layer === "input") setInputPosition(next);
      if (layerDragRef.current.layer === "index") setIndexPosition(next);
      if (layerDragRef.current.layer === "detail") setDetailPosition(next);
      return;
    }

    const imageDragging = dragImageRef.current;
    if (imageDragging) {
      const point = worldFromPointer(event.clientX, event.clientY);
      const image = imageNodes.find((item) => item.id === imageDragging.id);
      if (image) {
        const dx = point.x - imageDragging.lastX;
        const dy = point.y - imageDragging.lastY;
        image.x += dx;
        image.y += dy;
        imageDragging.lastX = point.x;
        imageDragging.lastY = point.y;
        imageDragging.moved = true;
        scheduleImagePositionUpdate(imageDragging.linkedNodeId, imageDragging.id, image.x, image.y);
      }
      return;
    }

    const linkDragging = dragLinkRef.current;
    if (linkDragging) {
      const point = worldFromPointer(event.clientX, event.clientY);
      const link = linkNodes.find((item) => item.id === linkDragging.id);
      if (link) {
        const dx = point.x - linkDragging.lastX;
        const dy = point.y - linkDragging.lastY;
        link.x += dx;
        link.y += dy;
        linkDragging.lastX = point.x;
        linkDragging.lastY = point.y;
        linkDragging.moved = true;
        scheduleLinkPositionUpdate(linkDragging.linkedNodeId, linkDragging.id, link.x, link.y);
      }
      return;
    }

    const dragging = dragNodeRef.current;

    if (dragging) {
      const point = worldFromPointer(event.clientX, event.clientY);
      const node = simRef.current.find((item) => item.id === dragging.id);
      if (node) {
        const dx = point.x - dragging.lastX;
        const dy = point.y - dragging.lastY;
        const ids = dragging.ids ?? (dragging.structure ? descendantIds(dragging.id) : new Set([dragging.id]));
        for (const moved of simRef.current) {
          if (!ids.has(moved.id)) continue;
          moved.x += dx;
          moved.y += dy;
          moved.vx = 0;
          moved.vy = 0;
          moved.locked = true;
        }
        groupImageDragRef.current = {
          ids,
          dx: (groupImageDragRef.current?.dx ?? 0) + dx,
          dy: (groupImageDragRef.current?.dy ?? 0) + dy,
        };
        dragging.lastX = point.x;
        dragging.lastY = point.y;
        node.vx = 0;
        node.vy = 0;
        node.locked = true;
        dragging.moved = true;
      }
      return;
    }

    if (!panRef.current.active) return;
    const dx = event.clientX - panRef.current.x;
    const dy = event.clientY - panRef.current.y;
    const next = {
      ...targetCameraRef.current,
      x: targetCameraRef.current.x - dx / cameraRef.current.zoom,
      y: targetCameraRef.current.y - dy / cameraRef.current.zoom,
    };

    targetCameraRef.current = next;
    cameraRef.current = next;
    setCamera(next);
    panRef.current = {
      active: true,
      moved: panRef.current.moved || Math.abs(dx) > 2 || Math.abs(dy) > 2,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function panEnd() {
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
      for (const node of simRef.current) {
        if (ids.has(node.id)) {
          node.locked = false;
          node.fixed = true;
        }
      }
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
  }

  function zoomSpace(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const nextZoom = clamp(targetCameraRef.current.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.45, 2.25);
    targetCameraRef.current = { ...targetCameraRef.current, zoom: nextZoom };
  }

  function stopFloatingWheel(event: React.WheelEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function stopFloatingPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (layerDragRef.current) panMove(event);
    event.stopPropagation();
  }

  function stopFloatingTouchMove(event: React.TouchEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function activeUploadNodeId() {
    return selectedNodeId ?? simRef.current[0]?.id ?? null;
  }

  async function uploadToActiveNode(files: FileList | null) {
    const id = activeUploadNodeId();
    if (!id) {
      setImageNotice("이미지를 연결할 키워드를 먼저 선택해주세요.");
      return;
    }
    await addImagesToNode(id, files);
  }

  return (
    <main
      className={`thought-space ${isPerformanceMode ? "performance-mode" : ""}`}
      ref={spaceRef}
      style={{
        "--perspective-depth": `${PERSPECTIVE_DEPTH}px`,
        "--space-tilt-x": `${clamp(camera.y / 1600, -1, 1) * SPACE_TILT_STRENGTH}deg`,
        "--space-tilt-y": `${clamp(-camera.x / 1600, -1, 1) * SPACE_TILT_STRENGTH}deg`,
        "--space-fog-tilt-x": `${clamp(camera.y / 1600, -1, 1) * SPACE_TILT_STRENGTH * 0.7}deg`,
        "--space-fog-tilt-y": `${clamp(-camera.x / 1600, -1, 1) * SPACE_TILT_STRENGTH * 0.7}deg`,
        "--space-link-tilt-x": `${clamp(camera.y / 1600, -1, 1) * SPACE_TILT_STRENGTH * 0.35}deg`,
        "--space-link-tilt-y": `${clamp(-camera.x / 1600, -1, 1) * SPACE_TILT_STRENGTH * 0.35}deg`,
        "--gaze-x": `${gaze.x * GAZE_PARALLAX_STRENGTH}px`,
        "--gaze-y": `${gaze.y * GAZE_PARALLAX_STRENGTH}px`,
        "--gaze-rotate-x": `${-gaze.y * GAZE_PARALLAX_STRENGTH * 0.42}deg`,
        "--gaze-rotate-y": `${gaze.x * GAZE_PARALLAX_STRENGTH * 0.52}deg`,
        "--gaze-bg-x": `${gaze.x * GAZE_PARALLAX_STRENGTH * 0.55}px`,
        "--gaze-bg-y": `${gaze.y * GAZE_PARALLAX_STRENGTH * 0.55}px`,
      } as React.CSSProperties}
      onPointerDown={panStart}
      onPointerDownCapture={(event) => {
        console.log("RAW CANVAS POINTER DOWN", event.shiftKey, event.target);
      }}
      onPointerMove={panMove}
      onPointerUp={panEnd}
      onPointerCancel={panEnd}
      onPointerLeave={() => {
        autoPanCursorRef.current.active = false;
        pointerOverUiRef.current = false;
      }}
      onWheel={zoomSpace}
      onClick={(event) => {
        if (suppressNextCanvasClickRef.current) {
          suppressNextCanvasClickRef.current = false;
          console.log("selection persisted", selectedNodeIdsRef.current.length);
          return;
        }
        if (event.target !== event.currentTarget) return;
        if (detailEditMode) return;
        if (lastDragMovedRef.current) {
          lastDragMovedRef.current = false;
          return;
        }
        clearFocus();
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        void uploadToActiveNode(event.dataTransfer.files);
      }}
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget) setEditingNodeId(null);
      }}
    >
      <div className="conscious-space pointer-events-none absolute inset-0" />
      <div className="light-fog pointer-events-none absolute inset-0" />
      <div className="selection-debug ui-layer" {...uiLayerEvents}>
        Selected: {selectedNodeIds.length}
      </div>
      {selectionRect && (
        <div
          className="selection-rectangle pointer-events-none"
          style={{
            left: selectionBounds(selectionRect).left,
            top: selectionBounds(selectionRect).top,
            width: selectionBounds(selectionRect).right - selectionBounds(selectionRect).left,
            height: selectionBounds(selectionRect).bottom - selectionBounds(selectionRect).top,
          }}
        />
      )}
      <div className="particle-field pointer-events-none absolute inset-0">
        {particles.map((particle) => (
          <span
            key={particle.id}
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
              opacity: particle.opacity,
            }}
          />
        ))}
      </div>

      <button
        aria-pressed={isGazePanEnabled}
        className={`gaze-toggle ui-layer ${isGazePanEnabled ? "gaze-toggle-on" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          setIsGazePanEnabled((enabled) => !enabled);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
        {...uiLayerEvents}
      >
        👁
      </button>

      <svg className="thought-links pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="mind-link" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0.02)" />
            <stop offset="50%" stopColor="rgba(0, 0, 0, 0.2)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.04)" />
          </linearGradient>
        </defs>
        {graphEdges.map((edge) => {
          const source = simNodes.find((node) => node.id === edge.source);
          const target = simNodes.find((node) => node.id === edge.target);
          if (!source || !target) return null;

          const sourceScreen = screenPosition(source);
          const targetScreen = screenPosition(target);
          const active = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);
          const sameActiveProject = selectedNode ? source.project === selectedNode.project || target.project === selectedNode.project : true;
          const opacity = active ? 0.92 : sameActiveProject ? 0.62 : 0.24;
          const project = source.level === "project" ? source.project : target.project;

          return (
            <line
              key={edge.id}
              x1={sourceScreen.x}
              x2={targetScreen.x}
              y1={sourceScreen.y}
              y2={targetScreen.y}
              className={active ? "thought-link thought-link-active" : "thought-link"}
              opacity={opacity}
              stroke={projectLineColor(project, edge.id, 1)}
              strokeWidth={edgeLineWidth(source, target, Boolean(active))}
            />
          );
        })}
        {imageNodes.map((image) => {
          const source = simNodes.find((node) => node.id === image.linkedNodeId);
          if (!source) return null;

          const sourceScreen = screenPosition(source);
          const targetScreen = imageScreenPosition(image);
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
          const source = simNodes.find((node) => node.id === link.linkedNodeId);
          if (!source) return null;

          const sourceScreen = screenPosition(source);
          const targetScreen = imageScreenPosition(link);
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

      {simNodes.length === 0 && (
        <div className="empty-whisper pointer-events-none">생각을 입력하면 공간이 열립니다.</div>
      )}

      {showOnboarding && (
        <div className="onboarding-whisper pointer-events-none">
          Click a thought. Move through the space. Scroll only when you want distance.
        </div>
      )}

      {visibleNodes.map((node) => {
        const position = screenPosition(node);
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
        const neighbor = selectedNodeId && selectedNeighbors.has(node.id);
        const curveX = clamp((position.x - viewport.width / 2) / (viewport.width / 2), -1, 1);
        const curveY = clamp((position.y - viewport.height / 2) / (viewport.height / 2), -1, 1);
        const edgeDepth = (Math.abs(curveX) + Math.abs(curveY)) * -DEPTH_STRENGTH * 0.42;
        const focusDepth = selected
          ? FOCUS_ZOOM_STRENGTH * 1.32
          : ancestor
            ? FOCUS_ZOOM_STRENGTH * 0.62
            : neighbor
              ? FOCUS_ZOOM_STRENGTH * 0.32
              : 0;
        const zDepth = edgeDepth + focusDepth - clamp(distance / 18, 0, DEPTH_STRENGTH);
        const ancestorOpacity = ancestor ? clamp(0.7 - ancestorIndex * 0.15, 0.32, 0.7) : 0;
        const ancestorBlur = isPerformanceMode ? 0 : ancestor ? clamp(0.25 + ancestorIndex * 0.12, 0.25, 0.5) : 0;
        const depthOpacity = selected || multiSelected || hovered ? 1 : ancestor ? ancestorOpacity : clamp(1 - distance / 1900 + zDepth / 1400, 0.46, 0.96);
        const depthBlur = isPerformanceMode || selected || multiSelected || hovered ? 0 : ancestor ? ancestorBlur : clamp(distance / 1600 - zDepth / 900, 0, 0.35);
        const edgeAmount = Math.min(1, Math.hypot(curveX, curveY));
        const curveRotateY = -curveX * CURVE_STRENGTH + gaze.x * GAZE_PARALLAX_STRENGTH * 0.8;
        const curveRotateX = curveY * CURVE_STRENGTH * 0.72 - gaze.y * GAZE_PARALLAX_STRENGTH * 0.6;
        const scale =
          (selected
            ? 1.72
            : multiSelected
              ? node.level === "project" ? 1.1 : 0.94
            : ancestor
              ? clamp(1.2 + ancestorIndex * 0.15, 1.2, 1.5)
              : neighbor
              ? node.level === "project" ? 1.22 : 1.08
              : node.level === "project" ? 0.86 : node.level === "category" ? 0.72 : 0.6) *
          (ancestor && !selected ? 1 : clamp(1 + zDepth / 900, 0.78, 1.16)) *
          (1 - edgeAmount * EDGE_DISTORTION_STRENGTH) *
          (hovered && !selected ? 1.08 : 1) *
          camera.zoom;

        const activateNode = (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
          if (lastDragMovedRef.current) {
            lastDragMovedRef.current = false;
            return;
          }
          if (suppressNextCanvasClickRef.current) {
            suppressNextCanvasClickRef.current = false;
            event.preventDefault();
            console.log("selection persisted", selectedNodeIdsRef.current.length);
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
            onClickCapture={(event) => {
              console.log("RAW NODE CLICK", node.id, event.shiftKey);
            }}
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
              if (!isPerformanceMode) setHoveredNodeId((current) => (current === node.id ? null : current));
            }}
            onPointerDown={(event) => {
              console.log("RAW NODE POINTER DOWN", node.id, event.shiftKey);
              event.stopPropagation();
              if (event.shiftKey) return;
              const point = worldFromPointer(event.clientX, event.clientY);
              const groupIds = selectedNodeIdSet.has(node.id) && selectedNodeIds.length > 1 ? new Set(selectedNodeIds) : undefined;
              const groupDrag = Boolean(groupIds) || isStructureEdit || node.level !== "detail";
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
              transform: `translate(-50%, -50%) translate3d(${gaze.x * GAZE_PARALLAX_STRENGTH * 0.72}px, ${gaze.y * GAZE_PARALLAX_STRENGTH * 0.58}px, ${zDepth}px) rotateX(${curveRotateX}deg) rotateY(${curveRotateY}deg) scale(${scale})`,
            }}
          >
            {editingNodeId === node.id ? (
              <span
                className="node-editor floating-action-layer"
                {...uiLayerEvents}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <input
                  autoFocus
                  value={nodeOverrides[node.id]?.label ?? node.label}
                  onChange={(event) => updateNodeLabel(node.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setEditingNodeId(null);
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
                  {colorLabels.map((color) => (
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
              <span className="node-actions floating-action-layer" {...uiLayerEvents} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                <button onClick={() => setEditingNodeId(node.id)} type="button">Edit</button>
                <button onClick={() => enterThoughtPocket(node)} type="button">진입</button>
                <button onClick={() => addChildNode(node)} type="button">+</button>
                <button
                  onClick={() => {
                    setLinkModalNodeId(node.id);
                    setLinkUrl("");
                    setLinkError("");
                  }}
                  type="button"
                >
                  🔗
                </button>
                <label className="node-upload">
                  Img
                  <input
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                      void addImagesToNode(node.id, event.target.files);
                      event.currentTarget.value = "";
                    }}
                    type="file"
                  />
                </label>
                <button onClick={() => generateImageForNode(node.id, node.label)} type="button">AI</button>
                <button onClick={() => deleteNode(node.id)} type="button">Del</button>
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
        const directFocus = Boolean(selectedNodeId && image.linkedNodeId === selectedNodeId);
        const nearbyFocus = Boolean(
          selectedNode &&
            linkedNode &&
            (selectedNeighbors.has(linkedNode.id) ||
              selectedAncestors.has(linkedNode.id) ||
              linkedNode.parentId === selectedNode.id ||
              selectedNode.parentId === linkedNode.id ||
              linkedNode.parentId === selectedNode.parentId),
        );
        const activeProjectImage = Boolean(selectedNode && linkedNode?.project === selectedNode.project);
        const innerHidden = Boolean(currentPocketId && image.linkedNodeId && !innerSpaceNodeIds.has(image.linkedNodeId));
        const distance = Math.hypot(image.x - camera.x, image.y - camera.y);
        const curveX = clamp((position.x - viewport.width / 2) / (viewport.width / 2), -1, 1);
        const curveY = clamp((position.y - viewport.height / 2) / (viewport.height / 2), -1, 1);
        const edgeAmount = Math.min(1, Math.hypot(curveX, curveY));
        const depthState = selected || directFocus
          ? { opacity: 1, scale: selected ? 1.34 : 1 }
          : nearbyFocus
            ? { opacity: 0.75, scale: 0.92 }
            : activeProjectImage
              ? { opacity: 0.5, scale: 0.82 }
              : selectedNode
                ? { opacity: 0.32, scale: 0.72 }
                : {
                    opacity: clamp(1 - distance / 2100, 0.54, 0.9),
                    scale: image.level === "project" ? 1 : 0.84,
                  };
        const opacity = innerHidden ? 0.16 : hovered && !selected ? clamp(depthState.opacity + 0.25, 0, 1) : depthState.opacity;
        const scale = (depthState.scale + (hovered && !selected ? 0.08 : 0)) * (1 - edgeAmount * EDGE_DISTORTION_STRENGTH) * camera.zoom;
        const zDepth = selected ? 180 : hovered ? 82 : image.z ?? 0;
        const rotateX = curveY * CURVE_STRENGTH * 0.45 - gaze.y * GAZE_PARALLAX_STRENGTH * 0.45;
        const rotateY = -curveX * CURVE_STRENGTH * 0.7 + gaze.x * GAZE_PARALLAX_STRENGTH * 0.65;

        return (
          <figure
            className={`image-node interaction-safe-zone ${selected ? "image-node-selected" : ""}`}
            {...uiLayerEvents}
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
              setGalleryMode("slide");
              setPreviewImage(image);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              const point = worldFromPointer(event.clientX, event.clientY);
              dragImageRef.current = {
                id: image.id,
                linkedNodeId: image.linkedNodeId ?? "",
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
              filter: undefined,
              zIndex: selected ? 31 : hovered ? 22 : 10,
              transform: `translate(-50%, -50%) translate3d(${gaze.x * GAZE_PARALLAX_STRENGTH * 0.9}px, ${gaze.y * GAZE_PARALLAX_STRENGTH * 0.72}px, ${zDepth}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotate(${[-5, 3, -2, 6, -7, 4][index % 6]}deg) scale(${scale})`,
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
        const curveX = clamp((position.x - viewport.width / 2) / (viewport.width / 2), -1, 1);
        const curveY = clamp((position.y - viewport.height / 2) / (viewport.height / 2), -1, 1);
        const edgeAmount = Math.min(1, Math.hypot(curveX, curveY));
        const opacity = innerHidden ? 0.16 : selected || hovered ? 1 : clamp(1 - distance / 2100, 0.54, 0.94);
        const scale = (selected ? 1.25 : hovered ? 1.08 : 0.86) * (1 - edgeAmount * EDGE_DISTORTION_STRENGTH) * camera.zoom;
        const zDepth = selected ? 165 : hovered ? 72 : link.z ?? 0;
        const rotateX = curveY * CURVE_STRENGTH * 0.38 - gaze.y * GAZE_PARALLAX_STRENGTH * 0.36;
        const rotateY = -curveX * CURVE_STRENGTH * 0.62 + gaze.x * GAZE_PARALLAX_STRENGTH * 0.52;

        return (
          <figure
            className={`link-node interaction-safe-zone link-node-${link.source} ${selected ? "link-node-selected" : ""}`}
            {...uiLayerEvents}
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
              openLinkUrl(link.url);
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
              filter: undefined,
              zIndex: selected ? 31 : hovered ? 22 : 10,
              transform: `translate(-50%, -50%) translate3d(${gaze.x * GAZE_PARALLAX_STRENGTH * 0.82}px, ${gaze.y * GAZE_PARALLAX_STRENGTH * 0.64}px, ${zDepth}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotate(${[-3, 2, -1, 4][index % 4]}deg) scale(${scale})`,
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
              <span className="link-card interaction-safe-zone">
                <strong>{link.title ?? link.source}</strong>
                <small>{link.url.replace(/^https?:\/\//, "").slice(0, 42)}</small>
              </span>
            )}
            <figcaption>
              <span>{link.linkedLabel}</span>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  openLinkUrl(link.url);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                type="button"
              >
                열기
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  deleteNodeLink(link.linkedNodeId, link.id);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                type="button"
              >
                삭제
              </button>
            </figcaption>
          </figure>
        );
      })}

      <section
        className="input-layer glass-layer draggable-layer ui-layer"
        {...uiLayerEvents}
        onPointerDown={(event) => startLayerDrag("input", event, inputPosition)}
        onPointerMove={stopFloatingPointerMove}
        onTouchMove={stopFloatingTouchMove}
        onWheel={stopFloatingWheel}
        style={{ left: inputPosition.x, top: inputPosition.y, zIndex: activeLayer === "input" ? 70 : 40 }}
      >
        <p className="layer-kicker">Mind Orbit</p>
        <div className="input-mode-toggle" role="group" aria-label="입력 모드">
          <button
            className={inputMode === "memo" ? "input-mode-active" : ""}
            onClick={() => {
              setInputMode("memo");
              setAnalysisPreview(null);
              setAnalysisError("");
            }}
            type="button"
          >
            메모 입력
          </button>
          <button
            className={inputMode === "question" ? "input-mode-active" : ""}
            onClick={() => {
              setInputMode("question");
              setAnalysisPreview(null);
              setAnalysisError("");
            }}
            type="button"
          >
            질문 입력
          </button>
        </div>
        <textarea
          className="thought-input"
          placeholder={inputMode === "question" ? "질문을 적으면 Thought Pocket으로 구조화됩니다." : "생각을 적으면 공간에 배치됩니다."}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setAnalysisPreview(null);
            setAnalysisError("");
          }}
        />
        {isAiAnalyzing && (
          <div className="ai-analysis-status" aria-live="polite">
            <span>{inputMode === "question" ? "AI가 Thought Pocket을 분석 중입니다..." : "AI가 프로젝트 구조를 분석 중입니다..."}</span>
            <strong>{AI_ANALYSIS_MESSAGES[aiProgressIndex]}</strong>
            <small>{inputMode === "question" ? "질문의 배경과 다음 사고 흐름을 정리하고 있습니다..." : "문맥 관계와 키워드 계층을 정리하고 있습니다..."}</small>
          </div>
        )}
        {analysisError && <p className="analysis-error">{analysisError}</p>}
        {analysisPreview && (
          <div className="analysis-preview analysis-preview-ready">
            <p className="analysis-title">Thought Pocket 미리보기</p>
            <section className="analysis-pocket-section">
              <strong>핵심 질문</strong>
              <p>{analysisPreview.thoughtPocket?.question ?? analysisPreview.projectTitle}</p>
            </section>
            <section className="analysis-pocket-section">
              <strong>사고 요약</strong>
              <p>{analysisPreview.thoughtPocket?.summary ?? analysisPreview.projectSummary}</p>
            </section>
            {(analysisPreview.thoughtPocket?.reasoningFlow?.length ?? 0) > 0 && (
              <section className="analysis-pocket-section">
                <strong>사고 흐름</strong>
                <ol>
                  {analysisPreview.thoughtPocket?.reasoningFlow?.map((item, index) => <li key={`preview-flow-${index}`}>{item}</li>)}
                </ol>
              </section>
            )}
            {(analysisPreview.thoughtPocket?.nextQuestions?.length ?? 0) > 0 && (
              <section className="analysis-pocket-section">
                <strong>다음 질문</strong>
                <ul>
                  {analysisPreview.thoughtPocket?.nextQuestions?.map((item, index) => <li key={`preview-next-${index}`}>{item}</li>)}
                </ul>
              </section>
            )}
            {(analysisPreview.thoughtPocket?.possibleConclusions?.length ?? 0) > 0 && (
              <section className="analysis-pocket-section">
                <strong>가능한 결론</strong>
                <ul>
                  {analysisPreview.thoughtPocket?.possibleConclusions?.map((item, index) => <li key={`preview-conclusion-${index}`}>{item}</li>)}
                </ul>
              </section>
            )}
            {(analysisPreview.thoughtPocket?.actionSuggestions?.length ?? 0) > 0 && (
              <section className="analysis-pocket-section">
                <strong>실행 제안</strong>
                <ul>
                  {analysisPreview.thoughtPocket?.actionSuggestions?.map((item, index) => <li key={`preview-action-${index}`}>{item}</li>)}
                </ul>
              </section>
            )}
            <section className="analysis-pocket-section">
              <strong>보조 키워드</strong>
              <div className="analysis-chip-row">
                {(analysisPreview.thoughtPocket?.associatedKeywords ?? analysisPreview.keywords).slice(0, 8).map((keyword, index) => (
                  <span key={`${keyword}-${index}`}>{keyword}</span>
                ))}
              </div>
            </section>
          </div>
        )}
        <button className="line-command" onClick={addMemo}>
          {analysisPreview ? "분석 확인 후 저장" : "분석 미리보기"}
        </button>
        <button
          aria-busy={isAiAnalyzing}
          className={`ghost-command ai-structure-button ${isAiAnalyzing ? "ai-structure-button-loading" : ""}`}
          disabled={isAiAnalyzing}
          onClick={analyzeWithAi}
          type="button"
        >
          {isAiAnalyzing ? "✦ 구조 분석 중..." : "AI 구조화"}
        </button>
        {analysisPreview && (
          <button
            className="ghost-command"
            disabled={isAiAnalyzing}
            onClick={() => setAnalysisPreview(null)}
            type="button"
          >
            다시 분석하기
          </button>
        )}
      </section>

      <nav
        className="keyword-index glass-layer draggable-layer ui-layer"
        {...uiLayerEvents}
        onPointerDown={(event) => startLayerDrag("index", event, indexPosition)}
        onPointerMove={stopFloatingPointerMove}
        onTouchMove={stopFloatingTouchMove}
        onWheel={stopFloatingWheel}
        style={{ left: indexPosition.x, bottom: indexPosition.y, zIndex: activeLayer === "index" ? 70 : 40 }}
      >
        <p className="layer-kicker">Index</p>
        <input
          className="index-search"
          onChange={(event) => setIndexSearch(event.target.value)}
          placeholder="Search"
          value={indexSearch}
        />
        {projects.length === 0 ? (
          <button className="index-item" type="button">빈 공간</button>
        ) : (
          projects.map((project, projectIndex) => {
            const projectNode = simNodes.find((node) => node.project === project && node.level === "project");
            if (!projectNode) return null;

            const query = indexSearch.trim().toLowerCase();
            const projectMatches = !query || projectNode.label.toLowerCase().includes(query);
            const categories = simNodes.filter((node) => node.parentId === projectNode.id && node.level === "category");
            const projectHasMatches =
              projectMatches ||
              categories.some((category) => {
                const details = simNodes.filter((node) => node.parentId === category.id && node.level === "detail");
                return (
                  category.label.toLowerCase().includes(query) ||
                  details.some((detail) => detail.label.toLowerCase().includes(query))
                );
              });
            if (!projectHasMatches) return null;

            const projectCollapsed = collapsedIndexNodes[projectNode.id];

            return (
              <div className="index-group" key={`project-index-${projectIndex}-${hashString(project)}`}>
                <div className={`index-row index-row-project ${selectedNodeId === projectNode.id ? "index-row-active" : ""}`}>
                  <button
                    className="index-toggle"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleIndexNode(projectNode.id);
                    }}
                    type="button"
                  >
                    {projectCollapsed ? "›" : "⌄"}
                  </button>
                  <button className="index-project" onClick={() => focusNode(projectNode)} type="button">
                    PROJECT: {project}
                  </button>
                </div>
                {!projectCollapsed &&
                  categories.map((category) => {
                    const details = simNodes.filter((node) => node.parentId === category.id && node.level === "detail");
                    const categoryMatches = projectMatches || !query || category.label.toLowerCase().includes(query);
                    const visibleDetails = details.filter(
                      (detail) => categoryMatches || detail.label.toLowerCase().includes(query),
                    );
                    if (!categoryMatches && visibleDetails.length === 0) return null;

                    const categoryCollapsed = collapsedIndexNodes[category.id];

                    return (
                      <div className="index-branch" key={`index-category-${category.id}`}>
                        <div className={`index-row index-row-category ${selectedNodeId === category.id ? "index-row-active" : ""}`}>
                          <button
                            className="index-toggle"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleIndexNode(category.id);
                            }}
                            type="button"
                          >
                            {categoryCollapsed ? "›" : "⌄"}
                          </button>
                          <button className="index-category" onClick={() => focusNode(category)} type="button">
                            CATEGORY: {category.label}
                          </button>
                        </div>
                        {!categoryCollapsed &&
                          visibleDetails.map((detail) => (
                            <button
                              className={`index-detail ${selectedNodeId === detail.id ? "index-row-active" : ""}`}
                              key={`index-detail-${detail.id}`}
                              onClick={() => focusNode(detail)}
                              type="button"
                            >
                              DETAIL: {detail.label}
                            </button>
                          ))}
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </nav>

      <div
        className="control-layer glass-layer ui-layer"
        {...uiLayerEvents}
        onPointerDown={(event) => {
          event.stopPropagation();
          setActiveLayer("controls");
        }}
        onPointerMove={(event) => event.stopPropagation()}
        onTouchMove={stopFloatingTouchMove}
        onWheel={stopFloatingWheel}
        style={{ zIndex: activeLayer === "controls" ? 75 : 45 }}
      >
        {currentPocketId && (
          <button className="control-button inner-space-return" onClick={() => setCurrentPocketId(null)} type="button">
            White Hall로 돌아가기
          </button>
        )}
        <button className="control-button" onClick={centerView} type="button">센터</button>
        <button className="control-button" onClick={resetLayout} type="button">초기화</button>
        <button className="control-button" onClick={repairCurrentConnections} type="button">연결선 정리</button>
        <button className="control-button" onClick={() => saveBoardSnapshot(false)} type="button">저장 시점</button>
        <button className="control-button" onClick={() => setIsHistoryOpen((open) => !open)} type="button">히스토리</button>
        <button className="control-button" disabled={historyPast.length === 0} onClick={undoBoard} type="button">Undo</button>
        <button className="control-button" disabled={historyFuture.length === 0} onClick={redoBoard} type="button">Redo</button>
        <button
          className={`control-button performance-toggle ${isPerformanceMode ? "performance-toggle-on" : ""}`}
          onClick={() => setIsPerformanceMode((enabled) => !enabled)}
          type="button"
        >
          성능 모드 {isPerformanceMode ? "ON" : "OFF"}
        </button>
        <span className="share-board-label">Board:</span>
        <input
          aria-label="boardId"
          className="share-board-input"
          onChange={(event) => setBoardId(event.target.value)}
          value={boardId}
        />
        <button
          className="control-button share-action-button"
          onClick={() => void saveSharedBoard()}
          title={hasSupabaseEnv ? "현재 보드를 클라우드에 저장" : "Supabase 환경변수가 필요합니다"}
          type="button"
        >
          클라우드 저장
        </button>
        <button
          className="control-button share-action-button"
          onClick={() => void loadSharedBoard()}
          title={hasSupabaseEnv ? "클라우드 보드를 불러오기" : "Supabase 환경변수가 필요합니다"}
          type="button"
        >
          클라우드 불러오기
        </button>
        <button className="control-button share-action-button" onClick={() => void copyShareLink()} type="button">
          공유 링크 복사
        </button>
      </div>
      {shareNotice && <p className="share-notice ui-layer" {...uiLayerEvents}>{shareNotice}</p>}

      <aside
        className={`interaction-guide glass-layer ui-layer ${isGuideOpen ? "guide-open" : ""}`}
        {...uiLayerEvents}
        onPointerDown={(event) => {
          event.stopPropagation();
          setActiveLayer("guide");
        }}
        onPointerMove={(event) => event.stopPropagation()}
        onTouchMove={stopFloatingTouchMove}
        onWheel={stopFloatingWheel}
        style={{ zIndex: activeLayer === "guide" ? 75 : 45 }}
      >
        <button
          className="guide-summary"
          onClick={() => setIsGuideOpen((open) => !open)}
          type="button"
        >
          <span>사용법</span>
          <span className="guide-dot" />
        </button>
        <div className="guide-body">
          <p className="guide-mode"><span>Mode</span><span>{modeLabel}</span></p>
          <p><span>Scroll</span><span>Zoom</span></p>
          <p><span>Drag Space</span><span>Move</span></p>
          <p><span>Click Keyword</span><span>Focus</span></p>
          <p><span>Double Click Keyword</span><span>Edit</span></p>
          <p><span>Z + Drag</span><span>Move Structure</span></p>
          <p><span>Eye Toggle</span><span>마우스 시선 이동 On/Off</span></p>
          <p><span>클라우드 저장</span><span>현재 보드를 Supabase에 저장</span></p>
          <p><span>클라우드 불러오기</span><span>저장된 보드를 불러오기</span></p>
          <p><span>공유 링크 복사</span><span>외부 기기용 URL 복사</span></p>
          <p><span>이미지/링크</span><span>위에서는 시선 이동 자동 정지</span></p>
          <p><span>Center</span><span>Return View</span></p>
          <p><span>초기화</span><span>Reset Layout</span></p>
        </div>
      </aside>

      {isHistoryOpen && (
        <aside
          className="history-panel glass-layer ui-layer"
          {...uiLayerEvents}
          onPointerDown={(event) => {
            event.stopPropagation();
            setActiveLayer("history");
          }}
          onPointerMove={(event) => event.stopPropagation()}
          onTouchMove={stopFloatingTouchMove}
          onWheel={stopFloatingWheel}
          style={{ zIndex: activeLayer === "history" ? 76 : 46 }}
        >
          <div className="history-panel-head">
            <span>작업 시점 아카이브</span>
            <button onClick={() => setIsHistoryOpen(false)} type="button">닫기</button>
          </div>
          <button className="history-save" onClick={() => saveBoardSnapshot(false)} type="button">
            지금 시점 저장
          </button>
          <div className="history-stack">
            {snapshots.length === 0 ? (
              <p>저장된 시점 없음</p>
            ) : (
              snapshots.map((snapshot) => (
                <div className="history-item" key={snapshot.id}>
                  <strong>{snapshot.name}</strong>
                  <span>{new Date(snapshot.createdAt).toLocaleString("ko-KR")}</span>
                  <div>
                    <button onClick={() => restoreSnapshot(snapshot)} type="button">복원</button>
                    <button onClick={() => deleteSnapshot(snapshot.id)} type="button">삭제</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      <div
        aria-label="localStorage usage"
        className={`storage-monitor ui-layer ${storageUsage.percent >= 75 ? "storage-warn" : ""}`}
        {...uiLayerEvents}
        title={`localStorage ${formatStorageSize(storageUsage.bytes)} / ${formatStorageSize(storageUsage.limit)}`}
      >
        <div className="storage-monitor-row">
          <span>Local</span>
          <strong>{formatStorageSize(storageUsage.bytes)}</strong>
          <span>{storageUsage.percent.toFixed(1)}%</span>
        </div>
        <span className="storage-meter">
          <i style={{ width: `${storageUsage.percent}%` }} />
        </span>
      </div>

      {linkModalNodeId && (
        <div
          className="link-modal-overlay ui-layer"
          {...uiLayerEvents}
          onClick={() => {
            setLinkModalNodeId(null);
            setLinkError("");
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <form
            className="link-modal"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              addLinkToNode(linkModalNodeId);
            }}
          >
            <p>Link Thought</p>
            <input
              autoFocus
              onChange={(event) => {
                setLinkUrl(event.target.value);
                setLinkError("");
              }}
              placeholder="https://youtube.com/..."
              value={linkUrl}
            />
            {linkError && <span>{linkError}</span>}
            <div>
              <button type="submit">추가</button>
              <button
                onClick={() => {
                  setLinkModalNodeId(null);
                  setLinkError("");
                }}
                type="button"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedMemo && (
        <aside
          className="detail-layer draggable-layer ui-layer"
          {...uiLayerEvents}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const nearResizeCorner = rect.right - event.clientX < 28 && rect.bottom - event.clientY < 28;
            if (nearResizeCorner) {
              event.stopPropagation();
              return;
            }
            startLayerDrag("detail", event, detailPosition);
          }}
          onPointerMove={stopFloatingPointerMove}
          onTouchMove={stopFloatingTouchMove}
          onWheel={stopFloatingWheel}
          style={{
            right: detailPosition.x,
            bottom: detailPosition.y,
            zIndex: activeLayer === "detail" ? 70 : 40,
          }}
        >
          <p className="layer-kicker">
            {selectedNode?.level === "project" ? "PROJECT" : selectedNode?.project ?? "Selected"}
          </p>
          <h2>{selectedNode?.label ?? "Thought"}</h2>
          {selectedNode?.level !== "project" && (
            <p className="detail-context">Parent: {selectedNode?.project}</p>
          )}
          {detailEditMode ? (
            <>
              <textarea
                className="detail-body detail-editor"
                value={detailDraft}
                onChange={(event) => setDetailDraft(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    saveDetailEdit();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelDetailEdit();
                  }
                }}
              />
              <div className="detail-edit-actions">
                <button onClick={saveDetailEdit} type="button">저장</button>
                <button onClick={cancelDetailEdit} type="button">취소</button>
              </div>
            </>
          ) : activeThoughtPocket ? (
            <div className="thought-pocket-detail">
              {(activeThoughtPocket.triggerKeyword || activeThoughtPocket.question) && (
                <div className="thought-pocket-lead">
                  {activeThoughtPocket.triggerKeyword && <span>{activeThoughtPocket.triggerKeyword}</span>}
                  {activeThoughtPocket.question && <strong>{activeThoughtPocket.question}</strong>}
                </div>
              )}
              {activeThoughtPocket.summary && (
                <section>
                  <h3>요약</h3>
                  <p>{activeThoughtPocket.summary}</p>
                </section>
              )}
              {activeThoughtPocket.conflict && (
                <section>
                  <h3>갈등</h3>
                  <p>{activeThoughtPocket.conflict}</p>
                </section>
              )}
              {(activeThoughtPocket.reasoningFlow?.length ?? 0) > 0 && (
                <section>
                  <h3>사고 흐름</h3>
                  <ol>
                    {activeThoughtPocket.reasoningFlow?.map((item, index) => <li key={`flow-${index}`}>{item}</li>)}
                  </ol>
                </section>
              )}
              {(activeThoughtPocket.logic?.length ?? 0) > 0 && (
                <section>
                  <h3>논리</h3>
                  <ul>
                    {activeThoughtPocket.logic?.map((item, index) => <li key={`logic-${index}`}>{item}</li>)}
                  </ul>
                </section>
              )}
              {activeThoughtPocket.emotion && (
                <section>
                  <h3>감정</h3>
                  <p>{activeThoughtPocket.emotion}</p>
                </section>
              )}
              {activeThoughtPocket.conclusion && (
                <section>
                  <h3>결론</h3>
                  <p>{activeThoughtPocket.conclusion}</p>
                </section>
              )}
              {(activeThoughtPocket.nextQuestions?.length ?? 0) > 0 && (
                <section>
                  <h3>다음 질문</h3>
                  <ul>
                    {activeThoughtPocket.nextQuestions?.map((item, index) => <li key={`next-${index}`}>{item}</li>)}
                  </ul>
                </section>
              )}
              {(activeThoughtPocket.associatedKeywords?.length ?? 0) > 0 && (
                <section>
                  <h3>보조 키워드</h3>
                  <div className="thought-pocket-chips">
                    {activeThoughtPocket.associatedKeywords?.map((keyword, index) => <span key={`keyword-${index}`}>{keyword}</span>)}
                  </div>
                </section>
              )}
              {(activeThoughtPocket.possibleConclusions?.length ?? 0) > 0 && (
                <section>
                  <h3>가능한 결론</h3>
                  <ul>
                    {activeThoughtPocket.possibleConclusions?.map((item, index) => <li key={`conclusion-${index}`}>{item}</li>)}
                  </ul>
                </section>
              )}
              {(activeThoughtPocket.actionSuggestions?.length ?? 0) > 0 && (
                <section>
                  <h3>실행 제안</h3>
                  <ul>
                    {activeThoughtPocket.actionSuggestions?.map((item, index) => <li key={`action-${index}`}>{item}</li>)}
                  </ul>
                </section>
              )}
            </div>
          ) : detailExpanded ? (
            <p className="detail-body detail-summary">{selectedMemo.text}</p>
          ) : (
            <p className="detail-body detail-summary">{selectedDetailText}</p>
          )}
          {selectedNode && (
            <button
              className="detail-toggle"
              onClick={() => enterThoughtPocket(selectedNode)}
              type="button"
            >
              진입
            </button>
          )}
          {!detailEditMode && (
            <button
              className="detail-toggle"
              onClick={() => startDetailEdit(detailExpanded ? "full" : "summary")}
              type="button"
            >
              수정
            </button>
          )}
          <button
            className="detail-toggle"
            onClick={() => {
              setDetailEditMode(null);
              setDetailDraft("");
              setDetailExpanded((expanded) => !expanded);
            }}
            type="button"
          >
            {detailExpanded ? "요약 보기" : "전체 내용 보기"}
          </button>
          <p className="detail-time">{new Date(selectedMemo.createdAt).toLocaleString("ko-KR")}</p>
          {selectedMemo.updatedAt && (
            <p className="detail-time">수정 {new Date(selectedMemo.updatedAt).toLocaleString("ko-KR")}</p>
          )}
          {selectedNode && (nodeOverrides[selectedNode.id]?.images?.length ?? 0) > 0 && (
            <div className="detail-images">
              {(nodeOverrides[selectedNode.id]?.images ?? []).map((rawImage) => {
                const image = hydrateImageNode(rawImage);
                return (
                <span
                  className="interaction-safe-zone"
                  key={image.id}
                  onMouseEnter={enterInteractionSafeZone}
                  onMouseLeave={leaveInteractionSafeZone}
                  onPointerEnter={enterInteractionSafeZone}
                  onPointerLeave={leaveInteractionSafeZone}
                  onPointerDown={(event) => event.stopPropagation()}
                  onWheel={(event) => event.stopPropagation()}
                >
                  {image.src ? (
                    <img
                      className="interaction-safe-zone"
                      alt={image.name}
                      draggable={false}
                      onClick={(event) => {
                        event.stopPropagation();
                        setGalleryMode("slide");
                        setPreviewImage({ ...image, linkedNodeId: selectedNode.id });
                      }}
                      onDragStart={(event) => event.preventDefault()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onWheel={(event) => event.stopPropagation()}
                      src={image.src}
                    />
                  ) : (
                    <button
                      className="detail-image-placeholder interaction-safe-zone"
                      onClick={(event) => {
                        event.stopPropagation();
                        setGalleryMode("slide");
                        setPreviewImage({ ...image, linkedNodeId: selectedNode.id });
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      type="button"
                    >
                      Image
                    </button>
                  )}
                  <button onClick={() => deleteNodeImage(selectedNode.id, image.id)} type="button">삭제</button>
                </span>
                );
              })}
            </div>
          )}
          {selectedNode && (nodeOverrides[selectedNode.id]?.links?.length ?? 0) > 0 && (
            <div className="detail-links">
              {(nodeOverrides[selectedNode.id]?.links ?? []).map((link) => (
                <span
                  className="interaction-safe-zone"
                  key={link.id}
                  onMouseEnter={enterInteractionSafeZone}
                  onMouseLeave={leaveInteractionSafeZone}
                  onPointerEnter={enterInteractionSafeZone}
                  onPointerLeave={leaveInteractionSafeZone}
                  onPointerDown={(event) => event.stopPropagation()}
                  onWheel={(event) => event.stopPropagation()}
                >
                  {link.thumbnailUrl && (
                    <img
                      className="interaction-safe-zone"
                      alt={link.title ?? link.url}
                      draggable={false}
                      onDragStart={(event) => event.preventDefault()}
                      src={link.thumbnailUrl}
                    />
                  )}
                  <button onClick={(event) => {
                    event.stopPropagation();
                    openLinkUrl(link.url);
                  }} type="button">
                    {link.title ?? link.source}
                  </button>
                  <button onClick={() => deleteNodeLink(selectedNode.id, link.id)} type="button">삭제</button>
                </span>
              ))}
            </div>
          )}
          {selectedNode && (
            <button className="detail-toggle" onClick={() => generateImageForNode(selectedNode.id, selectedNode.label)} type="button">
              AI 이미지 생성
            </button>
          )}
          {imageNotice && <p className="detail-time">{imageNotice}</p>}
        </aside>
      )}

      {previewImage && (
        <div
          className="image-modal-overlay ui-layer"
          {...uiLayerEvents}
          onClick={closeImageModal}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div
            className="image-modal-content"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => {
              event.stopPropagation();
              shiftGallery(event.deltaY > 0 || event.deltaX > 0 ? 1 : -1);
            }}
          >
            <div className="gallery-meta">
              <span>KEYWORD: {galleryKeyword}</span>
              <span>{galleryIndex + 1} / {Math.max(galleryImages.length, 1)} references</span>
            </div>
            <div className="gallery-controls">
              <button className={galleryMode === "slide" ? "gallery-active" : ""} onClick={() => setGalleryMode("slide")} type="button">Slide</button>
              <button className={galleryMode === "grid" ? "gallery-active" : ""} onClick={() => setGalleryMode("grid")} type="button">Grid</button>
            </div>
            {galleryMode === "grid" ? (
              <div className="gallery-grid">
                {galleryImages.map((image) => (
                  <span
                    className="interaction-safe-zone"
                    key={`gallery-grid-${image.id}`}
                    onMouseEnter={enterInteractionSafeZone}
                    onMouseLeave={leaveInteractionSafeZone}
                    onPointerEnter={enterInteractionSafeZone}
                    onPointerLeave={leaveInteractionSafeZone}
                    onPointerDown={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    {image.src ? (
                      <img
                        className="interaction-safe-zone"
                        alt={image.name}
                        draggable={false}
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreviewImage(image);
                          setSelectedImageId(image.id);
                          setGalleryMode("slide");
                        }}
                        onDragStart={(event) => event.preventDefault()}
                        onPointerDown={(event) => event.stopPropagation()}
                        onWheel={(event) => event.stopPropagation()}
                        src={image.src}
                      />
                    ) : (
                      <button
                        className="gallery-image-placeholder interaction-safe-zone"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreviewImage(image);
                          setSelectedImageId(image.id);
                          setGalleryMode("slide");
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        type="button"
                      >
                        Image
                      </button>
                    )}
                    <button onClick={() => deleteNodeImage(image.linkedNodeId ?? "", image.id)} type="button">삭제</button>
                  </span>
                ))}
              </div>
            ) : (
              <div
                className="gallery-slide interaction-safe-zone"
                onMouseEnter={enterInteractionSafeZone}
                onMouseLeave={leaveInteractionSafeZone}
                onPointerEnter={enterInteractionSafeZone}
                onPointerLeave={leaveInteractionSafeZone}
                onPointerDown={(event) => event.stopPropagation()}
                onWheel={(event) => {
                  event.stopPropagation();
                  shiftGallery(event.deltaY > 0 || event.deltaX > 0 ? 1 : -1);
                }}
              >
                {galleryImages.length > 1 && <button className="gallery-arrow left" onClick={() => shiftGallery(-1)} type="button">‹</button>}
                {previewImage.src ? (
                  <img
                    className="interaction-safe-zone"
                    alt={previewImage.name}
                    draggable={false}
                    onClick={(event) => event.stopPropagation()}
                    onDragStart={(event) => event.preventDefault()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onWheel={(event) => {
                      event.stopPropagation();
                      shiftGallery(event.deltaY > 0 || event.deltaX > 0 ? 1 : -1);
                    }}
                    src={previewImage.src}
                  />
                ) : (
                  <span className="gallery-image-placeholder interaction-safe-zone">Image</span>
                )}
                {galleryImages.length > 1 && <button className="gallery-arrow right" onClick={() => shiftGallery(1)} type="button">›</button>}
              </div>
            )}
          </div>
        </div>
      )}

      {memos.length > 0 && (
        <button className="reset-layer" onClick={clearAll} type="button">기록 삭제</button>
      )}
    </main>
  );
}
