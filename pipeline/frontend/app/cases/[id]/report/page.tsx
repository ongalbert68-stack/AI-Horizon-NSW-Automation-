"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { getCase } from "@/lib/api/cases";
import { getReport } from "@/lib/api/report";
import type { Case, Report } from "@/lib/api/types";

/** One numbered section of the printed report. `break-inside-avoid` keeps
 * a section from being split across a page break, which is the difference
 * between a report that reads as a document and one that reads as a web
 * page someone printed. */
function Section({
  n, title, children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid space-y-2">
      <h2 className="border-b pb-1 text-lg font-semibold tracking-tight">
        <span className="mr-2 text-muted-foreground">{n}.</span>
        {title}
      </h2>
      <div className="text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} of 5`}>
      {"★".repeat(n)}
      {"☆".repeat(Math.max(0, 5 - n))}
    </span>
  );
}

export default function CaseReportPage() {
  const params = useParams<{ id: string }>();
  const caseId = Number(params.id);

  const [caseData, setCaseData] = React.useState<Case | null>(null);
  const [report, setReport] = React.useState<Report | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      getCase(caseId),
      // No LLM explanation: opening a report shouldn't spend one of the
      // two calls W7 budgets per case. Whatever the wizard already wrote
      // is stored on the case and comes back either way.
      getReport(caseId, false),
    ])
      .then(([c, r]) => {
        if (cancelled) return;
        setCaseData(c);
        setReport(r);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Could not load the report."),
      );
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (error) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-destructive">{error}</div>;
  }

  if (!caseData || !report) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-6 py-10">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const top = report.causes[0];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      {/* Screen-only controls. The browser's own Save-as-PDF is the
          generator — no PDF library, and the document stays a real page
          that can be linked and re-read. */}
      <div className="mb-6 flex items-center justify-between gap-2 print:hidden">
        <Link
          href={`/cases/${caseId}`}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1.5" })}
        >
          <ArrowLeft className="size-4" />
          Back to Case #{caseId}
        </Link>
        <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print / Save as PDF
        </Button>
      </div>

      <article className="space-y-6">
        <header className="space-y-1 border-b pb-3">
          <h1 className="text-2xl font-bold tracking-tight">Troubleshooting Report</h1>
          <p className="text-[15px] text-muted-foreground">
            Case #{report.case_id} &middot; {caseData.station.name} ({caseData.station.line})
            &middot; {caseData.profile.name} &middot; {caseData.profile.material.name}
          </p>
          <p className="text-[13px] text-muted-foreground">
            Opened {new Date(caseData.opened_at).toLocaleString()}
            {caseData.closed_at && <> &middot; Closed {new Date(caseData.closed_at).toLocaleString()}</>}
            {" "}&middot; Rules {report.rules_version}
            {" "}&middot; {report.llm_used ? "LLM assisted" : "No LLM used"}
          </p>
        </header>

        {/* The operator's own words lead. The classified complaint is the
            system's reading of them and is labelled as such — printing the
            picked category as the problem description put the tool's words
            in the reporter's mouth. */}
        <Section n={1} title="Problem Description">
          {report.complaint_text ? (
            <>
              <p className="whitespace-pre-wrap">
                &ldquo;{report.complaint_text}&rdquo;
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                As reported by the operator at intake. Classified by the system as{" "}
                <span className="font-medium text-foreground">
                  {report.complaint ?? "unclassified"}
                </span>
                .
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">{report.complaint ?? "Unclassified complaint"}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Selected from the complaint list at intake; no free-text description was recorded.
              </p>
            </>
          )}
        </Section>

        <Section n={2} title="Dispensing Defect">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Signature</dt>
            <dd>{report.defect.signature.length > 0 ? report.defect.signature.join(", ").replaceAll("_", " ") : "not classified"}</dd>
            <dt className="text-muted-foreground">Deviation</dt>
            <dd>{report.defect.magnitude}</dd>
            <dt className="text-muted-foreground">Confidence</dt>
            <dd>
              <Stars n={report.defect.stars} /> ({report.defect.stars}/5)
              {report.tier && <> &middot; ranking tier {report.tier}</>}
            </dd>
            <dt className="text-muted-foreground">Photo quality</dt>
            <dd>
              {report.quality.ok === null
                ? "no photo analysed"
                : report.quality.ok
                  ? "measured reliably"
                  : (report.quality.reason ?? "could not measure reliably")}
            </dd>
          </dl>
        </Section>

        <Section n={3} title="AI Analysis">
          {report.explanation ? (
            <p className="whitespace-pre-wrap">{report.explanation}</p>
          ) : (
            <p className="text-muted-foreground">
              No written explanation was generated for this case.
            </p>
          )}
          {report.disagreement_note && (
            <p className="mt-2 text-muted-foreground">{report.disagreement_note}</p>
          )}
          {/* The learning database, stated as history rather than as a
              finding — it is counted from past cases and never entered the
              ranking below. */}
          {report.precedents?.sentence && (
            <div className="mt-2 rounded border bg-muted/40 p-2">
              <p className="font-medium">{report.precedents.sentence}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{report.precedents.note}</p>
            </div>
          )}
        </Section>

        <Section n={4} title="Possible Causes & Confidence Score">
          <ol className="space-y-2">
            {report.causes.map((cause, i) => (
              <li key={cause.cause_id} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={i === 0 ? "font-semibold" : ""}>
                    {i + 1}. {cause.label}
                  </span>
                  <span className="shrink-0 font-mono font-semibold">
                    {Math.round(cause.likelihood * 100)}%
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted print:border">
                  <div
                    className="h-full rounded-full bg-foreground/70"
                    style={{ width: `${Math.round(cause.likelihood * 100)}%` }}
                  />
                </div>
                {cause.evidence.length > 0 && (
                  <ul className="mt-1 ml-4 list-disc text-[13px] text-muted-foreground">
                    {cause.evidence.slice(0, 3).map((e, j) => (
                      <li key={j}>
                        {e.detail} <span className="italic">[{e.source}]</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {top && (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Percentages are this case&apos;s likelihoods after its own evidence was applied —
              not how often these causes occur in general.
            </p>
          )}
        </Section>

        <Section n={5} title="Recommended Troubleshooting Actions">
          {report.recommended_actions.length === 0 ? (
            <p className="text-muted-foreground">
              Every suggested check for the leading causes has already been logged on this case.
            </p>
          ) : (
            <>
              <ol className="space-y-1">
                {report.recommended_actions.slice(0, 6).map((action) => (
                  <li key={`${action.cause_id}-${action.check_name}`} className="flex gap-2">
                    <span className="shrink-0 text-muted-foreground">Step {action.step}:</span>
                    <span>
                      {action.check_name}
                      <span className="text-muted-foreground">
                        {" "}— {action.help}{" "}
                        <em>({action.is_change ? "changes something" : "look only"})</em>
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Look-only checks cost nothing. A case can only close CONFIRMED if exactly one
                thing was changed, so work down the observations first.
              </p>
            </>
          )}
        </Section>

        <Section n={6} title="Checks Already Performed">
          {report.check_log.length === 0 ? (
            <p className="text-muted-foreground">No checks were logged on this case.</p>
          ) : (
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">#</th>
                  <th className="py-1 pr-2 font-medium">Check</th>
                  <th className="py-1 pr-2 font-medium">Kind</th>
                  <th className="py-1 pr-2 font-medium">Outcome</th>
                  <th className="py-1 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {report.check_log.map((row) => (
                  <tr key={row.sequence} className="border-b align-top">
                    <td className="py-1 pr-2">{row.sequence}</td>
                    <td className="py-1 pr-2">{row.check_name}</td>
                    <td className="py-1 pr-2 text-muted-foreground">
                      {caseData.check_results.find((c) => c.sequence === row.sequence)?.is_change
                        ? "changed"
                        : "looked"}
                    </td>
                    <td className="py-1 pr-2">{row.outcome?.replaceAll("_", " ") ?? "—"}</td>
                    <td className="py-1 whitespace-pre-wrap text-muted-foreground">
                      {row.result_detail ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[13px] text-muted-foreground">
            {report.action_count} change{report.action_count === 1 ? "" : "s"} on this case
            {report.close_tier && <> &middot; closed as {report.close_tier}</>}
            {report.close_tier === "CONFIRMED"
              ? " — cause confirmed, one change, re-measured in spec and held."
              : report.close_tier
                ? " — this records what was proved, not that it is fixed."
                : ""}
          </p>
        </Section>

        <Section n={7} title="Engineer Notes">
          {report.engineer_notes ? (
            <p className="whitespace-pre-wrap">{report.engineer_notes}</p>
          ) : (
            <>
              <p className="text-muted-foreground print:hidden">
                No notes yet — add them on the case page.
              </p>
              {/* Ruled space rather than "none": a printed report is often
                  finished by hand on the floor. */}
              <div className="hidden print:block">
                <div className="h-6 border-b border-dotted" />
                <div className="h-6 border-b border-dotted" />
                <div className="h-6 border-b border-dotted" />
              </div>
            </>
          )}
        </Section>

        <footer className="break-inside-avoid border-t pt-3 text-[13px] text-muted-foreground">
          <p>{report.disclaimer}</p>
          <p className="mt-1">
            Generated {new Date().toLocaleString()} &middot; Case #{report.case_id} &middot;
            Rules {report.rules_version}
          </p>
        </footer>
      </article>
    </div>
  );
}
