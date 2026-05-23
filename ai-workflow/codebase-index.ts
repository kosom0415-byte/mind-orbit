import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type FileKind =
  | "app-route"
  | "app-page"
  | "component"
  | "hook"
  | "mind-engine"
  | "workflow-agent"
  | "style"
  | "config"
  | "doc"
  | "other";

type RiskLevel = "low" | "medium" | "high" | "critical";

interface IndexedFile {
  path: string;
  kind: FileKind;
  imports: string[];
  importedBy: string[];
  riskLevel: RiskLevel;
  riskReasons: string[];
  renderImpact: number;
}

interface CodebaseIndex {
  generatedAt: string;
  files: IndexedFile[];
  importGraph: Record<string, string[]>;
  mostImported: Array<{ path: string; count: number }>;
  sharedHooks: IndexedFile[];
  highRenderImpact: IndexedFile[];
  productionRiskFiles: IndexedFile[];
  relatedFiles: Record<string, string[]>;
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".md", ".json", ".mjs", ".cjs"]);
const IMPORTABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".css", ".json"];
const EXCLUDED_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", "dist", "build"]);
const HIGH_RISK_PATHS = new Set(["app/page.tsx", "app/globals.css"]);
const HIGH_RISK_PATTERNS = [/providers?/i, /^hooks\/use/i, /^app\/components\/(NodeLayer|EdgeLayer|HUDLayer|MinimapLayer)\.tsx$/];

export function buildCodebaseIndex(projectRoot: string): CodebaseIndex {
  const generatedAt = new Date().toISOString();
  const allFiles = scanFiles(projectRoot);
  const sourceFiles = allFiles.filter((file) => isSourceFile(file));
  const importGraph = buildImportGraph(projectRoot, sourceFiles);
  const importedBy = invertGraph(importGraph);
  const files = sourceFiles.map((filePath) => {
    const imports = importGraph[filePath] ?? [];
    const importers = importedBy[filePath] ?? [];
    const kind = classifyFile(filePath);
    const risk = classifyRisk(filePath, kind, imports, importers);

    return {
      path: filePath,
      kind,
      imports,
      importedBy: importers,
      riskLevel: risk.level,
      riskReasons: risk.reasons,
      renderImpact: calculateRenderImpact(filePath, kind, imports, importers),
    };
  });

  const mostImported = [...files]
    .map((file) => ({ path: file.path, count: file.importedBy.length }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, 12);

  const sharedHooks = files
    .filter((file) => file.kind === "hook")
    .sort((a, b) => b.importedBy.length - a.importedBy.length || b.renderImpact - a.renderImpact);

  const highRenderImpact = files
    .filter((file) => file.renderImpact >= 6)
    .sort((a, b) => b.renderImpact - a.renderImpact || a.path.localeCompare(b.path))
    .slice(0, 15);

  const productionRiskFiles = files
    .filter((file) => file.riskLevel === "critical" || file.riskLevel === "high")
    .sort((a, b) => riskWeight(b.riskLevel) - riskWeight(a.riskLevel) || b.renderImpact - a.renderImpact);

  const relatedFiles = Object.fromEntries(
    productionRiskFiles.slice(0, 20).map((file) => [file.path, recommendRelatedFiles(file, files)]),
  );

  return {
    generatedAt,
    files,
    importGraph,
    mostImported,
    sharedHooks,
    highRenderImpact,
    productionRiskFiles,
    relatedFiles,
  };
}

export function writeCodebaseLogs(projectRoot: string, index: CodebaseIndex): void {
  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });

  writeFileSync(join(logsDir, "codebase-map.md"), generateCodebaseMap(index), "utf8");
  writeFileSync(join(logsDir, "dependency-graph.md"), generateDependencyGraph(index), "utf8");
  writeFileSync(join(logsDir, "risk-files.md"), generateRiskFiles(index), "utf8");
  writeFileSync(join(logsDir, "architecture-summary.md"), generateArchitectureSummary(index), "utf8");
}

function scanFiles(projectRoot: string): string[] {
  const results: string[] = [];

  function walk(absDir: string): void {
    readdirSync(absDir).forEach((entry) => {
      if (EXCLUDED_DIRS.has(entry)) return;

      const absPath = join(absDir, entry);
      const stats = statSync(absPath);
      if (stats.isDirectory()) {
        walk(absPath);
        return;
      }

      const relPath = normalize(relative(projectRoot, absPath));
      if (SOURCE_EXTENSIONS.has(extname(relPath))) results.push(toPosix(relPath));
    });
  }

  walk(projectRoot);
  return results.sort();
}

function isSourceFile(filePath: string): boolean {
  const ext = extname(filePath);
  if (!SOURCE_EXTENSIONS.has(ext)) return false;
  if (filePath.startsWith("logs/")) return false;
  if (filePath.startsWith("agent-memory/")) return false;
  return true;
}

