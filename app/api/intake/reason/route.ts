import { NextRequest, NextResponse } from "next/server";
import { INTAKE_REASONER_PROMPT } from "@/lib/prompts";
import { callChatModel } from "@/lib/model";

function extractJson(raw: string): string {
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1).trim();
  }
  return raw.trim();
}

export async function POST(req: NextRequest) {
  const { history, current_intake } = await req.json();

  const messages = [
    { role: "system" as const, content: INTAKE_REASONER_PROMPT },
    {
      role: "user" as const,
      content: [
        "Here is the full chat history so far:",
        "```json",
        JSON.stringify(history, null, 2),
        "```",
        "",
        "Here is the current intake JSON (may be partial or empty):",
        "```json",
        JSON.stringify(current_intake ?? {}, null, 2),
        "```",
      ].join("\n"),
    },
  ];

  const raw = await callChatModel(messages);

  let parsed: any;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (e) {
    console.error("Intake reasoner JSON parse failed", e, raw);
    return NextResponse.json(
      {
        error:
          "The intake reasoner could not interpret this conversation. Please try again or simplify your answers.",
      },
      { status: 500 }
    );
  }

  if (
    typeof parsed.ready_for_plan !== "boolean" ||
    typeof parsed.confidence !== "number" ||
    !Array.isArray(parsed.follow_up_questions) ||
    typeof parsed.updated_intake !== "object"
  ) {
    return NextResponse.json(
      { error: "Intake reasoner returned an invalid shape." },
      { status: 500 }
    );
  }

  return NextResponse.json(parsed);
}
