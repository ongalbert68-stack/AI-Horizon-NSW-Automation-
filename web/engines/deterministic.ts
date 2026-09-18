// Prototype B's core. Every number is computed here, in code, from declared
// inputs. Identical input produces identical output, and each figure can be
// traced back to the evidence that produced it.

import { rankCauses } from "@/core/infer";
import { coefficientOfVariation, toStars } from "@/core/math";
import type { Analysis, Engine, EngineContext, Question, ScoreDimension } from "@/core/types";
import {
  NSW_CAUSES, NSW_DEFECTS, NSW_FOLLOWUPS, NSW_QUESTIONS,
} from "@/packs/nsw";
import {
  DEFAULT_HOURLY_RM, EXA_AUTOMATION_YIELD, EXA_CATALOG, EXA_DIMENSIONS,
  EXA_FOLLOWUPS, EXA_PAINPOINTS, EXA_QUESTIONS,
} from "@/packs/exa";

function answerFor(ctx: EngineContext, id: string) {
  return ctx.answers.find((a) => a.questionId === id)?.value ?? "";
}

function signalNum(ctx: EngineContext, key: string): number | null {
  const s = ctx.signals.find((x) => x.key === key);
  return typeof s?.value === "number" ? s.value : null;
}

/** Scripted conditional follow-ups - the deterministic answer to the bonus challenge. */
function pickFollowUp(ctx: EngineContext): Question | null {
  const asked = new Set(ctx.answers.map((a) => a.questionId));

  if (ctx.track === "nsw") {
    const deviation = answerFor(ctx, "deviation").toLowerCase();
    if (deviation.includes("inconsistent") && !asked.has("thermal")) return NSW_FOLLOWUPS.inconsistent;
    if (deviation.includes("missing") && !asked.has("recovery")) return NSW_FOLLOWUPS.missing;
    if (deviation.includes("spreading") && !asked.has("standoff")) return NSW_FOLLOWUPS.spreading;
    return null;
  }

  const challenge = answerFor(ctx, "challenge").toLowerCase();
  if (challenge.includes("enquiries") && !asked.has("enquiry_hours")) return EXA_FOLLOWUPS.enquiries;
  if (challenge.includes("manual admin") && !asked.has("admin_hours")) return EXA_FOLLOWUPS.admin;
  return null;
}

function nswDimensions(ctx: EngineContext): ScoreDimension[] {
  const cv = signalNum(ctx, "size_cv");
  const circ = signalNum(ctx, "mean_circularity");
  const posDev = signalNum(ctx, "position_deviation_px");
  const measured = cv !== null;

  // With measurements, scores are derived from geometry. Without, they degrade
  // to a coarse estimate from the reported deviation, and say so.
  const deviation = answerFor(ctx, "deviation").toLowerCase();
  const rough = deviation.includes("inconsistent") ? 45 : deviation ? 60 : 70;

  const sizeScore = cv !== null ? Math.max(0, Math.round(100 - cv * 400)) : rough;
  const shapeScore = circ !== null ? Math.round(circ * 100) : rough;
  const posScore = posDev !== null ? Math.max(0, Math.round(100 - posDev * 4)) : rough;
  const riskScore = Math.round((sizeScore + shapeScore + posScore) / 3);

  const src = measured ? "Measured from the uploaded image." : "Estimated from the reported symptom; upload an image to measure.";

  return [
    { id: "shape", label: "Shape Consistency", stars: toStars(shapeScore), score: shapeScore, rationale: circ !== null ? `Mean circularity ${circ.toFixed(2)} across detected deposits.` : src },
    { id: "size", label: "Size Consistency", stars: toStars(sizeScore), score: sizeScore, rationale: cv !== null ? `Area coefficient of variation ${(cv * 100).toFixed(1)}% across detected deposits.` : src },
    { id: "position", label: "Dispensing Position", stars: toStars(posScore), score: posScore, rationale: posDev !== null ? `Mean centroid deviation ${posDev.toFixed(1)} px from the fitted grid.` : src },
    { id: "risk", label: "Defect Risk", stars: toStars(100 - riskScore), score: 100 - riskScore, rationale: "Composite of the three measures above; higher means more risk." },
  ];
}