function buildImportGraph(projectRoot: string, files: string[]): Record<string, string[]> {
  const fileSet = new Set(files);
  const graph: Record<string, string[]> = {};

  files.forEach((filePath) => {
    const absPath = join(projectRoot, filePath);
    const ext = extname(filePath);
    if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      graph[filePath] = [];
      return;
    }

    const source = readFileSync(absPath, "utf8");
    graph[filePath] = extractImports(source)
      .map((specifier) => resolveImport(filePath, specifier, fileSet))
      .filter((target): target is string => Boolean(target))
      .sort();
  });

  return graph;
}

function extractImports(source: string): string[] {
  const imports = new Set<string>();
  const importPatterns = [
    /import\s+(?:type\s+)?[^'"]*from\s+["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /export\s+(?:type\s+)?[^'"]*from\s+["']([^"']+)["']/g,
  ];

  importPatterns.forEach((pattern) => {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) imports.add(match[1]);
    }
  });

  return [...imports];
}

function resolveImport(fromFile: string, specifier: string, fileSet: Set<string>): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return null;

  const fromDir = dirname(fromFile);
  const basePath = specifier.startsWith("@/")
    ? specifier.slice(2)
    : toPosix(normalize(relative(".", resolve(fromDir, specifier))));

  const candidates = [
    basePath,
    ...IMPORTABLE_EXTENSIONS.map((ext) => `${basePath}${ext}`),
    ...IMPORTABLE_EXTENSIONS.map((ext) => `${basePath}/index${ext}`),
  ].map(toPosix);

  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

function invertGraph(graph: Record<string, string[]>): Record<string, string[]> {
  const inverted: Record<string, string[]> = {};
  Object.entries(graph).forEach(([source, targets]) => {
    targets.forEach((target) => {
      inverted[target] = [...(inverted[target] ?? []), source].sort();
    });
  });
  return inverted;
}

function classifyFile(filePath: string): FileKind {
  if (filePath === "app/page.tsx") return "app-page";
  if (filePath.startsWith("app/api/") && filePath.endsWith("route.ts")) return "app-route";
  if (filePath.startsWith("app/components/")) return "component";
  if (filePath.startsWith("hooks/")) return "hook";
  if (filePath.startsWith("lib/mind/")) return "mind-engine";
  if (filePath.startsWith("ai-workflow/")) return "workflow-agent";
  if (filePath.endsWith(".css")) return "style";
  if ([".md"].includes(extname(filePath))) return "doc";
  if ([".json", ".mjs", ".cjs"].includes(extname(filePath)) || filePath.includes("config")) return "config";
  return "other";
}

function classifyRisk(
  filePath: string,
  kind: FileKind,
  imports: string[],
  importedBy: string[],
): { level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  let level: RiskLevel = "low";

  if (HIGH_RISK_PATHS.has(filePath)) {
    level = "critical";
    reasons.push("Core app shell or global style can break production load/rendering.");
  }

  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(filePath))) {
    level = maxRisk(level, "high");
    reasons.push("Shared provider/hook/render layer affects broad interaction behavior.");
  }

  if (kind === "app-route") {
    level = maxRisk(level, "high");
    reasons.push("API route can affect AI analysis and server runtime.");
  }

  if (kind === "mind-engine") {
    level = maxRisk(level, "medium");
    reasons.push("Mind graph engine affects edge/node interpretation.");
  }

  if (importedBy.length >= 3) {
    level = maxRisk(level, "medium");
    reasons.push(`Imported by ${importedBy.length} files.`);
  }

  if (imports.some((target) => target.includes("useGestures") || target.includes("useSelection"))) {
    level = maxRisk(level, "medium");
    reasons.push("Depends on core interaction hooks.");
  }

  return { level, reasons: reasons.length ? reasons : ["Low isolated change risk."] };
}

function calculateRenderImpact(filePath: string, kind: FileKind, imports: string[], importedBy: string[]): number {
  let score = importedBy.length * 2 + imports.length;
  if (filePath === "app/page.tsx") score += 12;
  if (filePath === "app/globals.css") score += 10;
  if (kind === "component") score += 4;
  if (kind === "hook") score += 5;
  if (kind === "app-route") score += 3;
  if (filePath.includes("NodeLayer") || filePath.includes("EdgeLayer")) score += 6;
  return score;
}

function recommendRelatedFiles(file: IndexedFile, files: IndexedFile[]): string[] {
  const direct = new Set([...file.imports, ...file.importedBy]);
  files.forEach((candidate) => {
    if (candidate.path === file.path) return;
    if (candidate.imports.some((target) => file.imports.includes(target))) direct.add(candidate.path);
  });
  return [...direct].sort().slice(0, 12);
}

function generateCodebaseMap(index: CodebaseIndex): string {
  const byKind = groupBy(index.files, (file) => file.kind);
  return [
    "# Codebase Map",
    "",
    `Generated: ${index.generatedAt}`,
    "",
    "## File Structure By Role",
    ...Object.entries(byKind).flatMap(([kind, files]) => [
      "",
      `### ${kind}`,
      ...files.map((file) => `- ${file.path}`),
    ]),
    "",
    "## Most Imported Files",
    ...index.mostImported.map((item) => `- ${item.path}: ${item.count}`),
    "",
    "## Related Files Recommendations",
    ...Object.entries(index.relatedFiles).flatMap(([file, related]) => [
      "",
      `### ${file}`,
      ...(related.length ? related.map((item) => `- ${item}`) : ["- none"]),
    ]),
    "",
  ].join("\n");
}

