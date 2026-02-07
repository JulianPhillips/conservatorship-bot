# ConservatorshipBot (Memphis / Shelby County, TN)

An AI-powered, information-only conservatorship helper for Memphis/Shelby County families. It guides users through a structured intake, drafts a Tennessee‑specific informational plan, and generates a lawyer-ready summary—while enforcing strict safety constraints and disclaimers.

## Why I Built This

Conservatorship is high‑stakes, confusing, and emotionally heavy. Families often get told they “need a conservatorship” without a clear explanation of:
- what it means in Tennessee,
- what rights are removed,
- what alternatives exist, and
- what documentation and local steps are required.

This project is a focused prototype to demonstrate how a senior FDE / Applied AI engineer can:
- translate a messy, regulated domain into a concrete product,
- build an end‑to‑end LLM system (RAG + schema‑first outputs + safety checks),
- and ship a usable, empathetic flow in a few focused days.

## Who It Serves

- Families in **Memphis / Shelby County, Tennessee** exploring conservatorship.
- Caregivers who need **plain‑English guidance** and a **lawyer‑ready summary**.
- Users who are stressed, non‑technical, and need a clear path to next steps.

## What It Does (End‑to‑End Flow)

1. **Landing page**: sets expectations and legal disclaimers.
2. **Initial intake form**: collects minimal structured info (respondent, concerns, POA, goals).
3. **LLM‑guided follow‑ups**: a reasoner asks targeted questions, avoids repeats, and estimates confidence.
4. **Plan generation**: a schema‑validated `ConservatorshipPlan` is created with Tennessee‑specific guidance.
5. **Download for your lawyer**: generates a clean, plain‑text packet for attorney review.
6. **Contextual Q&A**: follow‑up chat grounded in the plan + KB.

## Why It’s Important

This system demonstrates:
- **Safety‑first LLM design** in a legal/health‑adjacent domain.
- **Local jurisdiction grounding** (Memphis/Shelby only, not generic advice).
- **Structured outputs** and **repair loops** instead of free‑form hallucination.
- **User‑centric UX** for high‑stress, non‑technical audiences.

## How It Works (Technical Overview)

### Schema‑first plan generation
- The plan output is locked to a fixed JSON schema (`types/plan.ts`, `lib/planSchema.ts`).
- `/api/plan` validates and repairs model output if needed.
- A **planner → checker** pass adds safety validation.

### RAG + hybrid retrieval
- Knowledge base lives in `kb/*.md`.
- `lib/kb.ts` chunks and embeds documents.
- `lib/retriever.ts` uses **embedding similarity + keyword boosting**.
- KB IDs are injected into the prompt and surfaced as citations in the UI.

### Safety constraints
- Prompts prohibit legal advice and require judge‑only decisions.
- Post‑hoc content filter blocks advice‑like language.
- UI repeatedly reminds users this is **information only**.

### Operational guardrails
- Simple rate limiting and cache to reduce abuse/cost.
- JSONL logging for plan runs + admin metrics view.

## Run It Locally

### 1) Install
```bash
npm install
```

### 2) Configure environment
Create `.env` in the project root:
```
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=your_model_here
OPENROUTER_EMBEDDING_MODEL=your_embedding_model_here
```

### 3) Start dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Try the Flow

1. Fill out the intake form.
2. Answer the guided follow‑ups.
3. Once confidence ≥ 0.6 (aim for 0.7+), click **Get summary**.
4. Download the lawyer packet and explore the plan.

## Eval Harness (Optional)

Run the tiny eval script to smoke‑test output shape and key concepts:
```bash
node evals/run-evals.ts
```

## Project Structure (Key Files)

- `app/page.tsx` — main UX
- `app/api/intake/route.ts` — intake normalization + validation
- `app/api/intake/reason/route.ts` — dynamic intake reasoner
- `app/api/plan/route.ts` — plan generation + safety checks
- `app/api/chat/route.ts` — contextual follow‑up Q&A
- `app/api/packet/route.ts` — lawyer‑ready text download
- `lib/prompts.ts` — system prompts + guardrails
- `lib/retriever.ts` — hybrid retrieval
- `lib/planSchema.ts` — schema enforcement
- `lib/metrics.ts` — JSONL metrics logging

## Notes

This is a **focused prototype**, not a production system:
- No auth or multi‑tenant isolation
- Minimal tests
- JSONL persistence only

Those gaps are intentional here, to keep the project compact and focused on applied‑AI system design.