function exaDimensions(ctx: EngineContext): ScoreDimension[] {
  const tools = answerFor(ctx, "tools").toLowerCase();
  const has = (t: string) => tools.includes(t.toLowerCase());

  const reachable = signalNum(ctx, "site_reachable");
  const https = signalNum(ctx, "https");
  const mobile = signalNum(ctx, "mobile_ready");
  const contact = signalNum(ctx, "has_contact");
  const analytics = signalNum(ctx, "has_analytics");
  const probed = reachable !== null;

  let website = has("Company website") ? 55 : 15;
  if (probed) {
    website = reachable ? 45 : 5;
    if (mobile) website += 20;
    if (contact) website += 20;
    if (signalNum(ctx, "has_cms")) website += 10;
  }

  let cyber = has("Cloud backup") ? 50 : 20;
  if (https !== null) cyber += https ? 25 : -10;

  const cloud = (has("Cloud file storage") ? 40 : 10) + (has("Business email") ? 30 : 0);
  const crm = has("CRM system") ? 70 : 10;
  const marketing = (analytics ? 45 : 15) + (has("E-commerce store") ? 25 : 0);
  const ai = 10;

  const clampScore = (n: number) => Math.max(0, Math.min(100, n));
  const rationale = (probedText: string, statedText: string) => (probed ? probedText : statedText);

  const raw: Record<string, { score: number; why: string }> = {
    website: { score: clampScore(website), why: rationale("Scored from the live site: reachability, mobile viewport, contact path and CMS.", "Scored from the tools the business reported having.") },
    cloud: { score: clampScore(cloud), why: "Scored from reported cloud storage and business email on a custom domain." },
    crm: { score: clampScore(crm), why: has("CRM system") ? "A CRM is already in place." : "No CRM reported; customer history is fragmented across inboxes." },
    marketing: { score: clampScore(marketing), why: rationale("Scored from observed analytics instrumentation and commerce capability.", "Scored from reported commerce and marketing tooling.") },
    cybersecurity: { score: clampScore(cyber), why: rationale("Scored from observed TLS plus reported backup coverage.", "Scored from reported backup coverage.") },
    ai_adoption: { score: clampScore(ai), why: "No AI tooling reported in current operations." },
  };

  return EXA_DIMENSIONS.map((d) => ({
    id: d.id,
    label: d.label,
    stars: toStars(raw[d.id].score),
    score: raw[d.id].score,
    rationale: raw[d.id].why,
  }));
}

function exaRoadmap(dims: ScoreDimension[]) {
  const weak = new Set(dims.filter((d) => d.score < 60).map((d) => d.id));
  const phases: Array<{ phase: string; horizon: string }> = [
    { phase: "Phase 1 - Quick Wins", horizon: "2-4 weeks" },
    { phase: "Phase 2 - Productivity", horizon: "3-6 months" },
    { phase: "Phase 3 - Growth", horizon: "6-12 months" },
  ];

  let order = 0;
  return phases.flatMap(({ phase, horizon }, i) => {
    const picks = EXA_CATALOG.filter((p) => p.phase === i + 1 && weak.has(p.dimension)).slice(0, 3);
    return picks.map((p) => ({
      order: ++order,
      title: p.name,
      detail: `${p.blurb} Indicative RM${p.indicativeMonthlyRM}/month.`,
      phase,
      horizon,
      impact: p.vendor === "Exabytes" ? "Exabytes service" : "Partner service",
    }));
  });
}