function generateDependencyGraph(index: CodebaseIndex): string {
  return [
    "# Dependency Graph",
    "",
    `Generated: ${index.generatedAt}`,
    "",
    "## Import Graph",
    ...Object.entries(index.importGraph).flatMap(([source, targets]) => [
      "",
      `### ${source}`,
      ...(targets.length ? targets.map((target) => `- imports ${target}`) : ["- imports none"]),
    ]),
    "",
    "## Highest Fan-In",
    ...index.mostImported.map((item) => `- ${item.path}: imported by ${item.count} file(s)`),
    "",
  ].join("\n");
}

function generateRiskFiles(index: CodebaseIndex): string {
  return [
    "# Risk Files",
    "",
    `Generated: ${index.generatedAt}`,
    "",
    "## AI Should Avoid Touching Without Extra Review: TOP 10",
    ...index.productionRiskFiles.slice(0, 10).map((file, indexNumber) => {
      return `${indexNumber + 1}. ${file.path} | ${file.riskLevel} | render impact ${file.renderImpact} | ${file.riskReasons.join(" ")}`;
    }),
    "",
    "## Core Shared Hook Analysis",
    ...index.sharedHooks.map((file) => {
      return `- ${file.path}: imported by ${file.importedBy.length}, render impact ${file.renderImpact}`;
    }),
    "",
    "## High Render Impact Files",
    ...index.highRenderImpact.map((file) => `- ${file.path}: ${file.renderImpact}`),
    "",
    "## Production Risk Areas",
    "- app/page.tsx: app shell, state concentration, render ordering, interaction wiring",
    "- app/globals.css: global layout, transforms, animation, visual stability",
    "- hooks/*: drag, selection, viewport, gesture behavior",
    "- app/components/NodeLayer.tsx and EdgeLayer.tsx: graph render stability",
    "- app/api/analyze/route.ts: AI analysis runtime path",
    "",
  ].join("\n");
}

function generateArchitectureSummary(index: CodebaseIndex): string {
  return [
    "# Architecture Summary",
    "",
    `Generated: ${index.generatedAt}`,
    "",
    "## Current Project Structure",
    "- `app/page.tsx` is the primary app shell and graph interaction coordinator.",
    "- `app/components/*Layer.tsx` files render graph nodes, edges, HUD, and minimap surfaces.",
    "- `hooks/*` files hold interaction, viewport, gesture, and selection state behavior.",
    "- `lib/mind/*` files hold graph edge, visibility, render, and relation scoring logic.",
    "- `ai-workflow/*` files implement the local GPT/Codex workflow automation layer.",
    "",
    "## Refactoring Priority Recommendation",
    "1. Continue extracting pure graph/state logic away from `app/page.tsx`.",
    "2. Add focused tests or dry-run checks around `lib/mind/*` edge and visibility engines.",
    "3. Keep `hooks/useGestures.ts`, `hooks/useSelection.ts`, and `hooks/useViewport.ts` stable before adding new interaction effects.",
    "4. Treat `app/globals.css` transform/animation edits as production-risk changes.",
    "5. Keep AI workflow files isolated from app runtime code until automation behavior is proven.",
    "",
    "## Performance Bottleneck Possibilities",
    "- `app/page.tsx` remains the broadest render coordination point.",
    "- Node/edge layer rendering can become expensive as graph size grows.",
    "- Global CSS and transform changes can cause large visual/layout shifts.",
    "- Gesture and viewport hooks can affect frequent pointer/scroll updates.",
    "",
    "## Next Automation Recommendation",
    "- Add a pre-edit guard that blocks Codex from modifying TOP10 risk files unless the task queue includes explicit approval and validation steps.",
    "",
    "## Generated Metrics",
    `- Indexed files: ${index.files.length}`,
    `- Import graph sources: ${Object.keys(index.importGraph).length}`,
    `- High/critical risk files: ${index.productionRiskFiles.length}`,
    `- Shared hooks: ${index.sharedHooks.length}`,
    "",
  ].join("\n");
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}

function maxRisk(current: RiskLevel, next: RiskLevel): RiskLevel {
  return riskWeight(next) > riskWeight(current) ? next : current;
}

function riskWeight(level: RiskLevel): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[level];
}

function toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  const projectRoot = process.cwd();
  const index = buildCodebaseIndex(projectRoot);
  writeCodebaseLogs(projectRoot, index);
  console.log("Codebase intelligence index generated.");
  console.log(`Indexed files: ${index.files.length}`);
  console.log(`High/critical risk files: ${index.productionRiskFiles.length}`);
  console.log("Wrote: logs/codebase-map.md");
  console.log("Wrote: logs/dependency-graph.md");
  console.log("Wrote: logs/risk-files.md");
  console.log("Wrote: logs/architecture-summary.md");
}
