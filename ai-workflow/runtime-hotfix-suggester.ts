import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export interface HotfixSuggestion {
  confidence: number;
  safePatchStrategy: string;
  blockedAreas: string[];
  autoRetryAllowed: boolean;
}

export function suggestRuntimeHotfix(projectRoot: string): HotfixSuggestion {
  const runtime = readOptional(projectRoot, "logs/runtime-observation.md") + "\n" + readOptional(projectRoot, "agent-memory/learned-failure-patterns.md");
  const dangerous = /DANGEROUS|load-failure|render-loop|temporal-dead-zone/i.test(runtime);
  const suggestion: HotfixSuggestion = {
    confidence: dangerous ? 0.78 : 0.55,
    safePatchStrategy: dangerous
      ? "Do not patch broad UI. Isolate experimental layer, preserve app shell, then run build and browser observation."
      : "No hotfix needed; continue monitoring.",
    blockedAreas: ["production deploy", "rollback execution", "env/API keys", "app/page.tsx broad rewrite", "globals.css broad rewrite", "camera/depth/animation rewrite"],
    autoRetryAllowed: !dangerous,
  };
  writeText(projectRoot, "logs/runtime-hotfix-suggestions.md", renderHotfix(suggestion));
  return suggestion;
}

function renderHotfix(suggestion: HotfixSuggestion): string {
  return [
    "# Runtime Hotfix Suggester",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `- Confidence: ${suggestion.confidence}`,
    `- Auto retry allowed: ${suggestion.autoRetryAllowed ? "yes" : "no"}`,
    `- Safe patch strategy: ${suggestion.safePatchStrategy}`,
    "",
    "## Blocked Areas",
    ...suggestion.blockedAreas.map((area) => `- ${area}`),
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const suggestion = suggestRuntimeHotfix(process.cwd());
  console.log(`Hotfix confidence: ${suggestion.confidence}`);
}
