"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileGeometryPattern } from "@/components/profile-geometry-pattern";
import { TierInfo } from "@/components/tier-info";
import type {
  Case, CauseComparison, CheckResult, CloseCaseResponse, CoarseMatch, FingerprintAxes,
  Precedents, Question, Ranking, Report, VisionResult,
} from "@/lib/api/types";

export interface Artifacts {
  caseData: Case;
  photoUrl: string | null;
  /** The question spine, carried so this panel can show the answers in
   * the same words the operator was asked in — it used to print the
   * stored ids ("near_syringe_end"). */
  questions: Question[];
  axes: Partial<FingerprintAxes>;
  /** Raw "Other (describe)" words, keyed by axis id. */
  axisNotes: Record<string, string>;
  vision: VisionResult | null;
  coarse: CoarseMatch[] | null;
  /** The learning-database tally over the coarse matches. */
  precedents: Precedents | null;
  ranking: Ranking | null;
  comparison: CauseComparison[] | null;
  checks: CheckResult[];
  report: Report | null;
  close: CloseCaseResponse | null;
}

const TIER_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  T1: "default", T2: "secondary", T3: "secondary", T4: "destructive",
};

/** What a closed case actually asserts. Closing is not the same as fixing:
 * step 8 tiers on what was *proved*, so a case can close with the cause
 * pinned down and nothing repaired. The tier name alone reads like a
 * verdict on the repair, so the plain sentence is shown next to it. */
const CLOSE_MEANING: Record<string, { headline: string; detail: string }> = {
  CONFIRMED: {
    headline: "Fixed and proved",
    detail:
      "A check confirmed the cause, exactly one thing was changed, and the deciding signal was " +
      "re-measured in spec and held. This is the only tier that claims the fix worked, and the " +
      "only one that feeds future rankings.",
  },
  PLAUSIBLE: {
    headline: "Not proved fixed",
    detail:
      "Some of the five close conditions were met, but not all — so the case is a documented " +
      "lead, not a verified repair. It's shown to a human as context and adjusts nothing.",
  },
  UNVERIFIED: {
    headline: "Nothing proved",
    detail:
      "None of the five close conditions were met. The case is on file with what was tried, " +
      "and it adjusts nothing.",
  },
};

function ArtifactCard({
  title, extra, children, cardId, isHighlighted,
}: {
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  cardId?: string;
  isHighlighted?: boolean;
}) {
  return (
    <div
      data-card-id={cardId}
      className={`rounded-xl transition-all duration-500 ${
        isHighlighted
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-[1.008]"
          : ""
      }`}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {title}
            {isHighlighted && (
              <span className="inline-flex items-center gap-1 text-[10px] font-normal text-primary animate-pulse">
                <Sparkles className="size-3" /> Updated
              </span>
            )}
          </CardTitle>
          {extra}
        </CardHeader>
        <CardContent className="text-sm">{children}</CardContent>
      </Card>
    </div>
  );
}

function causeLabel(ranking: Ranking, causeId: string): string {
  return ranking.pass1.find((c) => c.cause_id === causeId)?.label ?? causeId;
}

