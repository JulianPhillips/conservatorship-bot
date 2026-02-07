import { NextRequest, NextResponse } from "next/server";
import { NormalizedIntake } from "../intake/route";
import { PLAN_CHECKER_PROMPT, PLAN_SYSTEM_PROMPT } from "@/lib/prompts";
import { retrieveKbChunksForIntake } from "@/lib/retriever";
import { ConservatorshipPlan } from "@/types/plan";
import { callChatModel, type ChatMessage } from "../../../lib/model"; // you implement this
import { logPlanRun } from "@/lib/metrics";
import { ConservatorshipPlanSchema } from "@/lib/planSchema";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCachedPlan, setCachedPlan } from "@/lib/cache";

function hasBannedPhrases(summary: string): boolean {
  const lower = summary.toLowerCase();
  const banned = [
    "this is legal advice",
    "you should file",
    "the judge will definitely",
    "guaranteed outcome",
  ];
  return banned.some((b) => lower.includes(b));
}

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
  const ip = req.headers.get("x-forwarded-for");
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests, please slow down." },
      { status: 429 }
    );
  }

  const intake = (await req.json()) as NormalizedIntake;
  const cacheKey = JSON.stringify(intake);
  const cached = getCachedPlan(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    const result = ConservatorshipPlanSchema.safeParse(parsed);
    if (result.success) {
      return NextResponse.json(result.data);
    }
  }

  const kbSnippets = await retrieveKbChunksForIntake(intake);
  const kbText = kbSnippets
    .map((s) => `[KB-ID:${s.id} FILE:${s.file}]\n${s.text}`)
    .join("\n\n---\n\n");

  const messages: ChatMessage[] = [
    { role: "system", content: PLAN_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        "Here is the normalized intake JSON:",
        "```json",
        JSON.stringify(intake, null, 2),
        "```",
        "",
        "Here are knowledge base snippets you may use:",
        kbText,
      ].join("\n"),
    },
  ];

  const start = Date.now();
  const raw = await callChatModel(messages);
  const duration = Date.now() - start;

  let plan: ConservatorshipPlan;
  try {
    const parsed = JSON.parse(raw);
    const result = ConservatorshipPlanSchema.safeParse(parsed);
    if (!result.success) {
      console.error("Plan schema validation failed", result.error.issues);
      const repairMessages = [
        {
          role: "system" as const,
          content:
            "You are a JSON repair assistant. Return ONLY valid JSON that matches the ConservatorshipPlan schema. Do not add extra keys or commentary.",
        },
        {
          role: "user" as const,
          content: [
            "Here is the invalid JSON output:",
            "```json",
            raw,
            "```",
            "",
            "Fix it to match the exact schema.",
          ].join("\n"),
        },
      ];
      const repairedRaw = await callChatModel(repairMessages);
      const repairedParsed = JSON.parse(extractJson(repairedRaw));
      const repairedResult =
        ConservatorshipPlanSchema.safeParse(repairedParsed);
      if (!repairedResult.success) {
        console.error(
          "Plan schema validation failed after repair",
          repairedResult.error.issues
        );
        return NextResponse.json(
          { error: "Model output did not match expected schema" },
          { status: 500 }
        );
      }
      plan = repairedResult.data;
      setCachedPlan(cacheKey, JSON.stringify(plan));
      logPlanRun(intake, plan, {
        latencyMs: duration,
        modelName: process.env.OPENROUTER_MODEL,
      });
      return NextResponse.json(plan);
    }
    plan = result.data;
  } catch (e) {
    console.error("Failed to parse plan JSON", e);
    return NextResponse.json({ error: "Bad model JSON" }, { status: 500 });
  }

  if (hasBannedPhrases(plan.summary)) {
    console.error("Content filter triggered on plan summary");
    return NextResponse.json(
      {
        error:
          "Plan generation produced language that may sound like legal advice. Please try again, or consult a Tennessee attorney directly.",
      },
      { status: 500 }
    );
  }

  setCachedPlan(cacheKey, raw);

  logPlanRun(intake, plan, {
    latencyMs: duration,
    modelName: process.env.OPENROUTER_MODEL,
  });

  type PlanCheckResult = {
    ok: boolean;
    issues: string[];
    suggested_warnings: string[];
  };

  const checkerMessages = [
    { role: "system" as const, content: PLAN_CHECKER_PROMPT },
    {
      role: "user" as const,
      content: [
        "Here is the normalized intake JSON:",
        "```json",
        JSON.stringify(intake, null, 2),
        "```",
        "",
        "Here is the ConservatorshipPlan JSON you should review:",
        "```json",
        JSON.stringify(plan, null, 2),
        "```",
      ].join("\n"),
    },
  ];

  let check: PlanCheckResult | null = null;
  try {
    const checkRaw = await callChatModel(checkerMessages);
    check = JSON.parse(extractJson(checkRaw)) as PlanCheckResult;
  } catch (e) {
    console.error("Plan checker failed", e);
  }

  if (check && !check.ok) {
    (plan as any).checker_warnings = check.suggested_warnings;
  }

  return NextResponse.json(plan);
}
