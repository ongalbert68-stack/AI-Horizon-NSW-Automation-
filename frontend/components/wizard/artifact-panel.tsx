"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileGeometryPattern } from "@/components/profile-geometry-pattern";
import { TierInfo } from "@/components/tier-info";
import type {
  Case, CauseComparison, CheckResult, CloseCaseResponse, CoarseMatch, FingerprintAxes,
  Question, Ranking, Report, VisionResult,
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
  ranking: Ranking | null;
  comparison: CauseComparison[] | null;
  checks: CheckResult[];
  report: Report | null;
  close: CloseCaseResponse | null;
}

const TIER_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  T1: "default", T2: "secondary", T3: "secondary", T4: "destructive",
};

function ArtifactCard({
  title, extra, children,
}: {
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {extra}
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

function causeLabel(ranking: Ranking, causeId: string): string {
  return ranking.pass1.find((c) => c.cause_id === causeId)?.label ?? causeId;
}

export function ArtifactPanel({ artifacts }: { artifacts: Artifacts }) {
  const { caseData } = artifacts;
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

  return (
    <div className="h-full min-h-0 flex-1 overflow-y-scroll thin-scrollbar p-4 space-y-4">
        <ArtifactCard title="Case & Profile">
          <p className="font-medium">#{caseData.case_id} &middot; {caseData.complaint ?? "unclassified"}</p>
          <p className="text-muted-foreground">
            {caseData.station.name} ({caseData.station.line}) &middot; {caseData.profile.name} &middot;{" "}
            {caseData.profile.material.name}
          </p>
          {caseData.profile.geometry && (
            <div className="mt-3 border-t pt-2.5">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                Dispense Pattern Geometry
              </div>
              <ProfileGeometryPattern
                geometry={caseData.profile.geometry}
                specMetric={caseData.profile.spec_metric}
                specLimit={caseData.profile.spec_limit}
                canvasClassName="h-64"
              />
            </div>
          )}
        </ArtifactCard>

        {artifacts.photoUrl && (
          <ArtifactCard title="Photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artifacts.photoUrl} alt="Uploaded dispense photo" className="w-full rounded-md border" />
          </ArtifactCard>
        )}

        {hasAxes && (
          <ArtifactCard title="Answers so far">
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
          <ArtifactCard title="Vision (step 3)">
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
          <ArtifactCard title="Coarse retrieval (step 2b)">
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

        {artifacts.ranking && (
          <ArtifactCard title="Ranking (step 5)" extra={<TierInfo />}>
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

            <div className="mb-1 text-xs font-medium text-muted-foreground">Candidate causes (pass 1)</div>
            <div className="space-y-2">
              {artifacts.ranking.pass1.slice(0, 4).map((c) => (
                <div key={c.cause_id}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{c.label}</span>
                    <span className="text-muted-foreground">{Math.round(c.likelihood * 100)}%</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${c.likelihood * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </ArtifactCard>
        )}

        {artifacts.checks.length > 0 && (
          <ArtifactCard
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
          <ArtifactCard title="Report (step 7)">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge>{artifacts.report.defect.magnitude}</Badge>
              <Badge variant="outline">{"★".repeat(artifacts.report.defect.stars)}{"☆".repeat(5 - artifacts.report.defect.stars)}</Badge>
            </div>
            {artifacts.report.explanation && <p className="text-xs">{artifacts.report.explanation}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{artifacts.report.disclaimer}</p>
          </ArtifactCard>
        )}

        {artifacts.close && (
          <ArtifactCard title="Closed (step 8)">
            <Badge>{artifacts.close.tier}</Badge>
            {artifacts.close.gaps.length > 0 && (
              <ul className="ml-4 mt-2 list-disc text-xs text-muted-foreground">
                {artifacts.close.gaps.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            )}
          </ArtifactCard>
        )}

        {/* Extra bottom space allowing scrolling with content on top */}
        <div className="h-[50vh] shrink-0 pointer-events-none" aria-hidden="true" />
    </div>
  );
}