export function ArtifactPanel({ artifacts }: { artifacts: Artifacts }) {
  const { caseData } = artifacts;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [highlightedCardId, setHighlightedCardId] = React.useState<string | null>(null);

  // Tracking previous likelihoods for candidate causes to compute difference bars
  const [prevLikelihoods, setPrevLikelihoods] = React.useState<Record<string, number>>({});
  const lastPass1Ref = React.useRef<Record<string, number> | null>(null);

  const hasAxes = Object.values(artifacts.axes).some((v) => (Array.isArray(v) ? v.length : v));

  /** An answer in the words it was offered in. */
  function answerLabel(axisId: string, value: string): string {
    if (value === "dont_know") return "Don't know";
    if (value === "unmapped") return artifacts.axisNotes[axisId] ?? "described in own words";
    const q = artifacts.questions.find((x) => x.id === axisId);
    return q?.options.find((o) => o.value === value)?.label ?? value.replaceAll("_", " ");
  }

  /** The five axes, rendered from the spec so this list can't drift out of
   * order or out of vocabulary with the interview itself. */
  const answerRows = (
    [
      ["signature", artifacts.axes.signature],
      ["trajectory", artifacts.axes.trajectory],
      ["footprint", artifacts.axes.footprint],
      ["inputs", artifacts.axes.inputs],
      ["response", artifacts.axes.response],
    ] as const
  )
    .map(([axisId, raw]) => {
      const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
      if (values.length === 0) return null;
      const question = artifacts.questions.find((q) => q.id === axisId);
      return {
        axisId,
        prompt: question?.prompt ?? axisId,
        answer: values.map((v) => answerLabel(axisId, v)).join(", "),
        note: artifacts.axisNotes[axisId],
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  // Track and update candidate cause likelihood changes
  React.useEffect(() => {
    if (!artifacts.ranking?.pass1) return;
    const currentMap: Record<string, number> = {};
    for (const c of artifacts.ranking.pass1) {
      currentMap[c.cause_id] = Math.round(c.likelihood * 100);
    }

    if (lastPass1Ref.current) {
      const hasDifference = Object.keys(currentMap).some(
        (id) => lastPass1Ref.current![id] !== undefined && lastPass1Ref.current![id] !== currentMap[id]
      );
      if (hasDifference) {
        setPrevLikelihoods({ ...lastPass1Ref.current });
      }
    } else {
      // Check session storage for a saved baseline if available
      try {
        const stored = sessionStorage.getItem(`aihorizon_prev_ranking_${caseData.case_id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setPrevLikelihoods(parsed);
        }
      } catch {
        // ignore
      }
    }

    lastPass1Ref.current = currentMap;
    try {
      sessionStorage.setItem(`aihorizon_prev_ranking_${caseData.case_id}`, JSON.stringify(currentMap));
    } catch {
      // ignore
    }
  }, [artifacts.ranking, caseData.case_id]);

  // Smoothly scroll the panel to the target card
  const scrollToCard = React.useCallback((cardId: string) => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement | null;
    if (!target) return;

    const containerTop = container.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const scrollOffset = targetTop - containerTop + container.scrollTop - 12;

    container.scrollTo({ top: Math.max(0, scrollOffset), behavior: "smooth" });

    setHighlightedCardId(cardId);
    setTimeout(() => {
      setHighlightedCardId((curr) => (curr === cardId ? null : curr));
    }, 2500);
  }, []);

  // Detect whenever a new artifact is created or an existing one is updated
  const prevSnapshotRef = React.useRef<{
    hasPhoto: boolean;
    answersCount: number;
    hasVision: boolean;
    hasCoarse: boolean;
    rankingSig: string;
    checksCount: number;
    hasReport: boolean;
    hasClose: boolean;
    isInitial: boolean;
  }>({
    hasPhoto: Boolean(artifacts.photoUrl),
    answersCount: answerRows.length,
    hasVision: Boolean(artifacts.vision),
    hasCoarse: Boolean(artifacts.coarse),
    rankingSig: artifacts.ranking ? JSON.stringify(artifacts.ranking.pass1.map((p) => p.likelihood)) : "",
    checksCount: artifacts.checks.length,
    hasReport: Boolean(artifacts.report),
    hasClose: Boolean(artifacts.close),
    isInitial: true,
  });

  React.useEffect(() => {
    const prev = prevSnapshotRef.current;
    const currentRankingSig = artifacts.ranking
      ? JSON.stringify(artifacts.ranking.pass1.map((p) => p.likelihood))
      : "";

    if (prev.isInitial) {
      prev.isInitial = false;
      // On initial mount, scroll to the most advanced artifact present
      let initialCard: string | null = null;
      if (artifacts.close) initialCard = "card-close";
      else if (artifacts.report) initialCard = "card-report";
      else if (artifacts.checks.length > 0) initialCard = "card-checks";
      else if (artifacts.ranking) initialCard = "card-ranking";
      else if (artifacts.coarse) initialCard = "card-coarse";
      else if (artifacts.vision) initialCard = "card-vision";
      else if (answerRows.length > 0) initialCard = "card-answers";
      else if (artifacts.photoUrl) initialCard = "card-photo";

      if (initialCard) {
        setTimeout(() => scrollToCard(initialCard!), 150);
      }
      return;
    }

    let targetCard: string | null = null;

    if (!prev.hasClose && artifacts.close) {
      targetCard = "card-close";
    } else if (!prev.hasReport && artifacts.report) {
      targetCard = "card-report";
    } else if (currentRankingSig !== prev.rankingSig && artifacts.ranking) {
      // Candidate causes ranking updated or recomputed
      targetCard = "card-ranking";
    } else if (artifacts.checks.length > prev.checksCount) {
      targetCard = "card-checks";
    } else if (!prev.hasCoarse && artifacts.coarse) {
      targetCard = "card-coarse";
    } else if (!prev.hasVision && artifacts.vision) {
      targetCard = "card-vision";
    } else if (answerRows.length > prev.answersCount) {
      targetCard = "card-answers";
    } else if (!prev.hasPhoto && artifacts.photoUrl) {
      targetCard = "card-photo";
    }

    // Update snapshot for next comparison
    prevSnapshotRef.current = {
      hasPhoto: Boolean(artifacts.photoUrl),
      answersCount: answerRows.length,
      hasVision: Boolean(artifacts.vision),
      hasCoarse: Boolean(artifacts.coarse),
      rankingSig: currentRankingSig,
      checksCount: artifacts.checks.length,
      hasReport: Boolean(artifacts.report),
      hasClose: Boolean(artifacts.close),
      isInitial: false,
    };

    if (targetCard) {
      scrollToCard(targetCard);
    }
  }, [
    artifacts.close,
    artifacts.report,
    artifacts.checks.length,
    artifacts.ranking,
    artifacts.coarse,
    artifacts.vision,
    artifacts.photoUrl,
    answerRows.length,
    scrollToCard,
  ]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-0 flex-1 overflow-y-scroll thin-scrollbar p-4 space-y-4 scroll-smooth"
    >
        <ArtifactCard
          cardId="card-setup"
          isHighlighted={highlightedCardId === "card-setup"}
          title="Case & Profile Setup"
          extra={
            <Link
              href={`/cases/${caseData.case_id}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Full Details <ExternalLink className="size-3" />
            </Link>
          }
        >
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-foreground">
                Case #{caseData.case_id} &middot; {caseData.complaint ?? "unclassified"}
              </p>
              <p className="text-xs text-muted-foreground">
                Station: <span className="font-medium text-foreground">{caseData.station.name}</span> ({caseData.station.line}) &middot; Profile:{" "}
                <span className="font-medium text-foreground">{caseData.profile.name}</span>
              </p>
            </div>

            {/* Quick Reference Specs Grid */}
            <div className="rounded-md border bg-muted/25 p-2.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">
                  Material: {caseData.profile.material.name}
                </span>
                {caseData.profile.material.part_number && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    #{caseData.profile.material.part_number}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <div>Family: <span className="font-medium text-foreground">{caseData.profile.material.family}</span></div>
                <div>Dispenser: <span className="font-medium text-foreground">{caseData.station.dispenser_class}</span></div>
                <div>Needle: <span className="font-medium text-foreground">{caseData.profile.needle_gauge ?? "—"}</span></div>
                <div>Pressure: <span className="font-medium text-foreground">{caseData.profile.set_pressure_kpa ? `${caseData.profile.set_pressure_kpa} kPa` : "—"}</span></div>
                {caseData.profile.material.pot_life_hours && (
                  <div>Pot Life: <span className="font-medium text-foreground">{caseData.profile.material.pot_life_hours}h</span></div>
                )}
                {caseData.profile.material.out_time_hours && (
                  <div>Out-Time: <span className="font-medium text-foreground">{caseData.profile.material.out_time_hours}h</span></div>
                )}
              </div>
            </div>

            {caseData.profile.geometry && (
              <div className="border-t pt-2.5">
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Dispense Pattern Geometry</span>
                  <Link
                    href={`/profiles/${caseData.profile.profile_id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-[11px] text-sky-500 hover:underline"
                  >
                    View Blueprint <ExternalLink className="size-3" />
                  </Link>
                </div>
                <ProfileGeometryPattern
                  geometry={caseData.profile.geometry}
                  specMetric={caseData.profile.spec_metric}
                  specLimit={caseData.profile.spec_limit}
                  canvasClassName="h-64"
                />
              </div>
            )}
          </div>
        </ArtifactCard>

        {artifacts.photoUrl && (
          <ArtifactCard
            cardId="card-photo"
            isHighlighted={highlightedCardId === "card-photo"}
            title="Photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artifacts.photoUrl} alt="Uploaded dispense photo" className="w-full rounded-md border" />
          </ArtifactCard>
        )}

        {hasAxes && (
          <ArtifactCard
            cardId="card-answers"
            isHighlighted={highlightedCardId === "card-answers"}
            title="Answers so far"
          >
            <dl className="space-y-2">
              {answerRows.map((row) => (
                <div key={row.axisId}>
                  <dt className="text-xs text-muted-foreground">{row.prompt}</dt>
                  <dd>{row.answer}</dd>
                  {row.note && row.note !== row.answer && (
                    <dd className="text-xs text-muted-foreground">your words: &ldquo;{row.note}&rdquo;</dd>
                  )}
                </div>
              ))}
            </dl>
          </ArtifactCard>
        )}

        {artifacts.vision && (
          <ArtifactCard
            cardId="card-vision"
            isHighlighted={highlightedCardId === "card-vision"}
            title="Vision (step 3)"
          >
            <Badge variant={artifacts.vision.quality_ok ? "outline" : "destructive"} className="mb-2">
              {artifacts.vision.quality_ok ? "quality ok" : artifacts.vision.quality_reason}
            </Badge>
            {artifacts.vision.quality_ok && (
              <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                {Object.entries(artifacts.vision.signals ?? {}).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>{typeof v === "number" ? v.toFixed(3) : String(v)}</dd>
                  </React.Fragment>
                ))}
              </dl>
            )}
            <p className="mt-2 text-xs text-muted-foreground">magnitude: {artifacts.vision.magnitude}</p>
          </ArtifactCard>
        )}

        {artifacts.coarse && (
          <ArtifactCard
            cardId="card-coarse"
            isHighlighted={highlightedCardId === "card-coarse"}
            title="Coarse retrieval (step 2b)"
          >
            {artifacts.coarse.length === 0 ? (
              <p className="text-muted-foreground">No similar past cases yet — nothing to pre-load.</p>
            ) : (
              <ul className="space-y-1">
                {artifacts.coarse.map((m) => (
                  <li key={m.case_id} className="flex items-center justify-between">
                    <span>case #{m.case_id} &middot; {m.matched_axes.join(", ")}</span>
                    <Badge variant="outline">{m.score.toFixed(2)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </ArtifactCard>
        )}

        {artifacts.precedents && (
          <ArtifactCard
            cardId="card-precedents"
            isHighlighted={highlightedCardId === "card-precedents"}
            title="What happened last time"
            extra={
              <span className="text-[11px] text-muted-foreground">
                {artifacts.precedents.total} similar case
                {artifacts.precedents.total === 1 ? "" : "s"}
              </span>
            }
          >
            {artifacts.precedents.sentence ? (
              <p className="font-medium text-foreground">{artifacts.precedents.sentence}</p>
            ) : (
              <p className="text-muted-foreground">{artifacts.precedents.note}</p>
            )}

            {artifacts.precedents.by_cause.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {artifacts.precedents.by_cause.map((tally) => (
                  <div key={tally.cause_id} className="text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="leading-snug">{tally.label}</span>
                      <span className="shrink-0 font-mono font-semibold">
                        {tally.count}&times;
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-sky-500/70"
                        style={{ width: `${Math.round(tally.share * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* The disclaimer is not decoration: this panel sits directly
                above the ranking, and an operator who reads the two as one
                number would be double-counting history that the ranking
                deliberately never saw. */}
            {artifacts.precedents.sentence && (
              <p className="mt-2 text-[11px] text-muted-foreground">{artifacts.precedents.note}</p>
            )}
          </ArtifactCard>
        )}

        {artifacts.ranking && (
          <ArtifactCard
            cardId="card-ranking"
            isHighlighted={highlightedCardId === "card-ranking"}
            title="Ranking (step 5)"
            extra={<TierInfo />}
          >
            <div className="mb-3 rounded-md border bg-muted/40 p-2 text-xs">
              <div className="text-muted-foreground">Recognized defect — what&apos;s wrong</div>
              <div className="font-medium">
                {artifacts.axes.signature && artifacts.axes.signature.length > 0
                  ? artifacts.axes.signature.map((s) => answerLabel("signature", s)).join(", ")
                  : "not classified"}
                {artifacts.vision?.quality_ok && ` · ${artifacts.vision.magnitude} deviation`}
              </div>
              <div className="mt-1 text-muted-foreground">
                The candidates below are <span className="font-medium text-foreground">causes</span> — why that
                defect might be happening, not other defects.
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant={TIER_VARIANT[artifacts.ranking.tier]}>{artifacts.ranking.tier}</Badge>
              <Badge variant="outline">
                {artifacts.ranking.critic_top_cause_id
                  ? artifacts.ranking.agree
                    ? "critic agrees"
                    : "critic disagrees"
                  : "critic abstained"}
              </Badge>
            </div>

            {/* Shown whenever the critic ran, not only on disagreement:
                "it abstained" is a fact about the evidence, and hiding it
                made an abstention look like agreement. */}
            {artifacts.ranking.pass2 !== null || artifacts.ranking.critic_note ? (
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Pass 1 &middot; rule engine</div>
                  <div className="font-medium">{artifacts.ranking.pass1[0]?.label ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pass 2 &middot; LLM critic</div>
                  <div className="font-medium">
                    {artifacts.ranking.critic_top_cause_id
                      ? causeLabel(artifacts.ranking, artifacts.ranking.critic_top_cause_id)
                      : artifacts.ranking.pass2 && artifacts.ranking.pass2.length > 0
                        ? "no clear pick"
                        : "not run — no LLM key configured"}
                  </div>
                </div>
                {artifacts.ranking.critic_note && (
                  <p className="col-span-2 text-muted-foreground">{artifacts.ranking.critic_note}</p>
                )}
              </div>
            ) : null}

            <div className="mb-3 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Badge variant={artifacts.ranking.gate_a.above_chance ? "outline" : "secondary"} className="shrink-0">
                  {artifacts.ranking.gate_a.above_chance ? "above chance" : "at chance"}
                </Badge>
                <span className="text-muted-foreground">{artifacts.ranking.gate_a.note}</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant={artifacts.ranking.gate_b.applied ? "outline" : "secondary"} className="shrink-0">
                  {artifacts.ranking.gate_b.matched_count} precedent{artifacts.ranking.gate_b.matched_count === 1 ? "" : "s"}
                </Badge>
                <span className="text-muted-foreground">{artifacts.ranking.gate_b.note}</span>
              </div>
            </div>

            {/* Candidate causes with green/red difference bars */}
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-foreground">Candidate causes (pass 1)</div>
              {Object.keys(prevLikelihoods).length > 0 && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 inline-block" /> + Increase
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                    <span className="size-1.5 rounded-full bg-rose-500 inline-block" /> - Decrease
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {artifacts.ranking.pass1.slice(0, 4).map((c) => {
                const currentPct = Math.round(c.likelihood * 100);
                const prevPct = prevLikelihoods[c.cause_id];
                const hasDiff = prevPct !== undefined && prevPct !== null;
                const diff = hasDiff ? currentPct - prevPct : 0;
                const increased = hasDiff && diff > 0;
                const decreased = hasDiff && diff < 0;

                return (
                  <div
                    key={c.cause_id}
                    className="rounded-lg border border-border/60 bg-background/60 p-2.5 text-xs space-y-1.5 transition-all shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-foreground leading-snug">{c.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        {increased && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <ArrowUp className="size-2.5 stroke-[2.5]" /> +{diff}%
                          </span>
                        )}
                        {decreased && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <ArrowDown className="size-2.5 stroke-[2.5]" /> {diff}%
                          </span>
                        )}
                        {hasDiff && diff === 0 && (
                          <span className="text-[10px] font-medium text-muted-foreground px-1">±0%</span>
                        )}
                        <span className="font-mono text-xs font-bold text-foreground min-w-[2.5rem] text-right">
                          {currentPct}%
                        </span>
                      </div>
                    </div>

                    {/* Difference Bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted flex">
                      {increased ? (
                        <>
                          {/* Base previous percentage */}
                          <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${prevPct}%` }}
                          />
                          {/* Green positive difference bar */}
                          <div
                            className="h-full bg-emerald-500 shadow-xs transition-all duration-500 animate-pulse-subtle"
                            style={{ width: `${diff}%` }}
                            title={`Increased by +${diff}% (from ${prevPct}% to ${currentPct}%)`}
                          />
                        </>
                      ) : decreased ? (
                        <>
                          {/* Remaining percentage */}
                          <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${currentPct}%` }}
                          />
                          {/* Red negative difference bar */}
                          <div
                            className="h-full bg-rose-500/85 transition-all duration-500"
                            style={{ width: `${Math.abs(diff)}%` }}
                            title={`Decreased by ${diff}% (from ${prevPct}% to ${currentPct}%)`}
                          />
                        </>
                      ) : (
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${currentPct}%` }}
                        />
                      )}
                    </div>

                    {/* The before/after figures only. The arrow badge above
                        already states the delta, so the second "+62%
                        difference" readout and its mini bar that used to sit
                        here were the same number said three times. */}
                    {hasDiff && diff !== 0 && (
                      <div className="pt-0.5 text-[10px] text-muted-foreground">
                        Previous: <strong className="text-foreground">{prevPct}%</strong> &rarr; Now:{" "}
                        <strong className="text-foreground">{currentPct}%</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ArtifactCard>
        )}

        {artifacts.checks.length > 0 && (
          <ArtifactCard
            cardId="card-checks"
            isHighlighted={highlightedCardId === "card-checks"}
            title="Troubleshooting loop (step 6)"
            extra={
              <span className="text-xs text-muted-foreground">
                {artifacts.checks.filter((c) => c.is_change).length} change
                {artifacts.checks.filter((c) => c.is_change).length === 1 ? "" : "s"} &middot;{" "}
                {artifacts.checks.filter((c) => !c.is_change).length} looked
              </span>
            }
          >
            <ul className="space-y-1">
              {artifacts.checks.map((c) => (
                <li key={c.check_result_id} className="flex items-start justify-between gap-2">
                  <span>
                    #{c.sequence} {c.check_name}
                    {/* Only changes count at close, so which is which has
                        to be visible in the log itself. */}
                    <span className="text-xs text-muted-foreground">
                      {c.is_change ? " · changed something" : " · looked only"}
                    </span>
                  </span>
                  <Badge variant="outline" className="shrink-0">{c.outcome ?? "logged"}</Badge>
                </li>
              ))}
            </ul>
          </ArtifactCard>
        )}

        {artifacts.report && (
          <ArtifactCard
            cardId="card-report"
            isHighlighted={highlightedCardId === "card-report"}
            title="Report (step 7)"
          >
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge>{artifacts.report.defect.magnitude}</Badge>
              <Badge variant="outline">{"★".repeat(artifacts.report.defect.stars)}{"☆".repeat(5 - artifacts.report.defect.stars)}</Badge>
            </div>
            {artifacts.report.explanation && <p className="text-xs">{artifacts.report.explanation}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{artifacts.report.disclaimer}</p>
          </ArtifactCard>
        )}

        {artifacts.close && (
          <ArtifactCard
            cardId="card-close"
            isHighlighted={highlightedCardId === "card-close"}
            title="Closed (step 8)"
          >
            <div className="flex items-center gap-2">
              <Badge>{artifacts.close.tier}</Badge>
              <span className="text-xs font-medium">{CLOSE_MEANING[artifacts.close.tier]?.headline}</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {CLOSE_MEANING[artifacts.close.tier]?.detail}
            </p>
            {artifacts.close.gaps.length > 0 && (
              <>
                <p className="mt-2 text-xs font-medium text-foreground">
                  What wasn&apos;t proved:
                </p>
                <ul className="ml-4 mt-1 list-disc text-xs text-muted-foreground">
                  {artifacts.close.gaps.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </>
            )}
          </ArtifactCard>
        )}

        {/* Extra bottom space allowing scrolling with content on top */}
        <div className="h-[50vh] shrink-0 pointer-events-none" aria-hidden="true" />
    </div>
  );
}
