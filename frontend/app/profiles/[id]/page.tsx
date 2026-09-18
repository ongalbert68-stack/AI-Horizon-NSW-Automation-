"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Compass,
  Copy,
  Layers,
  Sparkles,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProfileGeometryPattern } from "@/components/profile-geometry-pattern";
import { ApiError } from "@/lib/api/client";
import { getProfile } from "@/lib/api/profiles";
import type { DispenseProfile } from "@/lib/api/types";

function yesNo(value?: boolean | null) {
  return value ? "Yes" : "No";
}

export default function ProfileShowcasePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const profileId = Number(params.id);
  const backCaseId = searchParams.get("caseId");

  const [profile, setProfile] = React.useState<DispenseProfile | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getProfile(profileId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load the profile.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  function handleCopyJson() {
    if (!profile?.geometry) return;
    navigator.clipboard.writeText(JSON.stringify(profile.geometry, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) {
    return (
      <div className="w-full px-4 py-8 md:px-8 lg:px-12">
        <Link
          href={backCaseId ? `/cases/${backCaseId}` : "/cases"}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "mb-6 gap-1.5" })}
        >
          <ArrowLeft className="size-4" />
          {backCaseId ? `Back to Case #${backCaseId}` : "Back to Cases"}
        </Link>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="w-full space-y-6 px-4 py-8 md:px-8 lg:px-12">
        <Skeleton className="h-9 w-1/4" />
        <Skeleton className="h-[480px] w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const rawPoints = profile.geometry?.profile ?? profile.geometry?.points ?? [];

  return (
    <div className="w-full space-y-6 px-4 py-6 md:px-8 lg:px-12">
      {/* Top back navigation and Actions */}
      <div className="flex items-center justify-between">
        <Link
          href={backCaseId ? `/cases/${backCaseId}` : "/cases"}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1.5" })}
        >
          <ArrowLeft className="size-4" />
          {backCaseId ? `Back to Case #${backCaseId}` : "Back to Cases"}
        </Link>

        {profile.geometry && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            className="gap-1.5 text-xs"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            {copied ? "Copied Geometry JSON" : "Export Geometry JSON"}
          </Button>
        )}
      </div>

      {/* Hero Showcase Title Bar */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Dispense Profile #{profile.profile_id}
            </span>
            <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Sparkles className="mr-1 size-3" /> Nominal Blueprint
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{profile.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Target material: <span className="font-medium text-foreground">{profile.material.name}</span> ({profile.material.family.replaceAll("_", " ")})
            {profile.material.part_number && ` · Part #${profile.material.part_number}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {profile.spec_metric && profile.spec_limit && (
            <Badge variant="secondary" className="px-3 py-1 font-mono text-xs">
              Spec: {profile.spec_metric} {profile.spec_limit}
            </Badge>
          )}
          {profile.geometry?.pattern && (
            <Badge className="px-3 py-1 font-mono text-xs uppercase">
              {profile.geometry.pattern}
            </Badge>
          )}
        </div>
      </div>

      {/* Interactive Full-Width Visualizer Canvas (Card container removed so black screen takes up full width) */}
      <div className="w-full">
        <ProfileGeometryPattern
          geometry={profile.geometry}
          specMetric={profile.spec_metric}
          specLimit={profile.spec_limit}
          canvasClassName="h-[540px] md:h-[600px] lg:h-[680px]"
        />
      </div>

      {/* Specifications & Coordinate Map Grid (Full Width 3 Columns on Large Screens) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Nominal Coordinate Table */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Compass className="size-4 text-primary" />
              Nominal Coordinates
            </CardTitle>
            <CardDescription>{rawPoints.length} target deposits defined</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {rawPoints.length > 0 ? (
              <div className="max-h-72 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Seq</TableHead>
                      <TableHead>Target X</TableHead>
                      <TableHead>Target Y</TableHead>
                      <TableHead>Radius (r)</TableHead>
                      <TableHead className="text-right">Pitch</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawPoints.map((pt, idx) => {
                      const x = pt.cx ?? pt.x ?? 0;
                      const y = pt.cy ?? pt.y ?? 0;
                      const r = pt.r ?? 0;
                      const nextPt = rawPoints[idx + 1];
                      const pitch = nextPt
                        ? Math.hypot((nextPt.cx ?? nextPt.x ?? 0) - x, (nextPt.cy ?? nextPt.y ?? 0) - y).toFixed(2)
                        : "—";

                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-mono font-medium">#{idx + 1}</TableCell>
                          <TableCell className="font-mono">{x.toFixed(2)}</TableCell>
                          <TableCell className="font-mono">{y.toFixed(2)}</TableCell>
                          <TableCell className="font-mono">{r.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {pitch !== "—" ? `${pitch}` : "End"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No coordinate points available.</p>
            )}
          </CardContent>
        </Card>

        {/* Machine & Tooling Settings */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="size-4 text-primary" />
              Machine & Tooling Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <SpecField label="Needle Gauge" value={profile.needle_gauge ?? "—"} />
            <SpecField
              label="Needle Inner Diameter"
              value={profile.needle_id_um ? `${profile.needle_id_um} µm` : "—"}
            />
            <SpecField
              label="Dispense Pressure"
              value={profile.set_pressure_kpa ? `${profile.set_pressure_kpa} kPa` : "—"}
            />
            <SpecField
              label="Shot Time"
              value={profile.set_time_ms ? `${profile.set_time_ms} ms` : "—"}
            />
            <SpecField
              label="Standoff Height"
              value={profile.standoff_um ? `${profile.standoff_um} µm` : "—"}
            />
            <SpecField
              label="Gantry Speed"
              value={profile.speed_mm_s ? `${profile.speed_mm_s} mm/s` : "—"}
            />
            <SpecField
              label="Heated Temperature"
              value={profile.set_temp_c != null ? `${profile.set_temp_c} °C` : "—"}
            />
            <SpecField
              label="Tolerance Metric"
              value={profile.spec_metric && profile.spec_limit ? `${profile.spec_metric} ${profile.spec_limit}` : "—"}
            />
          </CardContent>
        </Card>

        {/* Fluid Material Properties */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4 text-primary" />
              Fluid Material Specification
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <SpecField label="Material Name" value={profile.material.name} />
            <SpecField label="Chemical Family" value={profile.material.family.replaceAll("_", " ")} />
            <SpecField label="Part Number" value={profile.material.part_number ?? "—"} />
            <SpecField label="Two-Part Formulation" value={yesNo(profile.material.two_part)} />
            <SpecField label="Thixotropic Behavior" value={yesNo(profile.material.thixotropic)} />
            <SpecField label="Requires Thawing" value={yesNo(profile.material.requires_thaw)} />
            <SpecField
              label="Working Pot Life"
              value={profile.material.pot_life_hours ? `${profile.material.pot_life_hours} hours` : "—"}
            />
            <SpecField
              label="Max Out-Time"
              value={profile.material.out_time_hours ? `${profile.material.out_time_hours} hours` : "—"}
            />
            <SpecField
              label="Storage Temperature"
              value={profile.material.storage_temp_c != null ? `${profile.material.storage_temp_c} °C` : "—"}
            />
            <SpecField
              label="Max Particle Size"
              value={profile.material.filler_particle_um ? `${profile.material.filler_particle_um} µm` : "—"}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SpecField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
