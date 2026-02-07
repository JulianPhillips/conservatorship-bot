import { NextRequest, NextResponse } from "next/server";
import { NormalizedIntake } from "../intake/route";
import { ConservatorshipPlan } from "@/types/plan";
import { callChatModel } from "@/lib/model";
import { retrieveKbChunksForIntake } from "@/lib/retriever";
import { saveChatSession } from "@/lib/chatStore";
import { checkRateLimit } from "@/lib/rateLimit";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatRequest = {
  intake: NormalizedIntake;
  plan: ConservatorshipPlan;
  history: ChatMessage[];
  sessionId: string;
};

const CHAT_SYSTEM_PROMPT = `
You are an information-only Memphis / Shelby County, Tennessee conservatorship helper.

Context:
- You are given:
  - A normalized intake JSON about a Tennessee adult who may need a conservator.
  - A ConservatorshipPlan JSON that you already created with summary, buckets, checklist_items, todo, and petition_sections.
  - A small set of Tennessee / Memphis knowledge base snippets.

Your job:
- Answer follow-up questions in plain English.
- Reuse and refer to the information in the existing plan and intake whenever possible.
- If the user seems confused, point them to relevant parts of the plan (for example, "look at the 'documentation_and_recording' section").
- You may add detail from the KB snippets, but do NOT contradict the plan.

Hard rules:
- You are NOT a lawyer, law firm, court, or doctor.
- Do NOT give legal advice, predict outcomes, or tell the user exactly what to file.
- Do NOT draft full petitions or fill out official forms.
- Always remind the user that only a Tennessee judge can decide capacity and appoint a conservator.
- Encourage the user to show their plan and notes to a Tennessee attorney or legal aid.

Style:
- Short, clear answers.
- Reference concrete steps, checklists, and duties.
- Name systemic bias where relevant, but keep the focus on what the user can document and ask for.
`;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for");
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests, please slow down." },
      { status: 429 }
    );
  }

  const body = (await req.json()) as ChatRequest;

  const kbSnippets = await retrieveKbChunksForIntake(body.intake);
  const kbText = kbSnippets.map((s) => s.text).join("\n\n---\n\n");

  const messages = [
    { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: [
        "Here is the normalized intake JSON:",
        "```json",
        JSON.stringify(body.intake, null, 2),
        "```",
        "",
        "Here is the ConservatorshipPlan JSON:",
        "```json",
        JSON.stringify(body.plan, null, 2),
        "```",
        "",
        "Here are Tennessee / Memphis knowledge base snippets you may use:",
        kbText,
        "",
        "Now continue the conversation below.",
      ].join("\n"),
    },
    ...body.history,
  ];

  const answer = await callChatModel(messages);
  const historyWithAssistant = [
    ...body.history,
    { role: "assistant" as const, content: answer },
  ];
  saveChatSession(body.sessionId, historyWithAssistant);
  return NextResponse.json({ answer });
}
