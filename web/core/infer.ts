// Additive log-odds inference over a hand-built cause model.
//
// Each cause starts at a prior. Every matching rule contributes a weight in
// log-odds space; the sum is squashed back to a probability. This is what makes
// the output defensible: a percentage is never asserted, it is derived, and each
// contributing term can be shown to the user with its physical justification.

import type { Answer, Evidence, RankedCause, Signal } from "./types";
import { sigmoid, toLogit } from "./math";

export interface CauseRule {
  weight: number;
  label: string;
  detail: string;
  /** Fires when the named question was answered with one of these values. */
  answer?: { id: string; match: string[] };
  /** Fires when a measured signal crosses a threshold. */
  signal?: { key: string; gt?: number; lt?: number };
}

export interface CauseDef {
  id: string;
  label: string;
  prior: number;
  rules: CauseRule[];
  checks: string[];
}

function ruleFires(rule: CauseRule, answers: Answer[], signals: Signal[]): boolean {
  if (rule.answer) {
    const given = answers.find((a) => a.questionId === rule.answer!.id);
    if (!given) return false;
    const value = given.value.toLowerCase();
    return rule.answer.match.some((m) => value.includes(m.toLowerCase()));
  }
  if (rule.signal) {
    const sig = signals.find((s) => s.key === rule.signal!.key);
    if (!sig || typeof sig.value !== "number") return false;
    if (rule.signal.gt !== undefined && !(sig.value > rule.signal.gt)) return false;
    if (rule.signal.lt !== undefined && !(sig.value < rule.signal.lt)) return false;
    return true;
  }
  return false;
}

export function rankCauses(
  causes: CauseDef[],
  answers: Answer[],
  signals: Signal[],
): RankedCause[] {
  return causes
    .map((cause) => {
      const base = toLogit(cause.prior);
      const evidence: Evidence[] = [
        {
          label: "Base rate",
          detail: `Starting prior for ${cause.label.toLowerCase()} before any evidence.`,
          source: "prior",
          weight: base,
        },
      ];

      let logit = base;
      for (const rule of cause.rules) {
        if (!ruleFires(rule, answers, signals)) continue;
        logit += rule.weight;
        evidence.push({
          label: rule.label,
          detail: rule.detail,
          source: rule.signal ? "measurement" : "user",
          weight: rule.weight,
        });
      }

      const likelihood = sigmoid(logit);
      const drivers = evidence
        .filter((e) => e.source !== "prior" && e.weight > 0)
        .sort((a, b) => b.weight - a.weight);

      const reasoning = drivers.length
        ? `Ranked at ${Math.round(likelihood * 100)}% because ${drivers[0].detail}` +
          (drivers[1] ? ` ${drivers[1].detail}` : "")
        : `No evidence gathered so far supports or excludes this; it remains at its ${Math.round(
            cause.prior * 100,
          )}% base rate.`;

      return {
        id: cause.id,
        label: cause.label,
        likelihood,
        reasoning,
        evidence,
        checks: cause.checks,
      };
    })
    .sort((a, b) => b.likelihood - a.likelihood);
}
