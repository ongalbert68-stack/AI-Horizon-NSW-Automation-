"use client";

import { Compass, ListTree, Wrench } from "lucide-react";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { TierInfo } from "@/components/tier-info";
import { ApiError } from "@/lib/api/client";
import { createCheckResult, getCase } from "@/lib/api/cases";
import { listMaterials } from "@/lib/api/materials";
import { listProfiles } from "@/lib/api/profiles";
import { listStations } from "@/lib/api/stations";
import type {
  Case, CheckOutcome, DispenseProfile, DispenseStation, FluidMaterial,
} from "@/lib/api/types";
import { ProfileGeometryPattern } from "@/components/profile-geometry-pattern";

function yesNo(value: boolean) {
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

  const [caseData, setCaseData] = React.useState<Case | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const reload = React.useCallback(() => {
    getCase(caseId)
      .then(setCaseData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Could not reach the API."),
      );
  }, [caseId]);

  React.useEffect(reload, [reload]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-6 py-10">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
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
          <Badge variant={caseData.resolved ? "default" : "secondary"}>
            {caseData.resolved ? "resolved" : "open"}
          </Badge>
          <TierInfo />
          {/* Gated on !caseData.resolved — the same field the status badge
              above reads — rather than !caseData.closed_at, which can drift
              out of sync with `resolved` and wrongly hide this link. */}
          {!caseData.resolved && (
            <Link
              href={`/troubleshoot/${caseData.case_id}`}
              className={buttonVariants({ size: "sm", className: "gap-1.5" })}
            >
              <Wrench className="size-3.5" />
              {caseData.ranking || caseData.fingerprint ? "Continue troubleshooting" : "Start troubleshooting"}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Station</CardTitle>
            <BrowseStationsDialog />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Name" value={caseData.station.name} />
            <Field label="Line" value={caseData.station.line} />
            <Field label="Dispenser class" value={caseData.station.dispenser_class.replaceAll("_", "-")} />
            <Field label="Valve model" value={caseData.station.valve_model ?? "—"} />
            <Field label="Heated reservoir" value={yesNo(caseData.station.heated_reservoir)} />
            <Field label="Camera available" value={yesNo(caseData.station.camera_available)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Material</CardTitle>
            <BrowseMaterialsDialog />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Name" value={caseData.profile.material.name} />
            <Field label="Family" value={caseData.profile.material.family.replaceAll("_", " ")} />
            <Field label="Part number" value={caseData.profile.material.part_number ?? "—"} />
            <Field label="Lot" value={caseData.material_lot ?? "—"} />
            <Field
              label="Two-part / thixotropic"
              value={`${yesNo(caseData.profile.material.two_part)} / ${yesNo(caseData.profile.material.thixotropic)}`}
            />
            <Field
              label="Pot life"
              value={caseData.profile.material.pot_life_hours != null ? `${caseData.profile.material.pot_life_hours} h` : "—"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Profile</CardTitle>
            <BrowseProfilesDialog />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Name" value={caseData.profile.name} />
            <Field label="Needle gauge" value={caseData.profile.needle_gauge ?? "—"} />
            <Field
              label="Set pressure / time"
              value={`${caseData.profile.set_pressure_kpa ?? "—"} kPa / ${caseData.profile.set_time_ms ?? "—"} ms`}
            />
            <Field label="Spec" value={caseData.profile.spec_metric && caseData.profile.spec_limit ? `${caseData.profile.spec_metric} ${caseData.profile.spec_limit}` : "—"} />
            <Field label="Rules version" value={caseData.rules_version} />
            <Field
              label="Closed"
              value={caseData.closed_at ? new Date(caseData.closed_at).toLocaleString() : "open"}
            />

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
                <a
                  href={`/profiles/${caseData.profile.profile_id}?caseId=${caseData.case_id}`}
                  className="inline-flex items-center justify-center w-full gap-1.5 rounded-md text-xs font-medium h-8 px-3 bg-sky-600 text-white shadow-sm hover:bg-sky-700"
                >
                  <Compass className="size-3.5" />
                  Check Out Geometry Showcase &rarr;
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {caseData.complaint_text && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Complaint, in their words</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {caseData.complaint_text}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Troubleshooting loop</CardTitle>
          <LogCheckDialog
            caseId={caseId}
            nextSequence={caseData.check_results.length + 1}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onLogged={() => {
              setDialogOpen(false);
              reload();
            }}
          />
        </CardHeader>
        <CardContent>
          {caseData.check_results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No checks logged yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Check</TableHead>
                  <TableHead>Cause</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {caseData.check_results.map((check) => (
                  <TableRow key={check.check_result_id}>
                    <TableCell>{check.sequence}</TableCell>
                    <TableCell>{check.check_name}</TableCell>
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

      {caseData.engineer_notes && (
        <>
          <Separator />
          <div>
            <h2 className="mb-1 text-sm font-medium">Engineer notes</h2>
            <p className="text-sm text-muted-foreground">{caseData.engineer_notes}</p>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}

/**
 * Read-only "browse all" affordance for Station/Material/Profile, so the
 * operator can cross-reference this case's assignment against the full
 * list without it becoming an edit-in-place — the case's station_id /
 * profile_id stay fixed here. Reuses the Select pattern and
 * listStations/listMaterials/listProfiles calls from app/cases/new/page.tsx
 * (the only other place a full list is fetched); a plain Select is used as
 * a searchable, scrollable list rather than a bound form control — nothing
 * is submitted on selection.
 */
function BrowseListDialog<T>({
  trigger,
  title,
  description,
  load,
  itemKey,
  itemLabel,
  itemSublabel,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  load: () => Promise<{ items: T[] }>;
  itemKey: (item: T) => number;
  itemLabel: (item: T) => string;
  itemSublabel?: (item: T) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<T[] | null>(null);
  const [selected, setSelected] = React.useState<string>("");

  React.useEffect(() => {
    if (!open || items !== null) return;
    load()
      .then((page) => setItems(page.items))
      .catch(() => toast.error("Could not load the full list."));
  }, [open, items, load]);

  const activeItem = items?.find((item) => String(itemKey(item)) === selected) ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {items === null ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select value={selected} onValueChange={(v) => setSelected(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Search ${items.length} record(s)…`} />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={itemKey(item)} value={String(itemKey(item))}>
                    {itemLabel(item)}
                    {itemSublabel ? ` · ${itemSublabel(item)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {activeItem && (
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
              {JSON.stringify(activeItem, null, 2)}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BrowseStationsDialog() {
  return (
    <BrowseListDialog<DispenseStation>
      trigger={
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
          <ListTree className="size-3.5" /> Browse all
        </Button>
      }
      title="All dispense stations"
      description="Cross-reference only — this case's assigned station is unchanged by browsing here."
      load={() => listStations({ limit: 200 })}
      itemKey={(s) => s.station_id}
      itemLabel={(s) => s.name}
      itemSublabel={(s) => s.line}
    />
  );
}

function BrowseMaterialsDialog() {
  return (
    <BrowseListDialog<FluidMaterial>
      trigger={
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
          <ListTree className="size-3.5" /> Browse all
        </Button>
      }
      title="All fluid materials"
      description="Cross-reference only — this case's material lot is unchanged by browsing here."
      load={() => listMaterials({ limit: 200 })}
      itemKey={(m) => m.material_id}
      itemLabel={(m) => m.name}
      itemSublabel={(m) => m.family.replaceAll("_", " ")}
    />
  );
}

function BrowseProfilesDialog() {
  return (
    <BrowseListDialog<DispenseProfile>
      trigger={
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
          <ListTree className="size-3.5" /> Browse all
        </Button>
      }
      title="All dispense profiles"
      description="Cross-reference only — this case's assigned profile is unchanged by browsing here."
      load={() => listProfiles({ limit: 200 })}
      itemKey={(p) => p.profile_id}
      itemLabel={(p) => p.name}
      itemSublabel={(p) => p.material.name}
    />
  );
}

function LogCheckDialog({
  caseId,
  nextSequence,
  open,
  onOpenChange,
  onLogged,
}: {
  caseId: number;
  nextSequence: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
}) {
  const [checkName, setCheckName] = React.useState("");
  const [causeId, setCauseId] = React.useState("");
  const [outcome, setOutcome] = React.useState<CheckOutcome | "">("");
  const [resultDetail, setResultDetail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!checkName) {
      toast.error("Name the check.");
      return;
    }
    setSubmitting(true);
    try {
      await createCheckResult(caseId, {
        sequence: nextSequence,
        check_name: checkName,
        cause_id: causeId || null,
        cost_minutes: null,
        invasive: false,
        safety_note: null,
        // This quick-log dialog predates is_change (added for the ported
        // troubleshoot wizard's action_count fix); it doesn't surface a
        // look-vs-change toggle, so it conservatively logs as "observed
        // only" rather than guessing. Use the wizard for a check that
        // should count toward action_count.
        is_change: false,
        outcome: outcome || null,
        result_detail: resultDetail || null,
        performed_at: new Date().toISOString(),
      });
      setCheckName("");
      setCauseId("");
      setOutcome("");
      setResultDetail("");
      onLogged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not log the check.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>Log a check</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Log troubleshooting-loop check #{nextSequence}</DialogTitle>
            <DialogDescription>
              One row per check performed. Causes re-rank once this is recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="check_name">Check</Label>
              <Input
                id="check_name"
                value={checkName}
                onChange={(e) => setCheckName(e.target.value)}
                placeholder="purge and re-prime"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cause_id">Candidate cause</Label>
              <Input
                id="cause_id"
                value={causeId}
                onChange={(e) => setCauseId(e.target.value)}
                placeholder="air_in_fluid_path"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="outcome">Outcome</Label>
              <Select
                value={outcome}
                onValueChange={(v) => setOutcome((v as CheckOutcome | null) ?? "")}
              >
                <SelectTrigger id="outcome" className="w-full">
                  <SelectValue placeholder="Select an outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirms">Confirms</SelectItem>
                  <SelectItem value="rules_out">Rules out</SelectItem>
                  <SelectItem value="inconclusive">Inconclusive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="result_detail">Detail</Label>
              <Textarea
                id="result_detail"
                value={resultDetail}
                onChange={(e) => setResultDetail(e.target.value)}
                placeholder="air slug expelled"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Logging…" : "Log check"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