function exaRoi(ctx: EngineContext, topPainId: string): { note: string; annual: number } | null {
  const yieldDef = EXA_AUTOMATION_YIELD[topPainId];
  if (!yieldDef) return null;

  const hoursRaw = answerFor(ctx, "enquiry_hours") || answerFor(ctx, "admin_hours");
  const hours = Number.parseFloat(hoursRaw);
  if (!Number.isFinite(hours) || hours <= 0) return null;

  const saved = Math.round(hours * yieldDef.share);
  const annual = Math.round(saved * DEFAULT_HOURLY_RM * 52);
  return {
    annual,
    note: `${hours} hours/week currently spent; ${yieldDef.lever} is modelled to absorb ${Math.round(
      yieldDef.share * 100,
    )}% of that, saving ${saved} hours/week. At an indicative RM${DEFAULT_HOURLY_RM}/hour fully-loaded cost, that is roughly RM${annual.toLocaleString()} per year.`,
  };
}

export const deterministicEngine: Engine = {
  id: "deterministic",
  label: "Deterministic inference engine",

  async nextQuestion(ctx) {
    const base = ctx.track === "nsw" ? NSW_QUESTIONS : EXA_QUESTIONS;
    const asked = new Set(ctx.answers.map((a) => a.questionId));
    const pending = base.find((q) => !asked.has(q.id));
    if (pending) return pending;
    return pickFollowUp(ctx);
  },

  async analyze(ctx) {
    const started = Date.now();
    const causeDefs = ctx.track === "nsw" ? NSW_CAUSES : EXA_PAINPOINTS;
    const causes = rankCauses(causeDefs, ctx.answers, ctx.signals);
    const dimensions = ctx.track === "nsw" ? nswDimensions(ctx) : exaDimensions(ctx);
    const overall = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);
    const notes: string[] = [];

    let headline: string;
    let summary: string;
    let actions: Analysis["actions"];

    if (ctx.track === "nsw") {
      const defect = NSW_DEFECTS[answerFor(ctx, "deviation")];
      headline = defect?.label ?? "Dispensing Deviation";
      const top = causes[0];
      summary = defect
        ? `Expected symptoms: ${defect.symptoms.join("; ")}. The leading cause is ${top.label.toLowerCase()} at ${Math.round(top.likelihood * 100)}%.`
        : `The leading cause is ${top.label.toLowerCase()} at ${Math.round(top.likelihood * 100)}%.`;

      // The action plan is the highest-value checks from the highest-ranked causes,
      // cheapest and most-likely first.
      actions = causes.slice(0, 3).flatMap((c, ci) =>
        c.checks.slice(0, ci === 0 ? 3 : 1).map((check) => ({
          order: 0,
          title: check,
          detail: `Addresses ${c.label.toLowerCase()} (${Math.round(c.likelihood * 100)}% likelihood).`,
        })),
      ).map((a, i) => ({ ...a, order: i + 1 }));

      if (!ctx.signals.length) notes.push("No image measurements supplied - scores are estimated from reported symptoms only.");
    } else {
      headline = `Digital Maturity ${overall}/100`;
      const top = causes[0];
      summary = `The dominant constraint is ${top.label.toLowerCase()} at ${Math.round(top.likelihood * 100)}% confidence.`;
      actions = exaRoadmap(dimensions);

      const roi = exaRoi(ctx, causes[0].id);
      if (roi) {
        notes.push(roi.note);
        actions.unshift({
          order: 0,
          title: `Estimated annual saving: RM${roi.annual.toLocaleString()}`,
          detail: roi.note,
          phase: "ROI projection",
          horizon: "annualised",
        });
        actions = actions.map((a, i) => ({ ...a, order: i + 1 }));
      }
      if (!ctx.signals.length) notes.push("No website probe run - maturity is scored from self-reported tooling only.");
    }

    return {
      headline,
      summary,
      overall,
      dimensions,
      causes,
      actions,
      signals: ctx.signals,
      meta: {
        engine: "deterministic",
        reproducible: true,
        grounded: ctx.signals.length > 0,
        elapsedMs: Date.now() - started,
        notes,
      },
    };
  },
};

export { coefficientOfVariation };
