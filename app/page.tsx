"use client";

import { useState } from "react";
import type { IntakeInput } from "./api/intake/route";
import type { ConservatorshipPlan } from "@/types/plan";

type ChatMessage = { role: "user" | "assistant"; content: string };
type FollowUpQuestion = { id: string; question: string; required: boolean };
type IntakeReasonerResult = {
  ready_for_plan: boolean;
  confidence: number;
  missing_info_summary: string;
  follow_up_questions: FollowUpQuestion[];
  updated_intake: Record<string, unknown>;
};

export default function Home() {
  const [started, setStarted] = useState(false);
  const [intake, setIntake] = useState<IntakeInput>({
    personName: "",
    personAge: null,
    city: "Memphis",
    county: "Shelby",
    conditions: [],
    relation: "",
    mainConcerns: [],
    hasPOA: false,
    hasAlternativesTried: "",
    goals: "",
  });
  const [mainConcernsInput, setMainConcernsInput] = useState("");
  const [conditionsInput, setConditionsInput] = useState("");
  const [plan, setPlan] = useState<ConservatorshipPlan | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<"form" | "intake-reasoning" | "plan">(
    "form"
  );
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [intakeDraft, setIntakeDraft] = useState<Record<string, unknown>>({});
  const [pendingQuestions, setPendingQuestions] = useState<FollowUpQuestion[]>(
    []
  );
  const [allQuestions, setAllQuestions] = useState<FollowUpQuestion[]>([]);
  const [allAskedQuestions, setAllAskedQuestions] = useState<
    FollowUpQuestion[]
  >([]);
  const [readyForPlan, setReadyForPlan] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [missingInfo, setMissingInfo] = useState("");
  const [intakeAnswer, setIntakeAnswer] = useState("");
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<
    { question: string; answer: string }[]
  >([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>(
    {}
  );
  const [answerBatchCount, setAnswerBatchCount] = useState(0);
  const [editingAnswerIndex, setEditingAnswerIndex] = useState<number | null>(
    null
  );
  const [editingAnswerText, setEditingAnswerText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const parsedIntake: IntakeInput = {
        ...intake,
        mainConcerns: mainConcernsInput
          .split(/[;,]/)
          .map((c) => c.trim())
          .filter(Boolean),
        conditions: conditionsInput
          .split(/[;,]/)
          .map((c) => c.trim())
          .filter(Boolean),
      };
      setIntake(parsedIntake);
      setIntakeDraft(parsedIntake);
      setMode("intake-reasoning");
      setHistory([]);
      await runIntakeReasoner([], parsedIntake);
    } catch (err: any) {
      setErrorMsg(
        err.message || "Something went wrong while building your plan."
      );
    }
  }

  function isDuplicateQuestion(
    newQ: FollowUpQuestion,
    priorQs: FollowUpQuestion[]
  ) {
    const normalized = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
    const newNorm = normalized(newQ.question);
    return priorQs.some((q) => normalized(q.question) === newNorm);
  }

  function updateIntakeDraftFromAnswer(
    draft: Record<string, unknown>,
    userText: string
  ) {
    const lower = userText.toLowerCase();
    const existing = Array.isArray(draft.diagnoses)
      ? draft.diagnoses.filter((d) => typeof d === "string")
      : [];
    const detected: string[] = [];

    const addIf = (phrase: string, label = phrase) => {
      if (lower.includes(phrase)) detected.push(label);
    };

    addIf("early onset dementia", "early onset dementia");
    addIf("early-onset dementia", "early onset dementia");
    addIf("dementia");
    addIf("alzheimer");
    addIf("alzheimers", "alzheimers");
    addIf("parkinson");
    addIf("stroke");
    addIf("traumatic brain injury", "traumatic brain injury");
    addIf("tbi", "traumatic brain injury");
    addIf("intellectual disability", "intellectual disability");
    addIf("autism");
    addIf("bipolar");
    addIf("schizophrenia");
    addIf("memory loss", "memory loss");

    if (detected.length === 0) return draft;

    const merged = Array.from(new Set([...existing, ...detected]));
    return {
      ...draft,
      diagnoses: merged,
      diagnosis_detail_confidence:
        "user provided a family description; details may be incomplete",
    };
  }

  async function runIntakeReasoner(
    newHistory: ChatMessage[],
    currentIntake: Record<string, unknown>
  ) {
    setIntakeLoading(true);
    try {
      const res = await fetch("/api/intake/reason", {
        method: "POST",
        body: JSON.stringify({
          history: newHistory,
          current_intake: currentIntake,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Intake reasoner failed");
      }
      const data = (await res.json()) as IntakeReasonerResult;
      setIntakeDraft(data.updated_intake || currentIntake);
      setReadyForPlan(data.ready_for_plan);
      setConfidence(typeof data.confidence === "number" ? data.confidence : 0);
      const filtered = (data.follow_up_questions || []).filter(
        (q) => !isDuplicateQuestion(q, allAskedQuestions)
      );
      setPendingQuestions(filtered);
      setAllAskedQuestions((prev) => [...prev, ...filtered]);
      setAllQuestions(filtered);
      setMissingInfo(data.missing_info_summary || "");

      const assistantMessage: ChatMessage = data.ready_for_plan
        ? {
            role: "assistant",
            content:
              "I have enough information to draft a Tennessee conservatorship information plan.",
          }
        : {
            role: "assistant",
            content:
              data.follow_up_questions?.[0]?.question ||
              "I may not have every detail, but I can attempt a plan based on what you’ve shared so far.",
          };
      setHistory([...newHistory, assistantMessage]);

      if (typeof data.confidence === "number" && data.confidence >= 0.6) {
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Based on what you’ve shared, I have enough to draft a high-level summary for your attorney and suggested next steps. I can do that now, and you and your lawyer can correct any gaps.",
          },
        ]);
      }
    } finally {
      setIntakeLoading(false);
    }
  }

  async function handleIntakeAnswer() {
    const answered = allQuestions
      .map((q) => ({
        question: q.question,
        answer: (questionAnswers[q.id] || "").trim(),
      }))
      .filter((qa) => qa.answer.length > 0);
    if (answered.length === 0) return;

    setQuestionAnswers({});
    setPendingQuestions([]);
    setAllQuestions([]);
    setSavedAnswers((prev) => [...answered.reverse(), ...prev]);
    setAnswerBatchCount((prev) => prev + 1);

    const newHistory: ChatMessage[] = [
      ...history,
      ...answered.map((qa) => ({
        role: "user" as const,
        content: qa.answer,
      })),
    ];
    const updatedDraft = answered.reduce(
      (draft, qa) => updateIntakeDraftFromAnswer(draft, qa.answer),
      intakeDraft
    );
    setIntakeDraft(updatedDraft);
    setHistory(newHistory);
    await runIntakeReasoner(newHistory, updatedDraft);
  }

  async function handleEditSavedAnswer(index: number, newText: string) {
    const item = savedAnswers[index];
    if (!item) return;
    const updated = savedAnswers.map((a, i) =>
      i === index ? { ...a, answer: newText } : a
    );
    setSavedAnswers(updated);
    setEditingAnswerIndex(null);
    setEditingAnswerText("");

    const newHistory: ChatMessage[] = [
      ...history,
      {
        role: "user",
        content: `Correction to "${item.question}": ${newText}`,
      },
    ];
    setHistory(newHistory);
    await runIntakeReasoner(newHistory, intakeDraft);
  }

  function mapIntakeDraftToInput(
    draft: Record<string, unknown>
  ): IntakeInput {
    const getArray = (value: unknown, fallback: string[] = []) =>
      Array.isArray(value)
        ? value.filter((v) => typeof v === "string")
        : fallback;
    return {
      personName:
        (draft.personName as string) ||
        (draft.name as string) ||
        intake.personName,
      personAge:
        (draft.personAge as number) ??
        (draft.approxAge as number) ??
        intake.personAge ??
        null,
      city: (draft.city as string) || intake.city,
      county: (draft.county as string) || intake.county,
      conditions:
        getArray(draft.conditions) ||
        getArray(draft.diagnosis) ||
        getArray(draft.diagnoses, intake.conditions),
      relation: (draft.relation as string) || intake.relation,
      mainConcerns:
        getArray(draft.mainConcerns) ||
        getArray(draft.concerns, intake.mainConcerns),
      hasPOA:
        (draft.hasPOA as boolean) ??
        (draft.has_poa as boolean) ??
        intake.hasPOA,
      hasAlternativesTried:
        (draft.hasAlternativesTried as string) ||
        (draft.alternatives_tried as string) ||
        intake.hasAlternativesTried,
      goals: (draft.goals as string) || intake.goals,
    };
  }

  async function buildPlanFromIntake() {
    setErrorMsg(null);
    setLoading(true);
    try {
      const parsedIntake = mapIntakeDraftToInput(intakeDraft);
      setIntake(parsedIntake);

      const intakeRes = await fetch("/api/intake", {
        method: "POST",
        body: JSON.stringify(parsedIntake),
      });
      if (!intakeRes.ok) throw new Error("Intake failed");
      const normalized = await intakeRes.json();

      const planRes = await fetch("/api/plan", {
        method: "POST",
        body: JSON.stringify(normalized),
      });
      if (!planRes.ok) {
        const err = await planRes.json().catch(() => ({}));
        throw new Error(err.error || "Plan generation failed");
      }
      const planJson = (await planRes.json()) as ConservatorshipPlan;
      setPlan(planJson);
      setMode("plan");
    } catch (err: any) {
      setErrorMsg(
        err.message || "Something went wrong while building your plan."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPacket() {
    if (!plan) return;

    // Convert current IntakeInput -> NormalizedIntake shape
    const normalizedIntake = {
      person: {
        name: intake.personName,
        age: intake.personAge,
        city: intake.city,
        county: intake.county,
        conditions: intake.conditions,
      },
      petitioner: { relation: intake.relation },
      concerns: intake.mainConcerns,
      has_poa: intake.hasPOA,
      alternatives_tried: intake.hasAlternativesTried,
      goals: intake.goals,
    };

    const res = await fetch("/api/packet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intake: normalizedIntake, plan }),
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "conservatorship_summary_for_lawyer.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  if (!started) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-2xl text-center space-y-4">
          <h1 className="text-3xl font-bold">
            Memphis / Shelby Conservatorship Helper
          </h1>
          <p className="text-sm text-red-700 font-semibold">
            This tool shares information based on public Tennessee materials. It
            is not legal advice and does not create an attorney‑client
            relationship.
          </p>
          <p className="text-base">
            If you are in Memphis or Shelby County and someone is telling you
            that you “need a conservatorship,” this helper can:
          </p>
          <ul className="text-left list-disc ml-6 text-sm space-y-1">
            <li>
              Explain the Tennessee conservatorship process in plain language.
            </li>
            <li>Build a personalized checklist of information to gather.</li>
            <li>
              Show you what courts and conservators usually expect after
              appointment.
            </li>
            <li>
              Help you organize questions and documents to take to a Tennessee
              lawyer.
            </li>
          </ul>
          <p className="text-sm">
            It will not tell you what to file, cannot talk to the judge or
            hospital, and cannot replace a Tennessee attorney, doctor, or
            emergency help.
          </p>
          <button
            onClick={() => setStarted(true)}
            className="mt-4 px-6 py-3 rounded bg-blue-600 text-white text-base font-semibold"
          >
            Start – answer a few questions
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        Memphis / Shelby Conservatorship Info Helper
      </h1>
      <p className="mb-4 text-sm text-red-700 font-semibold">
        This tool gives information based on public Tennessee materials. It is
        not legal advice.
      </p>

      {/* Intake form */}
      {mode === "form" && (
        <form onSubmit={handleSubmit} className="space-y-3 mb-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Respondent name
            <input
              value={intake.personName}
              onChange={(e) =>
                setIntake((prev) => ({ ...prev, personName: e.target.value }))
              }
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Respondent = the adult the conservatorship would be about.
            </span>
          </label>
          <label className="text-sm">
            Respondent age
            <input
              type="number"
              value={intake.personAge ?? ""}
              onChange={(e) =>
                setIntake((prev) => ({
                  ...prev,
                  personAge: e.target.value
                    ? Number(e.target.value)
                    : null,
                }))
              }
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
            />
          </label>
          <label className="text-sm">
            City
            <input
              value={intake.city}
              readOnly
              className="mt-1 w-full rounded border border-gray-300 bg-gray-100 p-2 text-sm text-gray-700"
            />
          </label>
          <label className="text-sm">
            County
            <input
              value={intake.county}
              readOnly
              className="mt-1 w-full rounded border border-gray-300 bg-gray-100 p-2 text-sm text-gray-700"
            />
          </label>
          <div className="text-sm">
            <span className="block">State</span>
            <div className="mt-1 w-full rounded border border-gray-300 bg-gray-100 p-2 text-sm text-gray-700">
              Tennessee
            </div>
          </div>
          <label className="text-sm">
            Your relationship to respondent
            <input
              value={intake.relation}
              onChange={(e) =>
                setIntake((prev) => ({ ...prev, relation: e.target.value }))
              }
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
            />
          </label>
          <label
            className="text-sm"
            title="Use commas to separate items, not semicolons."
          >
            Main concerns (comma-separated)
            <input
              value={mainConcernsInput}
              onChange={(e) => setMainConcernsInput(e.target.value)}
              placeholder="money, medical, safety"
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Use commas, not semicolons. Examples: money, medical, safety,
              housing.
            </span>
          </label>
        </div>

        <label
          className="block text-sm"
          title="Use commas to separate items, not semicolons."
        >
          Conditions (comma-separated)
          <input
            value={conditionsInput}
            onChange={(e) => setConditionsInput(e.target.value)}
            placeholder="dementia, stroke, memory loss"
            className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
          />
          <span className="mt-1 block text-xs text-gray-500">
            Use commas, not semicolons. Examples: dementia, stroke, memory loss.
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={intake.hasPOA}
            onChange={(e) =>
              setIntake((prev) => ({ ...prev, hasPOA: e.target.checked }))
            }
          />
          Power of attorney in place
        </label>

        <label className="block text-sm">
          Alternatives tried
          <textarea
            value={intake.hasAlternativesTried}
            onChange={(e) =>
              setIntake((prev) => ({
                ...prev,
                hasAlternativesTried: e.target.value,
              }))
            }
            className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
            rows={2}
          />
          <span className="mt-1 block text-xs text-gray-500">
            Example: "Tried power of attorney with aunt, but she refused to
            sign."
          </span>
        </label>

        <label className="block text-sm">
          Goals
          <textarea
            value={intake.goals}
            onChange={(e) =>
              setIntake((prev) => ({ ...prev, goals: e.target.value }))
            }
            className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
            rows={2}
          />
          <span className="mt-1 block text-xs text-gray-500">
            Example: "Make sure bills are paid and medical appointments are
            managed safely."
          </span>
        </label>
        <button
          type="submit"
          disabled={intakeLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded inline-flex items-center gap-2"
        >
          {intakeLoading ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              <span className="animate-pulse">Starting intake…</span>
            </>
          ) : (
            "Continue"
          )}
        </button>
        </form>
      )}

      {errorMsg && (
        <p className="mb-4 text-sm text-red-700">
          {errorMsg} This tool is experimental; if problems continue, take your
          notes and contact a Tennessee lawyer or court clerk directly.
        </p>
      )}

      {mode === "intake-reasoning" && (
        <>
          <section className="mb-6 rounded border border-gray-200 p-4">
            <h2 className="text-lg font-semibold mb-2">
              Add more context about your case
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              Answer a few follow‑ups so the plan fits your situation.
            </p>
            {intakeLoading && (
              <div className="mb-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent align-[-2px]" />{" "}
                Processing your answer and preparing the next question…
              </div>
            )}
            {missingInfo && (
              <p className="mb-3 text-sm text-gray-700">{missingInfo}</p>
            )}

            {savedAnswers.length > 0 && (
              <div className="mb-4 text-sm text-gray-700">
                <p className="font-semibold">Context Q&A</p>
                <ul className="mt-2 space-y-2">
                  {savedAnswers.map((item, i) => (
                    <li key={i} className="rounded border border-gray-200 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.question}</span>
                        <button
                          type="button"
                          className="text-xs text-blue-700"
                          onClick={() => {
                            setEditingAnswerIndex(i);
                            setEditingAnswerText(item.answer);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                      {editingAnswerIndex === i ? (
                        <div className="mt-2">
                          <textarea
                            value={editingAnswerText}
                            onChange={(e) =>
                              setEditingAnswerText(e.target.value)
                            }
                            className="w-full rounded border border-gray-300 p-2 text-sm"
                            rows={2}
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              className="px-3 py-1 rounded bg-blue-600 text-white text-xs"
                              onClick={() =>
                                handleEditSavedAnswer(i, editingAnswerText)
                              }
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1 rounded border text-xs"
                              onClick={() => {
                                setEditingAnswerIndex(null);
                                setEditingAnswerText("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 text-gray-600">{item.answer}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!intakeLoading && allQuestions.length > 0 && (
              <div className="mb-3 space-y-3">
                {allQuestions.map((q) => (
                  <div key={q.id}>
                    <p className="text-sm font-semibold">{q.question}</p>
                    <textarea
                      value={questionAnswers[q.id] || ""}
                      onChange={(e) =>
                        setQuestionAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
                      rows={2}
                      placeholder="Type your answer here…"
                    />
                  </div>
                ))}
              </div>
            )}
            {allQuestions.length > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleIntakeAnswer}
                  disabled={intakeLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
                >
                  {intakeLoading
                    ? "Adding answers…"
                    : "Add answers to context"}
                </button>
              </div>
            )}

            {answerBatchCount >= 2 && confidence >= 0.6 && (
              <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                AI confidence: {(confidence * 100).toFixed(0)}%. For best
                results, aim for 70% or higher.
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={buildPlanFromIntake}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded text-sm"
                  >
                    {loading ? "Getting summary…" : "Get summary"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Plan display */}
      {mode === "plan" && plan && (
        <>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Summary</h2>
            <p>{plan.summary}</p>

            {Array.isArray((plan as any).checker_warnings) &&
              (plan as any).checker_warnings.length > 0 && (
                <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
                  <p className="font-semibold">Model warnings</p>
                  <ul className="list-disc ml-5">
                    {(plan as any).checker_warnings.map(
                      (w: string, i: number) => (
                        <li key={i}>{w}</li>
                      )
                    )}
                  </ul>
                </div>
              )}

            <h3 className="font-semibold mt-4">Where you file</h3>
            <ul className="list-disc ml-6">
              {plan.buckets.where_you_file.map((item, i) => (
                <li key={i}>{renderBucketItem(item)}</li>
              ))}
            </ul>

            <h3 className="font-semibold mt-4">Before you file</h3>
            <ul className="list-disc ml-6">
              {plan.buckets.before_you_file.map((item, i) => (
                <li key={i}>{renderBucketItem(item)}</li>
              ))}
            </ul>

            <h3 className="font-semibold mt-4">Info to gather</h3>
            <ul className="list-disc ml-6">
              {plan.buckets.info_to_gather.map((item, i) => (
                <li key={i}>{renderBucketItem(item)}</li>
              ))}
            </ul>

            <h3 className="font-semibold mt-4">Checklist</h3>
            <ul className="list-disc ml-6">
              {plan.checklist_items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>

            <h3 className="font-semibold mt-4">Next steps (todo)</h3>
            <ol className="list-decimal ml-6">
              {plan.todo.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>

            <details className="mt-4">
              <summary className="cursor-pointer">
                Show petition draft sections
              </summary>
              <div className="mt-2 space-y-2">
                <div>
                  <h4 className="font-semibold">Intro</h4>
                  <p className="whitespace-pre-wrap">
                    {plan.petition_sections.intro}
                  </p>
                </div>
                {/* facts, requested_powers, less_restrictive_explained */}
              </div>
            </details>

            <details className="mt-4">
              <summary className="cursor-pointer">Debug JSON</summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(plan, null, 2)}
              </pre>
            </details>

            <p className="mt-6 text-sm text-red-700 font-semibold">
              This is general information only. Talk to a Tennessee lawyer
              before filing anything with the court.
            </p>
          </section>

          <button
            onClick={handleDownloadPacket}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded text-sm"
          >
            Download summary for your lawyer
          </button>

          <button
            onClick={() => {
              setChatOpen(true);
              if (!chatSessionId) {
                setChatSessionId(crypto.randomUUID());
              }
            }}
            className="mt-6 px-4 py-2 bg-green-600 text-white rounded"
          >
            Ask follow‑up questions about this plan
          </button>

          {chatOpen && chatSessionId && (
            <ChatPanel
              intake={intake}
              plan={plan}
              sessionId={chatSessionId}
            />
          )}
        </>
      )}
    </main>
  );
}

function renderBucketItem(item: string) {
  const match = item.match(/\(KB-ID:([^)]+)\)$/);
  if (!match) return <span>{item}</span>;

  const cleanText = item.replace(/\(KB-ID:[^)]+\)$/, "").trim();
  const kbId = match[1];

  return (
    <span>
      {cleanText}{" "}
      <span className="text-xs text-gray-500">(Source: {kbId})</span>
    </span>
  );
}

function ChatPanel({
  intake,
  plan,
  sessionId,
}: {
  intake: IntakeInput;
  plan: ConservatorshipPlan;
  sessionId: string;
}) {
  type ChatMsg = { role: "user" | "assistant"; content: string };
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const newHistory: ChatMsg[] = [
      ...history,
      { role: "user", content: input.trim() },
    ];
    setHistory(newHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          intake: {
            person: {
              name: intake.personName,
              age: intake.personAge,
              city: intake.city,
              county: intake.county,
              conditions: intake.conditions,
            },
            petitioner: { relation: intake.relation },
            concerns: intake.mainConcerns,
            has_poa: intake.hasPOA,
            alternatives_tried: intake.hasAlternativesTried,
            goals: intake.goals,
          },
          plan,
          history: newHistory,
          sessionId,
        }),
      });
      const data = await res.json();
      setHistory((h) => [...h, { role: "assistant", content: data.answer }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 border rounded p-4 space-y-3">
      <h3 className="font-semibold">Ask questions about your plan</h3>
      <div className="h-64 overflow-y-auto border rounded p-2 text-sm bg-gray-50">
        {history.length === 0 && (
          <p className="text-gray-500">
            Example: “How do I document hospital conversations?” or “What should
            I bring to talk with a lawyer?”
          </p>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "text-right mb-2" : "text-left mb-2"}
          >
            <div
              className={
                "inline-block px-2 py-1 rounded " +
                (m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white border")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
      <p className="text-xs text-red-700">
        This chat is for general information only. It cannot give legal advice.
      </p>
    </div>
  );
}
