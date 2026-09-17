"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ApiError } from "@/lib/api/client";
import { createCheckResult, getCase } from "@/lib/api/cases";
import type { Case, CheckOutcome } from "@/lib/api/types";

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
        <div className="flex gap-2">
          {caseData.tier && <Badge>{caseData.tier}</Badge>}
          <Badge variant="outline">{caseData.diagnosed.replaceAll("_", " ")}</Badge>
          <Badge variant={caseData.resolved ? "default" : "secondary"}>
            {caseData.resolved ? "resolved" : "open"}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Links &amp; context</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Field label="Station" value={`${caseData.station.name} (${caseData.station.line})`} />
          <Field label="Profile" value={`${caseData.profile.name}`} />
          <Field label="Material lot" value={caseData.material_lot ?? "—"} />
          <Field label="Rules version" value={caseData.rules_version} />
          <Field
            label="Closed"
            value={caseData.closed_at ? new Date(caseData.closed_at).toLocaleString() : "open"}
          />
          <Field label="Action count" value={String(caseData.action_count)} />
        </CardContent>
      </Card>

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
