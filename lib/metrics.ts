import fs from "fs";
import path from "path";
import type { NormalizedIntake } from "@/app/api/intake/route";
import type { ConservatorshipPlan } from "@/types/plan";

export type PlanLog = {
  id: string;
  timestamp: string;
  personCounty: string;
  concerns: string[];
  hadPOA: boolean;
  summaryPreview: string;
  latencyMs?: number;
  modelName?: string;
};

const PLAN_LOGS: PlanLog[] = [];

let idCounter = 0;

const LOG_FILE = path.join(process.cwd(), "data", "plan_logs.jsonl");

function ensureLogDir() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function logPlanRun(
  intake: NormalizedIntake,
  plan: ConservatorshipPlan,
  extra?: { latencyMs?: number; modelName?: string }
) {
  const id = `plan_${++idCounter}`;
  const entry: PlanLog = {
    id,
    timestamp: new Date().toISOString(),
    personCounty: intake.person.county || "",
    concerns: intake.concerns || [],
    hadPOA: !!intake.has_poa,
    summaryPreview: plan.summary.slice(0, 160),
    latencyMs: extra?.latencyMs,
    modelName: extra?.modelName,
  };

  PLAN_LOGS.push(entry);
  // Also echo to console for dev
  console.log("PLAN_RUN", entry);

  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch (err) {
    console.error("Failed to write plan log to file", err);
  }
}

export function getPlanLogs(): PlanLog[] {
  return PLAN_LOGS;
}
