export type RuntimeRisk = "SAFE" | "WARNING" | "DANGEROUS";

export interface RuntimeDetectionInput {
  html?: string;
  consoleMessages?: string[];
  screenshotHash?: string;
  previousScreenshotHash?: string;
  domNodeCount?: number;
  previousDomNodeCount?: number;
  loadStatus: "not-run" | "loaded" | "failed";
}

export interface RuntimeDetectionResult {
  risk: RuntimeRisk;
  blankScreen: boolean;
  runtimeCrash: boolean;
  hydrationMismatch: boolean;
  excessiveRerender: boolean;
  animationJitterSuspicion: boolean;
  scrollFreezeSuspicion: boolean;
  memoryLeakSuspicion: boolean;
  excessiveDomUpdate: boolean;
  reasons: string[];
}

export function detectRuntimeErrors(input: RuntimeDetectionInput): RuntimeDetectionResult {
  const messages = input.consoleMessages?.join("\n") ?? "";
  const html = input.html ?? "";
  const reasons: string[] = [];
  const blankScreen = input.loadStatus === "failed" || html.trim().length < 200 || /<body[^>]*>\s*<\/body>/i.test(html);
  const runtimeCrash =
    /error|referenceerror|typeerror|cannot access|cannot read|failed to load/i.test(messages) ||
    /ReferenceError|TypeError|Cannot access .* before initialization|Cannot read properties of undefined|Application error/i.test(html);
  const hydrationMismatch = /hydration failed|hydration mismatch|server rendered html/i.test(messages + html);
  const excessiveRerender = /too many re-renders|maximum update depth|infinite loop/i.test(messages + html);
  const animationJitterSuspicion = /jitter|requestanimationframe|camera|depth|transform/i.test(messages);
  const scrollFreezeSuspicion = /scroll.*freeze|wheel.*blocked|passive event/i.test(messages);
  const memoryLeakSuspicion = /memory leak|heap|allocation failed/i.test(messages);
  const domDelta = Math.abs((input.domNodeCount ?? 0) - (input.previousDomNodeCount ?? input.domNodeCount ?? 0));
  const excessiveDomUpdate = domDelta > 250;

  if (blankScreen) reasons.push("Blank screen or failed load signal detected.");
  if (runtimeCrash) reasons.push("Runtime crash/error text detected.");
  if (hydrationMismatch) reasons.push("Hydration mismatch text detected.");
  if (excessiveRerender) reasons.push("Excessive rerender text detected.");
  if (animationJitterSuspicion) reasons.push("Animation/camera jitter suspicion from runtime logs.");
  if (scrollFreezeSuspicion) reasons.push("Scroll freeze suspicion from runtime logs.");
  if (memoryLeakSuspicion) reasons.push("Memory leak suspicion from runtime logs.");
  if (excessiveDomUpdate) reasons.push(`Large DOM node delta detected: ${domDelta}.`);

  const dangerous = blankScreen || runtimeCrash || excessiveRerender;
  const warning = hydrationMismatch || animationJitterSuspicion || scrollFreezeSuspicion || memoryLeakSuspicion || excessiveDomUpdate;
  return {
    risk: dangerous ? "DANGEROUS" : warning ? "WARNING" : "SAFE",
    blankScreen,
    runtimeCrash,
    hydrationMismatch,
    excessiveRerender,
    animationJitterSuspicion,
    scrollFreezeSuspicion,
    memoryLeakSuspicion,
    excessiveDomUpdate,
    reasons: reasons.length ? reasons : ["No runtime risk signal detected."],
  };
}
