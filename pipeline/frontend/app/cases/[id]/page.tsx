"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Compass, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ArtifactPanel, type Artifacts } from "@/components/wizard/artifact-panel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TierInfo } from "@/components/tier-info";
import { ApiError } from "@/lib/api/client";
import { getCase, updateCase } from "@/lib/api/cases";
import { getIntakeSpec } from "@/lib/api/intake";
import { getReport } from "@/lib/api/report";
import type { Case, CheckOutcome, VisionResult } from "@/lib/api/types";

function yesNo(value?: boolean | null) {
  return value ? "yes" : "no";
}

const OUTCOME_VARIANT: Record<CheckOutcome, "default" | "secondary" | "destructive"> = {
  confirms: "default",
  rules_out: "destructive",
  inconclusive: "secondary",
};

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const caseId = Number(params.id);

  const [artifacts, setArtifacts] = React.useState<Artifacts | null>(null);
  const [caseData, setCaseData] = React.useState<Case | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getCase(caseId)
      .then(async (c) => {
        if (cancelled) return;
        setCaseData(c);
        // The report is compiled on demand, not stored on the case — fetch
        // it too so a past case reads the same as a freshly-finished one.
        // No LLM explanation here: browsing a case shouldn't spend a call.
        const report = c.ranking ? await getReport(caseId, false).catch(() => null) : null;
        // The question spine, so the answers read in the words they were
        // asked in rather than as stored ids.
        const questions = await getIntakeSpec().catch(() => []);
        if (cancelled) return;
        setArtifacts({
          caseData: c,
          photoUrl: null,
          questions,
          axes: c.fingerprint?.axes ?? {},
          axisNotes: c.fingerprint?.axis_notes ?? {},
          vision: (c.vision_result as VisionResult | null) ?? null,
          coarse: null,
          // The report already carries the same tally, so it's reused
          // rather than re-fetched.
          precedents: report?.precedents ?? null,
          ranking: c.ranking,
          comparison: null,
          checks: c.check_results ?? [],
          report,
          close: c.tier ? { tier: c.tier, gaps: [] } : null,
        });
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not reach the API."));
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!caseData || !artifacts) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-10">
        <Skeleton className="h-9 w-1/3" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <Link
        href="/cases"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 gap-1.5" })}
      >
        <ArrowLeft className="size-4" />
        All Cases
      </Link>

      {/* Header bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Case #{caseData.case_id} &middot; {caseData.complaint ?? "unclassified"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Opened {new Date(caseData.opened_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {caseData.tier && <Badge>{caseData.tier}</Badge>}
          <Badge variant="outline">{caseData.diagnosed.replaceAll("_", " ")}</Badge>
          {/* Three different facts, so three different badges. "Closed"
              says the investigation was wrapped up; "resolved" says it was
              fixed and proved. A case can be closed and not resolved —
              case #8 is — and one badge covering both would have to lie
              about one of them. */}
          <Badge variant={caseData.closed_at ? "outline" : "secondary"}>
            {caseData.closed_at ? "closed" : "open"}
          </Badge>
          {caseData.resolved && <Badge>resolved</Badge>}
          <TierInfo />
          <Link
            href={`/cases/${caseData.case_id}/report`}
            className={buttonVariants({ size: "sm", variant: "outline", className: "ml-2 gap-1.5" })}
          >
            <FileText className="size-3.5" />
            Report
          </Link>
          <Link
            href={`/troubleshoot/${caseData.case_id}`}
            className={buttonVariants({
              size: "sm",
              variant: "default",
              className: "ml-2 gap-1.5 font-medium shadow-xs",
            })}
          >
            <Sparkles className="size-3.5" />
            {caseData.closed_at ? "Reopen Case" : "Start Troubleshooting"}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* Quick Launch Troubleshooting Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/25 bg-primary/5 p-4 shadow-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-xs font-medium text-primary">
              Interactive Diagnosis
            </Badge>
            {/* Was "Case resolved & closed" on anything with a closed_at,
                which claimed a fix on every PLAUSIBLE case — closed means
                the investigation ended, not that it worked. */}
            <span className="text-xs text-muted-foreground">
              {!caseData.closed_at
                ? "Step-by-step diagnostic assistant"
                : caseData.resolved
                  ? `Closed as ${caseData.tier} — fixed and proved`
                  : `Closed as ${caseData.tier ?? "unverified"} — not proved fixed`}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {caseData.closed_at
              ? "Reopen it to log another check — the case re-ranks and can be closed again."
              : "Ready to diagnose? Start the interview, ranking, and troubleshooting loop."}
          </p>
        </div>
        <Link
          href={`/troubleshoot/${caseData.case_id}`}
          className={buttonVariants({ size: "default", className: "gap-2 font-medium shadow" })}
        >
          <Sparkles className="size-4" />
          {caseData.closed_at ? "Reopen & Log Another Check" : "Start Troubleshooting Now"}
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <Tabs defaultValue="context" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="context">Links & Context</TabsTrigger>
          <TabsTrigger value="artifacts">Diagnostic Artifacts</TabsTrigger>
        </TabsList>

        <TabsContent value="context" className="space-y-6">
          {/* 3 Overview Cards: Station, Material, Profile */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Station Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Station</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Field label="Name" value={caseData.station.name} />
                <Field label="Line" value={caseData.station.line} />
                <Field
                  label="Dispenser class"
                  value={caseData.station.dispenser_class.replaceAll("_", "-")}
                />
                <Field label="Valve model" value={caseData.station.valve_model ?? "—"} />
                <Field label="Heated reservoir" value={yesNo(caseData.station.heated_reservoir)} />
                <Field label="Camera available" value={yesNo(caseData.station.camera_available)} />
              </CardContent>
            </Card>

            {/* Material Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Material</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Field label="Name" value={caseData.profile.material.name} />
                <Field
                  label="Family"
                  value={caseData.profile.material.family.replaceAll("_", " ")}
                />
                <Field label="Part number" value={caseData.profile.material.part_number ?? "—"} />
                <Field label="Lot" value={caseData.material_lot ?? "—"} />
                <Field
                  label="Two-part / thixotropic"
                  value={`${yesNo(caseData.profile.material.two_part)} / ${yesNo(caseData.profile.material.thixotropic)}`}
                />
                <Field
                  label="Pot life"
                  value={
                    caseData.profile.material.pot_life_hours != null
                      ? `${caseData.profile.material.pot_life_hours} h`
                      : "—"
                  }
                />
              </CardContent>
            </Card>

            {/* Profile Card with Parameters and Drawn-Out Pattern Geometry */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 text-sm">
                <Field label="Name" value={caseData.profile.name} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Needle gauge" value={caseData.profile.needle_gauge ?? "—"} />
                  <Field
                    label="Needle ID"
                    value={caseData.profile.needle_id_um ? `${caseData.profile.needle_id_um} µm` : "—"}
                  />
                </div>
                <Field
                  label="Set pressure / time"
                  value={`${caseData.profile.set_pressure_kpa ?? "—"} kPa / ${caseData.profile.set_time_ms ?? "—"} ms`}
                />
                <Field
                  label="Standoff / Speed"
                  value={`${caseData.profile.standoff_um ? `${caseData.profile.standoff_um} µm` : "—"} / ${caseData.profile.speed_mm_s ? `${caseData.profile.speed_mm_s} mm/s` : "—"}`}
                />
                <Field
                  label="Spec"
                  value={
                    caseData.profile.spec_metric && caseData.profile.spec_limit
                      ? `${caseData.profile.spec_metric} ${caseData.profile.spec_limit}`
                      : "—"
                  }
                />
                <Field label="Rules version" value={caseData.rules_version} />
                <Field
                  label="Closed"
                  value={caseData.closed_at ? new Date(caseData.closed_at).toLocaleString() : "open"}
                />

                {/* Profile Geometry Showcase Referral Button */}
                <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3.5 dark:border-sky-500/30 dark:bg-sky-500/10">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                        Dispense Pattern Geometry
                      </span>
                      {caseData.profile.geometry?.pattern && (
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {caseData.profile.geometry.pattern}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Full pattern showcase, nominal deposit targets, gantry coordinates, and substrate map.
                    </p>
                    <Link
                      href={`/profiles/${caseData.profile.profile_id}?caseId=${caseData.case_id}`}
                      className={buttonVariants({
                        size: "sm",
                        className: "w-full gap-1.5 bg-sky-600 text-white shadow-sm hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-700",
                      })}
                    >
                      <Compass className="size-3.5" />
                      Check Out Geometry Showcase &rarr;
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Operator description / complaint */}
          {caseData.complaint_text && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Complaint, in their words</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {caseData.complaint_text}
              </CardContent>
            </Card>
          )}

          {/* Troubleshooting loop check log */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Troubleshooting loop</CardTitle>
              {/* Changes and observations are counted separately: only
                  changes bear on whether this case could close CONFIRMED. */}
              <span className="text-xs text-muted-foreground">
                {caseData.action_count} change{caseData.action_count === 1 ? "" : "s"} &middot;{" "}
                {caseData.observation_count} looked
              </span>
            </CardHeader>
            <CardContent>
              {!caseData.check_results || caseData.check_results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No checks logged yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Check</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Cause</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {caseData.check_results.map((check) => (
                      <TableRow key={check.check_result_id}>
                        <TableCell>{check.sequence}</TableCell>
                        <TableCell className="font-medium">{check.check_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {check.is_change ? "changed" : "looked"}
                        </TableCell>
                        <TableCell>{check.cause_id ?? "—"}</TableCell>
                        <TableCell>
                          {check.outcome ? (
                            <Badge variant={OUTCOME_VARIANT[check.outcome]}>
                              {check.outcome.replaceAll("_", " ")}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {check.result_detail ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Engineer notes — the one field on the case a human writes in
              their own words. It was render-only until now, so the report
              had a section nothing could ever fill. */}
          <Separator />
          <EngineerNotes
            caseId={caseId}
            initial={caseData.engineer_notes}
            onSaved={(notes) =>
              setCaseData((prev) => (prev ? { ...prev, engineer_notes: notes } : prev))
            }
          />
        </TabsContent>

        <TabsContent value="artifacts">
          <div className="rounded-lg border bg-card p-4">
            <ArtifactPanel artifacts={artifacts} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** The engineer's own words on the case. Saved explicitly rather than on
 * blur or on a timer: this is the field a human is held to, and a note
 * that saves itself halfway through a sentence is worse than one that
 * waits to be told. */
function EngineerNotes({
  caseId, initial, onSaved,
}: {
  caseId: number;
  initial: string | null;
  onSaved: (notes: string | null) => void;
}) {
  const [value, setValue] = React.useState(initial ?? "");
  const [saving, setSaving] = React.useState(false);
  const dirty = value.trim() !== (initial ?? "").trim();

  async function save() {
    setSaving(true);
    try {
      const notes = value.trim() || null;
      await updateCase(caseId, { engineer_notes: notes });
      onSaved(notes);
      toast.success("Engineer notes saved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the notes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Engineer notes</h2>
        <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save notes"}
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Anything the next person on this machine should know — what you saw, what you ruled out, what you'd try next."
        className="min-h-24 text-sm"
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}
