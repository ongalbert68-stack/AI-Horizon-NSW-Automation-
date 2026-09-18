// Prototype A's core. The model performs the reasoning end to end: it decides
// what to ask next, and it produces the ranked analysis in one pass.
//
// Broad coverage and natural follow-ups, but the numbers are asserted rather
// than derived - which is exactly the tradeoff prototype B exists to test.

import { llmJson, llmAvailable } from "@/core/llm";
import type { Analysis, Engine, EngineContext, Question } from "@/core/types";
import { NSW_QUESTIONS } from "@/packs/nsw";
import { EXA_QUESTIONS } from "@/packs/exa";
import { deterministicEngine } from "./deterministic";

const MAX_QUESTIONS = 7;

const SYSTEM: Record<string, string> = {
  nsw: `You are a senior process engineer specialising in fluid dispensing for electronics and semiconductor manufacturing (epoxy, solder paste, adhesives, sealants).
You diagnose dispensing defects: insufficient or excess volume, inconsistent volume, missing deposits, spreading, and irregular geometry.
Reason from process physics - viscosity, thixotropy, air entrapment, orifice restriction, needle standoff, pressure-time stability, thermal drift during a run.
Never invent machine-specific model numbers. Always justify a ranking by the symptom that supports it.
Respond only with JSON.`,
  exa: `You are a digital transformation consultant advising Malaysian SMEs, working for Exabytes (a Malaysian hosting, cloud and digital services provider).
You assess digital maturity across website, cloud, CRM, marketing, cybersecurity and AI adoption, then recommend a sequenced roadmap.
Recommend real service categories (business email, managed hosting, SSL, cloud backup, CRM, marketing automation, AI chatbot) and explain WHY each fits this specific business.
Never invent specific prices; speak in categories and relative cost. Quote figures in RM only when the user supplied them.
Respond only with JSON.`,
};

function transcript(ctx: EngineContext): string {
  const qa = ctx.answers.map((a) => `Q: ${a.prompt}\nA: ${a.value}`).join("\n");
  const sig = ctx.signals.length
    ? `\n\nMeasured signals:\n${ctx.signals.map((s) => `- ${s.label}: ${s.value}${s.unit ?? ""}`).join("\n")}`
    : "";
  return (qa || "(no answers yet)") + sig;
}

export const llmReasonerEngine: Engine = {
  id: "llm-reasoner",
  label: "LLM reasoner",

  async nextQuestion(ctx) {
    const base = ctx.track === "nsw" ? NSW_QUESTIONS : EXA_QUESTIONS;

    // The first question is fixed so every session opens identically; after that
    // the model drives, which is where the adaptive-questioning bonus is earned.
    if (ctx.answers.length === 0) return base[0];
    if (ctx.answers.length >= MAX_QUESTIONS) return null;

    const asked = new Set(ctx.answers.map((a) => a.questionId));
    const fallback = base.find((q) => !asked.has(q.id)) ?? null;

    if (!llmAvailable()) return fallback;

    const { data } = await llmJson<{ done: boolean; question?: Question }>({
      system: SYSTEM[ctx.track],
      temperature: 0.6,
      prompt: `Conversation so far:\n${transcript(ctx)}\n\nDecide the single most diagnostically valuable next question. Prefer a question that discriminates between competing explanations rather than one that confirms what you already believe. Stop once you can rank causes confidently, or after ${MAX_QUESTIONS} questions.\n\nReturn JSON: {"done": boolean, "question": {"id": string, "prompt": string, "kind": "choice"|"text"|"number", "options": string[], "help": string}}. Use "choice" with 3-5 concrete options wherever possible.`,
      fallback: fallback ? { done: false, question: fallback } : { done: true },
    });

    if (data.done || !data.question) return fallback;
    return { ...data.question, dynamic: true };
  },

  async analyze(ctx) {
    const started = Date.now();

    // Offline or on failure, fall back to the deterministic result so the demo
    // never dies - but label it honestly rather than passing it off as the model.
    const baseline = await deterministicEngine.analyze(ctx);

    if (!llmAvailable()) {
      return {
        ...baseline,
        meta: { ...baseline.meta, engine: "llm-reasoner", reproducible: false,
          notes: ["No GROQ_API_KEY set - showing the deterministic baseline instead of model reasoning.", ...baseline.meta.notes] },
      };
    }

    const shape = ctx.track === "nsw"
      ? `{"headline": "the most likely defect name", "summary": "2 sentences on expected symptoms", "overall": 0-100, "dimensions": [{"id","label","score":0-100,"rationale"}], "causes": [{"id","label","likelihood":0.0-1.0,"reasoning":"why THIS symptom supports this cause","checks":["what to inspect"]}], "actions": [{"order","title","detail"}]}`
      : `{"headline": "Digital Maturity N/100", "summary": "2 sentences", "overall": 0-100, "dimensions": [{"id","label","score":0-100,"rationale"}], "causes": [{"id","label","likelihood":0.0-1.0,"reasoning":"evidence from their answers","checks":["what to verify"]}], "actions": [{"order","title","detail","phase","horizon","impact"}]}`;

    const { data, live, note } = await llmJson<Partial<Analysis>>({
      system: SYSTEM[ctx.track],
      temperature: 0.3,
      prompt: `Assessment transcript:\n${transcript(ctx)}\n\nProduce the full analysis. Rank 4-6 causes by likelihood, each with reasoning tied to a specific answer above. ${
        ctx.track === "nsw"
          ? "Dimensions must be: Shape Consistency, Size Consistency, Dispensing Position, Defect Risk. Actions are an ordered troubleshooting sequence, cheapest and most likely first."
          : "Dimensions must be: Website, Cloud, CRM, Marketing, Cybersecurity, AI Adoption. Actions are a 3-phase roadmap (Quick Wins 2-4 weeks, Productivity 3-6 months, Growth 6-12 months)."
      }\n\nReturn JSON: ${shape}`,
      fallback: {},
    });

    const merged: Analysis = {
      headline: data.headline ?? baseline.headline,
      summary: data.summary ?? baseline.summary,
      overall: typeof data.overall === "number" ? data.overall : baseline.overall,
      dimensions: data.dimensions?.length
        ? data.dimensions.map((d) => ({ ...d, stars: Math.round((d.score / 100) * 5) }))
        : baseline.dimensions,
      causes: data.causes?.length
        ? data.causes.map((c) => ({ ...c, evidence: c.evidence ?? [] }))
        : baseline.causes,
      actions: data.actions?.length ? data.actions : baseline.actions,
      signals: ctx.signals,
      meta: {
        engine: "llm-reasoner",
        reproducible: false,
        grounded: ctx.signals.length > 0,
        elapsedMs: Date.now() - started,
        notes: [live ? `Reasoned by ${note}.` : `Model call failed - ${note}.`],
      },
    };

    return merged;
  },
};
