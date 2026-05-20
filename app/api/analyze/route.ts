import { NextResponse } from "next/server";

const thoughtPocketSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "question",
    "triggerKeyword",
    "summary",
    "conflict",
    "logic",
    "emotion",
    "conclusion",
    "associatedKeywords",
    "reasoningFlow",
    "nextQuestions",
    "possibleConclusions",
    "actionSuggestions",
  ],
  properties: {
    question: { type: "string" },
    triggerKeyword: { type: "string" },
    summary: { type: "string" },
    conflict: { type: "string" },
    logic: {
      type: "array",
      items: { type: "string" },
    },
    emotion: { type: "string" },
    conclusion: { type: "string" },
    associatedKeywords: {
      type: "array",
      items: { type: "string" },
    },
    reasoningFlow: {
      type: "array",
      items: { type: "string" },
    },
    nextQuestions: {
      type: "array",
      items: { type: "string" },
    },
    possibleConclusions: {
      type: "array",
      items: { type: "string" },
    },
    actionSuggestions: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectTitle", "projectSummary", "categories", "keywords", "relatedSnippets", "thoughtPocket"],
  properties: {
    projectTitle: { type: "string" },
    projectSummary: { type: "string" },
    thoughtPocket: thoughtPocketSchema,
    categories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "summary", "thoughtPocket", "details"],
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          thoughtPocket: thoughtPocketSchema,
          details: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "summary", "keywords", "thoughtPocket"],
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                keywords: {
                  type: "array",
                  items: { type: "string" },
                },
                thoughtPocket: thoughtPocketSchema,
              },
            },
          },
        },
      },
    },
    keywords: {
      type: "array",
      items: { type: "string" },
    },
    relatedSnippets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "text"],
        properties: {
          label: { type: "string" },
          text: { type: "string" },
        },
      },
    },
  },
};

const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5-mini";

function outputText(data: unknown) {
  const response = data as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (typeof response.output_text === "string") return response.output_text;

  return response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((text): text is string => typeof text === "string");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY가 설정되어 있지 않습니다." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { text?: string; mode?: "memo" | "question" } | null;
  const text = body?.text?.trim();
  const mode = body?.mode === "question" ? "question" : "memo";
  if (!text) {
    return NextResponse.json({ error: "분석할 메모가 비어 있습니다." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        input: [
          {
            role: "system",
            content:
              [
                "You analyze input for Mind Orbit, a Korean Thought Pocket mind-map.",
                "A node is never a keyword. A node is a complete thinking state.",
                "Track the user's cognitive-state changes, not topic categories.",
                "STRICTLY FORBIDDEN: keyword extraction, topic classification, generic category titles, noun-only node titles, sentence fragments, and copied partial clauses.",
                "Do not create node titles like 심리적원인, 패턴요약, 실행장애, 행동마찰, 배경, 핵심, 증상, 동기, 구조, 전략, 자동화, Codex, or fragments like 단순히 시간을 아끼고 / 싶은 마음 때문일까.",
                "Every projectTitle, category.title, and detail.title must be at least 18 Korean characters and must be a complete cognitive-state sentence or question. It must be meaningful when seen alone.",
                "The central/project node must be the user's core question.",
                "The surrounding category/detail nodes must express the user's actual inner state, such as current conflict, psychological state, interpretation, conclusion, next question, or action direction.",
                "Preferred flow: question -> conflict -> psychological state -> interpretation -> conclusion -> next question.",
                "Good node examples: 작업량이 커질수록 시작 자체를 회피하게 된다 / 결과보다 과정 피로가 더 크게 느껴진다 / 생각은 빠른데 실행은 항상 늦어진다 / 반복 노동에서 벗어나고 싶은 욕구가 자동화를 부른다 / AI에게 어디까지 맡겨도 되는가?",
                "If a generic label would be used, expand it: 배경 -> 이 생각은 어떤 상황에서 시작되었는가? / 핵심 -> 이 사고의 핵심 질문은 무엇인가? / 증상 -> 어떤 반복 패턴이 문제를 드러내는가? / 실행 -> 이 생각은 어떤 행동으로 이어져야 하는가? / 결론 -> 현재 도달한 판단은 무엇인가?",
                "Strong short concepts such as AI, Codex, Cursor, HanVino, and product names may appear only as associatedKeywords, not as main node titles.",
                "Every thoughtPocket.question must be a question or clear thinking-state sentence. summary explains why the node matters. reasoningFlow must contain at least 3 items. nextQuestions and actionSuggestions must each contain at least 2 items.",
                "Return only concise Korean-friendly JSON matching the schema.",
              ].join(" "),
          },
          {
            role: "user",
            content: `Mode: ${mode === "question" ? "question input" : "memo input"}\n\n${text}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "mind_orbit_analysis",
            strict: true,
            schema: analysisSchema,
          },
        },
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof data?.error?.message === "string" ? data.error.message : "AI 분석 요청에 실패했습니다.";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const textOutput = outputText(data);
    if (!textOutput) {
      return NextResponse.json({ error: "AI 분석 결과를 읽을 수 없습니다." }, { status: 502 });
    }

    return NextResponse.json(JSON.parse(textOutput));
  } catch {
    return NextResponse.json({ error: "AI 분석 요청 중 오류가 발생했습니다." }, { status: 502 });
  }
}
