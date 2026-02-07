import fs from "fs";
import path from "path";

type IntakeInput = {
  personName: string;
  personAge: number | null;
  city: string;
  county: string;
  conditions: string[];
  relation: string;
  mainConcerns: string[];
  hasPOA: boolean;
  hasAlternativesTried: string;
  goals: string;
};

async function runFixture(name: string) {
  const fixturePath = path.join(__dirname, "fixtures", name + ".json");
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
    intake: IntakeInput;
  };

  // Call /api/intake
  const intakeRes = await fetch("http://localhost:3000/api/intake", {
    method: "POST",
    body: JSON.stringify(fixture.intake),
    headers: { "Content-Type": "application/json" },
  });
  const normalized = await intakeRes.json();

  // Call /api/plan
  const planRes = await fetch("http://localhost:3000/api/plan", {
    method: "POST",
    body: JSON.stringify(normalized),
    headers: { "Content-Type": "application/json" },
  });
  const plan = await planRes.json();

  // Basic structure checks
  const hasAllKeys =
    typeof plan.summary === "string" &&
    plan.buckets &&
    Array.isArray(plan.checklist_items) &&
    plan.petition_sections &&
    typeof plan.petition_sections.intro === "string";

  if (!hasAllKeys) {
    console.error(name, "❌ missing keys");
    return;
  }

  // Content checks per scenario
  const text = JSON.stringify(plan).toLowerCase();

  if (name === "elder_parent_case") {
    if (!text.includes("inventory")) {
      console.error(name, "❌ expected 'inventory' mention");
    } else {
      console.log(name, "✅ inventory mentioned");
    }
    if (!text.includes("court hearing")) {
      console.error(name, "❌ expected 'court hearing' mention");
    } else {
      console.log(name, "✅ court hearing mentioned");
    }
  }

  if (name === "disabled_adult_child") {
    if (!text.includes("representative payee")) {
      console.error(name, "❌ expected 'representative payee' mention");
    } else {
      console.log(name, "✅ representative payee mentioned");
    }
  }

  console.log(name, "✅ basic structure OK");
}

async function main() {
  const cases = [
    "elder_parent_case",
    "disabled_adult_child",
    "out_of_county_guardian",
  ];
  for (const name of cases) {
    console.log("\nRunning", name);
    await runFixture(name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
