import { NextResponse } from "next/server";

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectTitle", "projectSummary", "categories", "keywords", "relatedSnippets"],
  properties: {
    projectTitle: { type: "string" },
    projectSummary: { type: "string" },
    categories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "summary", "details"],
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          details: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "summary", "keywords"],
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                keywords: {
                  type: "array",
                  items: { type: "string" },
                },
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

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
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
              "You analyze long notes for Mind Orbit. Return only concise Korean-friendly JSON for a PROJECT/CATEGORY/DETAIL thought map. Do not include markdown. Keep titles short and symbolic.",
          },
          {
            role: "user",
            content: text,
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
