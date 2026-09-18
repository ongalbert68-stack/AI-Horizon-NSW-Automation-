"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { createCase } from "@/lib/api/cases";
import { listProfiles } from "@/lib/api/profiles";
import { listStations } from "@/lib/api/stations";
import type { DispenseProfile, DispenseStation } from "@/lib/api/types";

const RULES_VERSION = "nsw-pack@3";

export default function NewCasePage() {
  const router = useRouter();

  const [stations, setStations] = React.useState<DispenseStation[]>([]);
  const [profiles, setProfiles] = React.useState<DispenseProfile[]>([]);
  const [loadingOptions, setLoadingOptions] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const [stationId, setStationId] = React.useState<string>("");
  const [profileId, setProfileId] = React.useState<string>("");
  const [materialLot, setMaterialLot] = React.useState("");
  const [complaint, setComplaint] = React.useState("");
  const [complaintText, setComplaintText] = React.useState("");

  React.useEffect(() => {
    Promise.all([listStations({ limit: 200 }), listProfiles({ limit: 200 })])
      .then(([stationPage, profilePage]) => {
        setStations(stationPage.items);
        setProfiles(profilePage.items);
      })
      .catch(() => toast.error("Could not load stations/profiles from the API."))
      .finally(() => setLoadingOptions(false));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stationId || !profileId) {
      toast.error("Pick a station and a profile.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createCase({
        station_id: Number(stationId),
        profile_id: Number(profileId),
        rules_version: RULES_VERSION,
        opened_at: new Date().toISOString(),
        closed_at: null,
        material_lot: materialLot || null,
        complaint: complaint || null,
        complaint_text: complaintText || null,
        fingerprint: null,
        vision_result: null,
        ranking: null,
        rank_tier: null,
        llm_map_used: false,
        llm_critic_used: false,
        llm_explain_used: false,
        diagnosis: null,
        verification: null,
        resolved: false,
        diagnosed: "never_tested",
        tier: null,
        escalate: false,
        engineer_notes: null,
      });
      toast.success(`Case #${created.case_id} opened.`);
      router.push(`/troubleshoot/${created.case_id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not open the case.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Troubleshoot a case</CardTitle>
            <CardDescription>
              Open an investigation. This is the intake — links and context only; the
              interview questions and evidence come once the case is open.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="station">Dispense station</Label>
              <Select
                value={stationId}
                onValueChange={(value) => setStationId(value ?? "")}
                disabled={loadingOptions}
              >
                <SelectTrigger id="station" className="w-full">
                  <SelectValue placeholder="Select the machine" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((station) => (
                    <SelectItem key={station.station_id} value={String(station.station_id)}>
                      {station.name} &middot; {station.line}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile">Dispense profile</Label>
              <Select
                value={profileId}
                onValueChange={(value) => setProfileId(value ?? "")}
                disabled={loadingOptions}
              >
                <SelectTrigger id="profile" className="w-full">
                  <SelectValue placeholder="Select the job" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.profile_id} value={String(profile.profile_id)}>
                      {profile.name} &middot; {profile.material.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="material_lot">Material lot</Label>
              <Input
                id="material_lot"
                value={materialLot}
                onChange={(e) => setMaterialLot(e.target.value)}
                placeholder="LOT-882"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="complaint">Complaint</Label>
              <Input
                id="complaint"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                placeholder="Inconsistent size shot to shot"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="complaint_text">Description</Label>
              <Textarea
                id="complaint_text"
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                placeholder="What the operator actually said, in their words"
                rows={4}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push("/")}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loadingOptions}>
              {submitting ? "Opening…" : "Open case"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
