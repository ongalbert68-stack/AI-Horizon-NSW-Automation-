"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Compass, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { listProfiles } from "@/lib/api/profiles";
import type { DispenseProfile } from "@/lib/api/types";

export default function ProfilesIndexPage() {
  const [profiles, setProfiles] = React.useState<DispenseProfile[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    listProfiles({ limit: 100 })
      .then((p) => setProfiles(p.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load profiles."));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dispense Profiles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nominal process specifications, tooling geometries, and substrate deposition patterns.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!profiles && !error && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      )}

      {profiles && profiles.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No profiles registered yet.
        </div>
      )}

      {profiles && profiles.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((profile) => {
            const pointCount =
              profile.geometry?.profile?.length ?? profile.geometry?.points?.length ?? 0;

            return (
              <Card key={profile.profile_id} className="flex flex-col justify-between transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{profile.name}</CardTitle>
                      <CardDescription>
                        {profile.material.name} &middot; {profile.material.family.replaceAll("_", " ")}
                      </CardDescription>
                    </div>
                    {profile.geometry?.pattern && (
                      <Badge variant="outline" className="font-mono text-xs uppercase">
                        {profile.geometry.pattern}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Needle: <span className="font-medium text-foreground">{profile.needle_gauge ?? "—"}</span></div>
                    <div>Pressure: <span className="font-medium text-foreground">{profile.set_pressure_kpa ? `${profile.set_pressure_kpa} kPa` : "—"}</span></div>
                    <div>Standoff: <span className="font-medium text-foreground">{profile.standoff_um ? `${profile.standoff_um} µm` : "—"}</span></div>
                    <div>Pattern: <span className="font-medium text-foreground">{pointCount > 0 ? `${pointCount} deposits` : "—"}</span></div>
                  </div>

                  <Link
                    href={`/profiles/${profile.profile_id}`}
                    className={buttonVariants({ size: "sm", className: "w-full gap-2" })}
                  >
                    <Compass className="size-4" />
                    Inspect Pattern Geometry
                    <ArrowRight className="size-3.5" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
