import { NextRequest, NextResponse } from "next/server";
import { IntakeInputSchema } from "@/lib/intakeSchema";

export type IntakeInput = {
  personName: string;
  personAge: number | null;
  city: string;
  county: string;
  conditions: string[];
  relation: string;
  mainConcerns: string[]; // ["money", "medical", "safety"]
  hasPOA: boolean;
  hasAlternativesTried: string;
  goals: string;
};

export type NormalizedIntake = {
  person: {
    name: string;
    age: number | null;
    city: string;
    county: string;
    conditions: string[];
  };
  petitioner: {
    relation: string;
  };
  concerns: string[];
  has_poa: boolean;
  alternatives_tried: string;
  goals: string;
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = IntakeInputSchema.safeParse(body);
  if (!parsed.success) {
    console.error("Intake validation failed", parsed.error.issues);
    return NextResponse.json({ error: "Invalid intake data" }, { status: 400 });
  }
  const input = parsed.data as IntakeInput;

  const normalized: NormalizedIntake = {
    person: {
      name: input.personName?.trim() || "",
      age: input.personAge ?? null,
      city: input.city?.trim() || "",
      county: input.county?.trim() || "",
      conditions: input.conditions || [],
    },
    petitioner: {
      relation: input.relation?.trim() || "",
    },
    concerns: input.mainConcerns || [],
    has_poa: !!input.hasPOA,
    alternatives_tried: input.hasAlternativesTried || "",
    goals: input.goals || "",
  };

  return NextResponse.json(normalized);
}
