"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Cpu,
  Database,
  Droplets,
  ExternalLink,
  Eye,
  FilePlus2,
  FlaskConical,
  Gauge,
  History,
  Info,
  Layers,
  Plus,
  Search,
  Sliders,
  Sparkles,
  Thermometer,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ProfileGeometryPattern } from "@/components/profile-geometry-pattern";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { openCase } from "@/lib/api/cases";
import { createMaterial, listMaterials } from "@/lib/api/materials";
import { createProfile, listProfiles } from "@/lib/api/profiles";
import { createStation, listStations } from "@/lib/api/stations";
import type {
  DispenserClass,
  DispenseProfile,
  DispenseProfileCreate,
  DispenseStation,
  DispenseStationCreate,
  FluidMaterial,
  FluidMaterialCreate,
  MaterialFamily,
} from "@/lib/api/types";

const COMPLAINT_PRESETS = [
  "Inconsistent size shot to shot",
  "Bridging / shorting between pads",
  "Missing or starved deposit",
  "Tail / stringing on pull-off",
  "Satellite / splashing droplets",
  "Deposit height drift",
];

const DISPENSER_CLASSES: { value: DispenserClass; label: string }[] = [
  { value: "pressure_time", label: "Pressure-Time (Syringe)" },
  { value: "auger", label: "Auger Screw Valve" },
  { value: "piston", label: "Positive Displacement Piston" },
  { value: "jetting", label: "High-Speed Jetting Valve" },
];

const MATERIAL_FAMILIES: { value: MaterialFamily; label: string }[] = [
  { value: "epoxy", label: "Epoxy" },
  { value: "solder_paste", label: "Solder Paste" },
  { value: "silicone", label: "Silicone" },
  { value: "uv_cure", label: "UV-Cure Acrylic" },
  { value: "cyanoacrylate", label: "Cyanoacrylate" },
];

const DRAFT_STORAGE_KEY = "aihorizon_troubleshoot_draft";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

function yesNo(val?: boolean | null) {
  return val ? "Yes" : "No";
}

export default function OpenCasePage() {
  const router = useRouter();

  const [stations, setStations] = React.useState<DispenseStation[]>([]);
  const [profiles, setProfiles] = React.useState<DispenseProfile[]>([]);
  const [materials, setMaterials] = React.useState<FluidMaterial[]>([]);
  const [loadingOptions, setLoadingOptions] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  // Form selections
  const [stationId, setStationId] = React.useState("");
  const [materialId, setMaterialId] = React.useState("");
  const [profileId, setProfileId] = React.useState("");
  const [materialLot, setMaterialLot] = React.useState("");
  const [complaint, setComplaint] = React.useState("");
  const [complaintText, setComplaintText] = React.useState("");

  // Top quick browser filter & search
  const [topSearch, setTopSearch] = React.useState("");
  const [topFilterTab, setTopFilterTab] = React.useState<"all" | "materials" | "stations" | "profiles">("all");

  // Inspector Modal State
  const [inspectItem, setInspectItem] = React.useState<{
    type: "station" | "material" | "profile";
    station?: DispenseStation;
    material?: FluidMaterial;
    profile?: DispenseProfile;
  } | null>(null);

  // Inline Creation Modal State
  const [createModal, setCreateModal] = React.useState<"station" | "material" | "profile" | null>(null);
  const [savingItem, setSavingItem] = React.useState(false);

  // Creation forms
  const [newStation, setNewStation] = React.useState<DispenseStationCreate>({
    name: "",
    line: "Line 1",
    dispenser_class: "pressure_time",
    valve_model: "",
    heated_reservoir: false,
    camera_available: true,
    reports_dispense_order: true,
  });

  const [newMaterial, setNewMaterial] = React.useState<FluidMaterialCreate>({
    name: "",
    part_number: "",
    family: "epoxy",
    two_part: false,
    thixotropic: false,
    requires_thaw: false,
    pot_life_hours: null,
    out_time_hours: null,
    storage_temp_c: null,
    filler_particle_um: null,
  });

  const [newProfile, setNewProfile] = React.useState<DispenseProfileCreate>({
    name: "",
    material_id: 0,
    needle_gauge: "27G",
    needle_id_um: 200,
    set_pressure_kpa: 120,
    set_time_ms: 100,
    standoff_um: 150,
    speed_mm_s: 25,
    set_temp_c: null,
    spec_metric: "dot_diameter_um",
    spec_limit: "500±50",
  });

  // Helper to refresh all catalog items
  const refreshCatalogData = React.useCallback(async () => {
    try {
      const [s, p, m] = await Promise.all([
        listStations({ limit: 200 }),
        listProfiles({ limit: 200 }),
        listMaterials({ limit: 200 }),
      ]);
      setStations(s.items);
      setProfiles(p.items);
      setMaterials(m.items);
      return { stations: s.items, profiles: p.items, materials: m.items };
    } catch {
      toast.error("Could not reach the API. Is the backend running?");
      return null;
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    refreshCatalogData().finally(() => setLoadingOptions(false));
  }, [refreshCatalogData]);

  // Restore draft from sessionStorage and handle URL select params on mount
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.stationId) setStationId(draft.stationId);
        if (draft.materialId) setMaterialId(draft.materialId);
        if (draft.profileId) setProfileId(draft.profileId);
        if (draft.materialLot) setMaterialLot(draft.materialLot);
        if (draft.complaint) setComplaint(draft.complaint);
        if (draft.complaintText) setComplaintText(draft.complaintText);
      }
    } catch {
      // ignore
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const selectType = params.get("selectType");
      const selectId = params.get("selectId");
      if (selectType === "station" && selectId) setStationId(selectId);
      if (selectType === "material" && selectId) setMaterialId(selectId);
      if (selectType === "profile" && selectId) setProfileId(selectId);
    }
  }, []);

  // Save draft whenever state changes
  React.useEffect(() => {
    try {
      const draft = {
        stationId,
        materialId,
        profileId,
        materialLot,
        complaint,
        complaintText,
      };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [stationId, materialId, profileId, materialLot, complaint, complaintText]);

  // Close modals on Escape key
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setInspectItem(null);
        setCreateModal(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter profiles based on selected material if one is chosen
  const filteredProfiles = React.useMemo(() => {
    if (!materialId) return profiles;
    return profiles.filter((p) => String(p.material_id) === materialId);
  }, [profiles, materialId]);

  // Selected object lookups
  const selectedStation = stations.find((s) => String(s.station_id) === stationId);
  const selectedMaterial = materials.find((m) => String(m.material_id) === materialId);
  const selectedProfile = profiles.find((p) => String(p.profile_id) === profileId);

  // When material changes: check if selected profile still matches
  function handleMaterialChange(matId: string | null) {
    const id = matId ?? "";
    setMaterialId(id);
    const matching = profiles.filter((p) => String(p.material_id) === id);
    if (matching.length > 0) {
      if (!matching.some((p) => String(p.profile_id) === profileId)) {
        setProfileId(String(matching[0].profile_id));
      }
    } else {
      setProfileId("");
    }
  }

  // When profile changes: auto-sync material
  function handleProfileChange(profId: string | null) {
    const id = profId ?? "";
    setProfileId(id);
    const p = profiles.find((item) => String(item.profile_id) === id);
    if (p) {
      setMaterialId(String(p.material_id));
    }
  }

  // Inline Creation Submits
  async function handleCreateStationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newStation.name.trim() || !newStation.line.trim()) {
      toast.error("Station name and line are required.");
      return;
    }
    setSavingItem(true);
    try {
      const created = await createStation(newStation);
      toast.success(`Created station "${created.name}" and selected for case!`);
      await refreshCatalogData();
      setStationId(String(created.station_id));
      setCreateModal(null);
      setNewStation({
        name: "",
        line: "Line 1",
        dispenser_class: "pressure_time",
        valve_model: "",
        heated_reservoir: false,
        camera_available: true,
        reports_dispense_order: true,
      });
    } catch {
      toast.error("Failed to create station.");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleCreateMaterialSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newMaterial.name.trim()) {
      toast.error("Material name is required.");
      return;
    }
    setSavingItem(true);
    try {
      const created = await createMaterial(newMaterial);
      toast.success(`Created material "${created.name}" and selected for case!`);
      await refreshCatalogData();
      handleMaterialChange(String(created.material_id));
      setCreateModal(null);
      setNewMaterial({
        name: "",
        part_number: "",
        family: "epoxy",
        two_part: false,
        thixotropic: false,
        requires_thaw: false,
        pot_life_hours: null,
        out_time_hours: null,
        storage_temp_c: null,
        filler_particle_um: null,
      });
    } catch {
      toast.error("Failed to create material.");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleCreateProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newProfile.name.trim() || !newProfile.material_id) {
      toast.error("Profile name and associated material are required.");
      return;
    }
    setSavingItem(true);
    try {
      const created = await createProfile(newProfile);
      toast.success(`Created profile "${created.name}" and selected for case!`);
      await refreshCatalogData();
      handleProfileChange(String(created.profile_id));
      setCreateModal(null);
      setNewProfile({
        name: "",
        material_id: 0,
        needle_gauge: "27G",
        needle_id_um: 200,
        set_pressure_kpa: 120,
        set_time_ms: 100,
        standoff_um: 150,
        speed_mm_s: 25,
        set_temp_c: null,
        spec_metric: "dot_diameter_um",
        spec_limit: "500±50",
      });
    } catch {
      toast.error("Failed to create profile.");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stationId) {
      toast.error("Please pick a dispense station.");
      return;
    }
    if (!profileId) {
      toast.error("Please pick a dispense profile.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await openCase({
        station_id: Number(stationId),
        profile_id: Number(profileId),
        material_lot: materialLot || null,
        complaint: complaint || null,
        complaint_text: complaintText || null,
      });
      // Clear draft on successful case creation
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      toast.success(`Case #${created.case_id} opened! Starting troubleshooting...`);
      router.push(`/troubleshoot/${created.case_id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not open the case.");
    } finally {
      setSubmitting(false);
    }
  }

  // Candidate items calculation for top browser
  const candidateItems = React.useMemo(() => {
    const q = topSearch.toLowerCase().trim();
    const result: Array<
      | { kind: "material"; item: FluidMaterial; searchStr: string }
      | { kind: "station"; item: DispenseStation; searchStr: string }
      | { kind: "profile"; item: DispenseProfile; searchStr: string }
    > = [];

    if (topFilterTab === "all" || topFilterTab === "materials") {
      for (const m of materials) {
        const searchStr = `${m.name} ${m.part_number ?? ""} ${m.family} ${m.two_part ? "2-part" : ""}`.toLowerCase();
        if (!q || searchStr.includes(q)) {
          result.push({ kind: "material", item: m, searchStr });
        }
      }
    }

    if (topFilterTab === "all" || topFilterTab === "stations") {
      for (const s of stations) {
        const searchStr = `${s.name} ${s.line} ${s.dispenser_class} ${s.valve_model ?? ""}`.toLowerCase();
        if (!q || searchStr.includes(q)) {
          result.push({ kind: "station", item: s, searchStr });
        }
      }
    }

    if (topFilterTab === "all" || topFilterTab === "profiles") {
      for (const p of profiles) {
        const searchStr = `${p.name} ${p.needle_gauge ?? ""} ${p.material.name} ${p.geometry?.pattern ?? ""}`.toLowerCase();
        if (!q || searchStr.includes(q)) {
          result.push({ kind: "profile", item: p, searchStr });
        }
      }
    }

    return result;
  }, [materials, stations, profiles, topSearch, topFilterTab]);

  return (
    <div className="mx-auto w-full max-w-[1520px] space-y-6 px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "gap-1.5 text-muted-foreground hover:text-foreground",
            })}
          >
            <ArrowLeft className="size-4" />
            <span>Home</span>
          </Link>
          <span className="text-muted-foreground/30">/</span>
          <Link
            href="/cases"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Past Cases
          </Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="text-xs font-semibold text-foreground">
            Start Troubleshooting
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/catalog"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10",
            })}
          >
            <Database className="size-3.5" />
            <span>Equipment & Material Catalog</span>
          </Link>
          <Link
            href="/profiles"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "gap-1.5 text-xs text-muted-foreground hover:text-foreground",
            })}
          >
            <Compass className="size-3.5" />
            <span>Profile Blueprints</span>
          </Link>
          <Link
            href="/cases"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground",
            })}
          >
            <History className="size-3.5" />
            <span>Past Cases</span>
          </Link>
        </div>
      </div>

      {/* Hero Title with Wide Subtitle */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-xs font-semibold text-primary">
              Step 1 · Intake
            </Badge>
            <span className="text-xs text-muted-foreground">Setup dispense links & line parameters</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl text-foreground">
            Open Case & Start Troubleshooting
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Select the hardware station, fluid material, and dispense profile. You can search, browse, inspect, and add candidate items directly using the top browser or the dedicated catalog.
          </p>
        </div>
      </div>

      {/* TOP QUICK SEARCH & BROWSE BAR */}
      <Card className="border-primary/25 bg-gradient-to-r from-card to-muted/20 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="size-4 text-primary" />
                <span>Browse Available Options & Specs</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Inspect technical details of any candidate item to confirm suitability and select for intake.
              </CardDescription>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => setCreateModal("station")}
              >
                <Plus className="size-3.5 text-primary" />
                <span>New Station</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => setCreateModal("material")}
              >
                <Plus className="size-3.5 text-primary" />
                <span>New Material</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => {
                  if (materials.length > 0) {
                    setNewProfile((prev) => ({ ...prev, material_id: materials[0].material_id }));
                  }
                  setCreateModal("profile");
                }}
              >
                <Plus className="size-3.5 text-primary" />
                <span>New Profile</span>
              </Button>
              <Link
                href="/catalog"
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "h-8 gap-1 text-xs text-muted-foreground hover:text-foreground",
                })}
              >
                <span>Full Catalog</span>
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Search bar and category filter tabs */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search material name, part #, station line, valve, or profile pattern..."
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                className="h-9 pl-9 text-sm bg-background"
              />
              {topSearch && (
                <button
                  type="button"
                  onClick={() => setTopSearch("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 md:pb-0">
              <Button
                type="button"
                size="sm"
                variant={topFilterTab === "all" ? "default" : "outline"}
                className="h-8 text-xs px-2.5"
                onClick={() => setTopFilterTab("all")}
              >
                All ({materials.length + stations.length + profiles.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={topFilterTab === "materials" ? "default" : "outline"}
                className="h-8 text-xs px-2.5"
                onClick={() => setTopFilterTab("materials")}
              >
                Materials ({materials.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={topFilterTab === "stations" ? "default" : "outline"}
                className="h-8 text-xs px-2.5"
                onClick={() => setTopFilterTab("stations")}
              >
                Stations ({stations.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={topFilterTab === "profiles" ? "default" : "outline"}
                className="h-8 text-xs px-2.5"
                onClick={() => setTopFilterTab("profiles")}
              >
                Profiles ({profiles.length})
              </Button>
            </div>
          </div>

          {/* Candidate Items Horizontal / Grid Scroll */}
          <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {candidateItems.map((entry) => {
                if (entry.kind === "material") {
                  const m = entry.item;
                  const isSelected = String(m.material_id) === materialId;
                  return (
                    <div
                      key={`mat-${m.material_id}`}
                      className={`flex flex-col justify-between rounded-lg border p-2.5 text-xs transition-colors bg-card ${
                        isSelected ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/30"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                            <FlaskConical className="size-3.5 text-amber-500 shrink-0" />
                            <span className="truncate">{m.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 font-medium text-amber-600 dark:text-amber-400">
                            Material
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {m.part_number ? `#${m.part_number} · ` : ""}{m.family} · {m.two_part ? "2-part" : "1-comp"}
                          {m.pot_life_hours ? ` · pot life ${m.pot_life_hours}h` : ""}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 mt-2 border-t gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setInspectItem({ type: "material", material: m })}
                        >
                          <Eye className="size-3" />
                          <span>Specs</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={isSelected ? "secondary" : "outline"}
                          className="h-6 text-[11px] font-medium px-2"
                          onClick={() => handleMaterialChange(String(m.material_id))}
                        >
                          {isSelected ? <Check className="size-3 text-emerald-600 mr-1" /> : null}
                          {isSelected ? "Selected" : "Select Material"}
                        </Button>
                      </div>
                    </div>
                  );
                } else if (entry.kind === "station") {
                  const s = entry.item;
                  const isSelected = String(s.station_id) === stationId;
                  return (
                    <div
                      key={`stn-${s.station_id}`}
                      className={`flex flex-col justify-between rounded-lg border p-2.5 text-xs transition-colors bg-card ${
                        isSelected ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/30"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                            <Wrench className="size-3.5 text-sky-500 shrink-0" />
                            <span className="truncate">{s.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 font-medium text-sky-600 dark:text-sky-400">
                            Station
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {s.line} · {s.dispenser_class} {s.valve_model ? `(${s.valve_model})` : ""}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 mt-2 border-t gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setInspectItem({ type: "station", station: s })}
                        >
                          <Eye className="size-3" />
                          <span>Specs</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={isSelected ? "secondary" : "outline"}
                          className="h-6 text-[11px] font-medium px-2"
                          onClick={() => setStationId(String(s.station_id))}
                        >
                          {isSelected ? <Check className="size-3 text-emerald-600 mr-1" /> : null}
                          {isSelected ? "Selected" : "Select Station"}
                        </Button>
                      </div>
                    </div>
                  );
                } else {
                  const p = entry.item;
                  const isSelected = String(p.profile_id) === profileId;
                  return (
                    <div
                      key={`prof-${p.profile_id}`}
                      className={`flex flex-col justify-between rounded-lg border p-2.5 text-xs transition-colors bg-card ${
                        isSelected ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/30"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                            <Compass className="size-3.5 text-violet-500 shrink-0" />
                            <span className="truncate">{p.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 font-medium text-violet-600 dark:text-violet-400">
                            Profile
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.material.name} · {p.needle_gauge ?? "gauge N/A"} · {p.set_pressure_kpa ? `${p.set_pressure_kpa} kPa` : "nominal"}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 mt-2 border-t gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setInspectItem({ type: "profile", profile: p })}
                        >
                          <Eye className="size-3" />
                          <span>Specs</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={isSelected ? "secondary" : "outline"}
                          className="h-6 text-[11px] font-medium px-2"
                          onClick={() => handleProfileChange(String(p.profile_id))}
                        >
                          {isSelected ? <Check className="size-3 text-emerald-600 mr-1" /> : null}
                          {isSelected ? "Selected" : "Select Profile"}
                        </Button>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
            {candidateItems.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                No items match your search &quot;{topSearch}&quot;. Use the quick buttons above to create a new one.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Wide 2-Column Dashboard Grid */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Intake Form (7 cols) */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="shadow-xs">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Machine & Process Selection</CardTitle>
                <CardDescription>
                  Choose the hardware station and fluid job running on the line.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Dispense Station */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="station" className="flex items-center gap-1.5 text-xs font-semibold">
                      <Wrench className="size-3.5 text-primary" />
                      Dispense Station
                    </Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateModal("station")}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <Plus className="size-3" /> New Station
                      </button>
                      {selectedStation && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <button
                            type="button"
                            onClick={() => setInspectItem({ type: "station", station: selectedStation })}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="size-3" /> Check station details
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <Select
                    value={stationId}
                    onValueChange={(v) => setStationId(v ?? "")}
                    disabled={loadingOptions}
                  >
                    <SelectTrigger id="station" className="w-full">
                      <SelectValue placeholder="Select station...">
                        {(value: string) => {
                          const s = stations.find((item) => String(item.station_id) === value);
                          return s ? `${s.name} (${s.line}) · ${s.dispenser_class}` : value;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {stations.map((s) => (
                        <SelectItem key={s.station_id} value={String(s.station_id)}>
                          <div className="flex items-center justify-between w-full gap-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{s.name}</span>
                              <span className="text-xs text-muted-foreground">({s.line})</span>
                              <span className="text-xs text-muted-foreground">· {s.dispenser_class}</span>
                            </div>
                            {s.valve_model && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {s.valve_model}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {selectedStation
                        ? `${selectedStation.line} · ${selectedStation.dispenser_class} ${selectedStation.valve_model ? `(${selectedStation.valve_model})` : ""}`
                        : "Select hardware station to verify valve & dispenser class."}
                    </span>
                    {selectedStation && (
                      <button
                        type="button"
                        onClick={() => setInspectItem({ type: "station", station: selectedStation })}
                        className="font-medium text-foreground hover:underline"
                      >
                        Full specs &rarr;
                      </button>
                    )}
                  </div>
                </div>

                {/* Fluid Material Dropdown */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="material" className="flex items-center gap-1.5 text-xs font-semibold">
                      <FlaskConical className="size-3.5 text-primary" />
                      Fluid Material
                    </Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateModal("material")}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <Plus className="size-3" /> New Material
                      </button>
                      {selectedMaterial && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <button
                            type="button"
                            onClick={() => setInspectItem({ type: "material", material: selectedMaterial })}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="size-3" /> Check material details
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <Select
                    value={materialId}
                    onValueChange={handleMaterialChange}
                    disabled={loadingOptions}
                  >
                    <SelectTrigger id="material" className="w-full">
                      <SelectValue placeholder="Select fluid material...">
                        {(value: string) => {
                          const m = materials.find((item) => String(item.material_id) === value);
                          return m ? `${m.name} ${m.part_number ? `(${m.part_number})` : ""} · ${m.family}` : value;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((m) => (
                        <SelectItem key={m.material_id} value={String(m.material_id)}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{m.name}</span>
                            {m.part_number && (
                              <span className="text-xs text-muted-foreground font-mono">({m.part_number})</span>
                            )}
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {m.family}
                            </Badge>
                            {m.two_part && <span className="text-[11px] text-muted-foreground">· 2-part</span>}
                            {m.pot_life_hours && (
                              <span className="text-[10px] text-muted-foreground">· pot life {m.pot_life_hours}h</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {selectedMaterial
                        ? `${selectedMaterial.family} · ${selectedMaterial.two_part ? "2-part formulation" : "1-component"} ${selectedMaterial.pot_life_hours ? `· ${selectedMaterial.pot_life_hours}h pot life` : ""}`
                        : "Pick a material to filter compatible profiles & verify rheology limits."}
                    </span>
                    {selectedMaterial && (
                      <button
                        type="button"
                        onClick={() => setInspectItem({ type: "material", material: selectedMaterial })}
                        className="font-medium text-foreground hover:underline"
                      >
                        Full specs &rarr;
                      </button>
                    )}
                  </div>
                </div>

                {/* Dispense Profile Dropdown */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="profile" className="flex items-center gap-1.5 text-xs font-semibold">
                      <Compass className="size-3.5 text-primary" />
                      Dispense Profile & Pattern
                    </Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (materialId) {
                            setNewProfile((prev) => ({ ...prev, material_id: Number(materialId) }));
                          } else if (materials.length > 0) {
                            setNewProfile((prev) => ({ ...prev, material_id: materials[0].material_id }));
                          }
                          setCreateModal("profile");
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <Plus className="size-3" /> New Profile
                      </button>
                      {selectedProfile && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <button
                            type="button"
                            onClick={() => setInspectItem({ type: "profile", profile: selectedProfile })}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="size-3" /> Check profile specs
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <Select
                    value={profileId}
                    onValueChange={handleProfileChange}
                    disabled={loadingOptions}
                  >
                    <SelectTrigger id="profile" className="w-full">
                      <SelectValue placeholder="Select dispense profile...">
                        {(value: string) => {
                          const p = profiles.find((item) => String(item.profile_id) === value);
                          return p ? `${p.name} · ${p.needle_gauge ?? ""} · ${p.spec_metric ?? "nominal"}` : value;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProfiles.map((p) => (
                        <SelectItem key={p.profile_id} value={String(p.profile_id)}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            {p.needle_gauge && (
                              <Badge variant="secondary" className="text-[10px]">
                                {p.needle_gauge}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">· {p.material.name}</span>
                            {p.spec_metric && p.spec_limit && (
                              <span className="text-[10px] text-muted-foreground">
                                ({p.spec_metric} {p.spec_limit})
                              </span>
                            )}
                            {p.geometry?.pattern && (
                              <Badge variant="outline" className="text-[9px] uppercase">
                                {p.geometry.pattern}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {selectedProfile
                        ? `${selectedProfile.needle_gauge ?? "Standard needle"} · ${selectedProfile.set_pressure_kpa ? `${selectedProfile.set_pressure_kpa} kPa` : "nominal pressure"} · ${selectedProfile.geometry?.pattern ? `Pattern: ${selectedProfile.geometry.pattern}` : "Standard geometry"}`
                        : "Pick a profile to load calibrated needle, pressure, and tolerance limits."}
                    </span>
                    {selectedProfile && (
                      <button
                        type="button"
                        onClick={() => setInspectItem({ type: "profile", profile: selectedProfile })}
                        className="font-medium text-foreground hover:underline"
                      >
                        Inspect geometry &rarr;
                      </button>
                    )}
                  </div>
                </div>

                {/* Material Lot */}
                <div className="space-y-1.5">
                  <Label htmlFor="material_lot" className="text-xs font-semibold">
                    Material Lot / Batch ID (Optional)
                  </Label>
                  <Input
                    id="material_lot"
                    value={materialLot}
                    onChange={(e) => setMaterialLot(e.target.value)}
                    placeholder="e.g. LOT-2026-A or 2409-X"
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Helps cross-reference batch-specific shelf-life and thaw histories in Step 8.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Defect Complaint Card */}
            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Observed Defect Complaint</CardTitle>
                <CardDescription>
                  Summarize what went wrong on the board or substrate.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preset Chips */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Quick Presets:</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMPLAINT_PRESETS.map((preset) => {
                      const active = complaint === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setComplaint(preset)}
                          className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                            active
                              ? "border-primary bg-primary text-primary-foreground font-medium"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Complaint Title Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="complaint" className="text-xs font-semibold">
                    Defect Title / Summary
                  </Label>
                  <Input
                    id="complaint"
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    placeholder="e.g. Inconsistent size shot to shot"
                    className="text-sm font-medium"
                  />
                </div>

                {/* Complaint Description / Operator Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="complaint_text" className="text-xs font-semibold">
                    Operator Notes / Freeform Description
                  </Label>
                  <Textarea
                    id="complaint_text"
                    value={complaintText}
                    onChange={(e) => setComplaintText(e.target.value)}
                    rows={3}
                    placeholder="Describe specific symptoms (e.g. started after syringe change, tailing on rightmost pads, pressure dropped)..."
                    className="text-sm"
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t bg-muted/20 pt-4">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || loadingOptions}
                  className="w-full gap-2 font-semibold shadow-md"
                >
                  <Sparkles className="size-4" />
                  {submitting ? "Opening Case & Launching..." : "Start Troubleshooting Wizard →"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        {/* Right Column: Live Confirmation Card (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="border-primary/20 bg-muted/10 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="size-4 text-primary" />
                  Live Detail Confirmation
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  Active Selection
                </Badge>
              </div>
              <CardDescription>
                Confirm station, material, and profile parameters match your line setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* Station Block */}
              <div className="rounded-md border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Wrench className="size-3.5 text-primary" /> Station
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedStation ? selectedStation.name : "—"}
                    </Badge>
                    {selectedStation && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-1.5 text-[10px] text-primary hover:bg-primary/10"
                        onClick={() => setInspectItem({ type: "station", station: selectedStation })}
                      >
                        <Eye className="size-3" /> Check Details
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <Field label="Line" value={selectedStation?.line ?? "—"} />
                  <Field label="Dispenser class" value={selectedStation?.dispenser_class ?? "—"} />
                  <Field label="Valve model" value={selectedStation?.valve_model ?? "—"} />
                  <Field label="Heated reservoir" value={selectedStation ? yesNo(selectedStation.heated_reservoir) : "—"} />
                  <Field label="Camera available" value={selectedStation ? yesNo(selectedStation.camera_available) : "—"} />
                </div>
              </div>

              {/* Material Block */}
              <div className="rounded-md border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <FlaskConical className="size-3.5 text-primary" /> Fluid Material
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedMaterial ? selectedMaterial.name : "—"}
                    </Badge>
                    {selectedMaterial && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-1.5 text-[10px] text-primary hover:bg-primary/10"
                        onClick={() => setInspectItem({ type: "material", material: selectedMaterial })}
                      >
                        <Eye className="size-3" /> Check Details
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <Field label="Part #" value={selectedMaterial?.part_number ?? "—"} />
                  <Field label="Family" value={selectedMaterial?.family ?? "—"} />
                  <Field
                    label="Chemistry"
                    value={
                      selectedMaterial
                        ? selectedMaterial.two_part
                          ? "Two-part formulation"
                          : "Single component"
                        : "—"
                    }
                  />
                  <Field
                    label="Thixotropic"
                    value={selectedMaterial ? yesNo(selectedMaterial.thixotropic) : "—"}
                  />
                  <Field
                    label="Pot life limit"
                    value={selectedMaterial?.pot_life_hours ? `${selectedMaterial.pot_life_hours}h` : "—"}
                  />
                  <Field
                    label="Out-time limit"
                    value={selectedMaterial?.out_time_hours ? `${selectedMaterial.out_time_hours}h` : "—"}
                  />
                  <Field
                    label="Storage temp"
                    value={selectedMaterial?.storage_temp_c != null ? `${selectedMaterial.storage_temp_c} °C` : "—"}
                  />
                  <Field
                    label="Filler particle"
                    value={
                      selectedMaterial?.filler_particle_um
                        ? `${selectedMaterial.filler_particle_um} µm`
                        : selectedMaterial
                          ? "None"
                          : "—"
                    }
                  />
                </div>
              </div>

              {/* Profile Block */}
              <div className="rounded-md border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Compass className="size-3.5 text-primary" /> Dispense Profile
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedProfile ? selectedProfile.name : "—"}
                    </Badge>
                    {selectedProfile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-1.5 text-[10px] text-primary hover:bg-primary/10"
                        onClick={() => setInspectItem({ type: "profile", profile: selectedProfile })}
                      >
                        <Eye className="size-3" /> Check Specs
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <Field label="Needle gauge" value={selectedProfile?.needle_gauge ?? "—"} />
                  <Field label="Needle ID" value={selectedProfile?.needle_id_um ? `${selectedProfile.needle_id_um} µm` : "—"} />
                  <Field label="Set pressure" value={selectedProfile?.set_pressure_kpa ? `${selectedProfile.set_pressure_kpa} kPa` : "—"} />
                  <Field label="Set time" value={selectedProfile?.set_time_ms ? `${selectedProfile.set_time_ms} ms` : "—"} />
                  <Field label="Standoff" value={selectedProfile?.standoff_um ? `${selectedProfile.standoff_um} µm` : "—"} />
                  <Field label="Speed" value={selectedProfile?.speed_mm_s ? `${selectedProfile.speed_mm_s} mm/s` : "—"} />
                  <Field label="Set temperature" value={selectedProfile?.set_temp_c ? `${selectedProfile.set_temp_c} °C` : "—"} />
                  <Field label="Spec limit" value={selectedProfile?.spec_metric ? `${selectedProfile.spec_metric} ${selectedProfile.spec_limit}` : "—"} />

                  <div className="pt-2 border-t mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Pattern</span>
                    {selectedProfile?.geometry ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {selectedProfile.geometry.pattern.toUpperCase()}
                        </span>
                        <button
                          type="button"
                          onClick={() => setInspectItem({ type: "profile", profile: selectedProfile })}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <Eye className="size-3" /> Inspect
                        </button>
                        <Link
                          href={`/profiles/${selectedProfile.profile_id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[11px] text-sky-500 hover:underline"
                        >
                          Blueprint <ExternalLink className="size-3" />
                        </Link>
                      </div>
                    ) : (
                      <span className="font-mono font-medium text-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Comprehensive Details Inspector Modal */}
      {inspectItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6"
          onClick={() => setInspectItem(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border bg-card text-card-foreground shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/20">
              <div className="flex items-center gap-2.5">
                {inspectItem.type === "station" && <Wrench className="size-5 text-primary" />}
                {inspectItem.type === "material" && <FlaskConical className="size-5 text-primary" />}
                {inspectItem.type === "profile" && <Compass className="size-5 text-primary" />}
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                      {inspectItem.type === "station" && "Dispense Station Details"}
                      {inspectItem.type === "material" && "Fluid Material Chemistry"}
                      {inspectItem.type === "profile" && "Dispense Profile & Pattern Geometry"}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold text-foreground mt-0.5">
                    {inspectItem.type === "station" && inspectItem.station?.name}
                    {inspectItem.type === "material" && inspectItem.material?.name}
                    {inspectItem.type === "profile" && inspectItem.profile?.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {inspectItem.type === "station" && inspectItem.station && (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/20 p-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Line Designation</span>
                      <p className="font-semibold text-foreground">{inspectItem.station.line}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Dispenser Class</span>
                      <p className="font-semibold font-mono text-foreground">{inspectItem.station.dispenser_class}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Valve Model</span>
                      <p className="font-semibold text-foreground">{inspectItem.station.valve_model ?? "Standard"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">System ID</span>
                      <p className="font-mono text-xs text-foreground">#{inspectItem.station.station_id}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Subsystem & Hardware Features
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Thermometer className="size-4 text-primary" />
                          <span>Heated Reservoir</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {inspectItem.station.heated_reservoir ? "Installed & Active" : "Not equipped"}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Eye className="size-4 text-primary" />
                          <span>Optical Camera</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {inspectItem.station.camera_available ? "Vision Alignment Ready" : "Manual fiducial"}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Cpu className="size-4 text-primary" />
                          <span>Dispense Order Log</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {inspectItem.station.reports_dispense_order ? "Sequence recorded" : "Unordered"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {inspectItem.type === "material" && inspectItem.material && (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-lg border bg-muted/20 p-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Part Number</span>
                      <p className="font-mono font-medium text-foreground">{inspectItem.material.part_number ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Polymer Family</span>
                      <p className="font-semibold text-foreground uppercase">{inspectItem.material.family}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Formulation</span>
                      <p className="font-semibold text-foreground">{inspectItem.material.two_part ? "2-Part Reactive" : "1-Component"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Thixotropic Index</span>
                      <p className="font-medium text-foreground">{yesNo(inspectItem.material.thixotropic)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Thaw Requirement</span>
                      <p className="font-medium text-foreground">{yesNo(inspectItem.material.requires_thaw)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Storage Temp</span>
                      <p className="font-medium text-foreground">
                        {inspectItem.material.storage_temp_c != null ? `${inspectItem.material.storage_temp_c} °C` : "Ambient"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Critical Rheology & Time Limits
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">Pot Life Window</span>
                        <p className="text-base font-bold text-foreground">
                          {inspectItem.material.pot_life_hours ? `${inspectItem.material.pot_life_hours} Hours` : "Unlimited"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Viscosity doubling threshold</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">Maximum Out-Time</span>
                        <p className="text-base font-bold text-foreground">
                          {inspectItem.material.out_time_hours ? `${inspectItem.material.out_time_hours} Hours` : "Standard"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Ambient exposure limit</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">Filler Particle Size</span>
                        <p className="text-base font-bold text-foreground">
                          {inspectItem.material.filler_particle_um ? `${inspectItem.material.filler_particle_um} µm` : "Unfilled"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Determines minimum needle ID</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {inspectItem.type === "profile" && inspectItem.profile && (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-lg border bg-muted/20 p-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Fluid Material</span>
                      <p className="font-semibold text-foreground">{inspectItem.profile.material.name}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Needle Gauge</span>
                      <p className="font-semibold font-mono text-foreground">{inspectItem.profile.needle_gauge ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Needle Internal Dia (ID)</span>
                      <p className="font-semibold font-mono text-foreground">
                        {inspectItem.profile.needle_id_um ? `${inspectItem.profile.needle_id_um} µm` : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Dispense Pressure</span>
                      <p className="font-medium text-foreground">
                        {inspectItem.profile.set_pressure_kpa ? `${inspectItem.profile.set_pressure_kpa} kPa` : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Shot Duration (Time)</span>
                      <p className="font-medium text-foreground">
                        {inspectItem.profile.set_time_ms ? `${inspectItem.profile.set_time_ms} ms` : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Dispense Standoff</span>
                      <p className="font-medium text-foreground">
                        {inspectItem.profile.standoff_um ? `${inspectItem.profile.standoff_um} µm` : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Robot Speed</span>
                      <p className="font-medium text-foreground">
                        {inspectItem.profile.speed_mm_s ? `${inspectItem.profile.speed_mm_s} mm/s` : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Nozzle Set Temp</span>
                      <p className="font-medium text-foreground">
                        {inspectItem.profile.set_temp_c != null ? `${inspectItem.profile.set_temp_c} °C` : "Ambient"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Spec Metric / Limit</span>
                      <p className="font-medium text-foreground">
                        {inspectItem.profile.spec_metric ? `${inspectItem.profile.spec_metric}: ${inspectItem.profile.spec_limit}` : "Nominal"}
                      </p>
                    </div>
                  </div>

                  {/* Pattern Geometry Preview */}
                  {inspectItem.profile.geometry ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Pattern Geometry Blueprint: {inspectItem.profile.geometry.pattern.toUpperCase()}
                        </h4>
                        <Link
                          href={`/profiles/${inspectItem.profile.profile_id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs text-sky-500 hover:underline"
                        >
                          Open Blueprint Page <ExternalLink className="size-3" />
                        </Link>
                      </div>

                      <div className="rounded-xl border bg-muted/10 p-4">
                        <ProfileGeometryPattern
                          geometry={inspectItem.profile.geometry}
                          specMetric={inspectItem.profile.spec_metric}
                          specLimit={inspectItem.profile.spec_limit}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border p-4 text-center text-xs text-muted-foreground">
                      No Cartesian coordinate array defined for this profile.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t px-6 py-4 bg-muted/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInspectItem(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                className="gap-1.5 font-semibold shadow-xs"
                onClick={() => {
                  if (inspectItem.type === "station" && inspectItem.station) {
                    setStationId(String(inspectItem.station.station_id));
                    toast.success(`Selected station: ${inspectItem.station.name}`);
                  } else if (inspectItem.type === "material" && inspectItem.material) {
                    handleMaterialChange(String(inspectItem.material.material_id));
                    toast.success(`Selected material: ${inspectItem.material.name}`);
                  } else if (inspectItem.type === "profile" && inspectItem.profile) {
                    handleProfileChange(String(inspectItem.profile.profile_id));
                    toast.success(`Selected profile: ${inspectItem.profile.name}`);
                  }
                  setInspectItem(null);
                }}
              >
                <Check className="size-4" />
                Select this {inspectItem.type} for Intake
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Creation Dialogs for Station / Material / Profile */}
      {createModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6"
          onClick={() => setCreateModal(null)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl border bg-card text-card-foreground shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/20">
              <div className="flex items-center gap-2.5">
                {createModal === "station" && <Wrench className="size-5 text-primary" />}
                {createModal === "material" && <FlaskConical className="size-5 text-primary" />}
                {createModal === "profile" && <Compass className="size-5 text-primary" />}
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {createModal === "station" && "Create Dispense Station"}
                    {createModal === "material" && "Create Fluid Material"}
                    {createModal === "profile" && "Create Dispense Profile"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Item will be saved to catalog and automatically selected for intake.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="flex-1 overflow-y-auto p-6">
              {createModal === "station" && (
                <form id="create-station-form" onSubmit={handleCreateStationSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="stn-name" className="text-xs font-semibold">Station Name *</Label>
                      <Input
                        id="stn-name"
                        value={newStation.name}
                        onChange={(e) => setNewStation((p) => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Line 1 Dispenser Alpha"
                        required
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="stn-line" className="text-xs font-semibold">Line / Bay *</Label>
                      <Input
                        id="stn-line"
                        value={newStation.line}
                        onChange={(e) => setNewStation((p) => ({ ...p, line: e.target.value }))}
                        placeholder="e.g. Line 1"
                        required
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="stn-class" className="text-xs font-semibold">Dispenser Class *</Label>
                      <select
                        id="stn-class"
                        value={newStation.dispenser_class}
                        onChange={(e) => setNewStation((p) => ({ ...p, dispenser_class: e.target.value as DispenserClass }))}
                        className="w-full h-8 rounded-md border bg-background px-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
                      >
                        {DISPENSER_CLASSES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="stn-valve" className="text-xs font-semibold">Valve Model</Label>
                      <Input
                        id="stn-valve"
                        value={newStation.valve_model ?? ""}
                        onChange={(e) => setNewStation((p) => ({ ...p, valve_model: e.target.value }))}
                        placeholder="e.g. Jet-7000 or HP-Valv"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newStation.heated_reservoir}
                        onChange={(e) => setNewStation((p) => ({ ...p, heated_reservoir: e.target.checked }))}
                        className="rounded border-input text-primary"
                      />
                      <span className="text-xs text-foreground">Heated Reservoir</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newStation.camera_available}
                        onChange={(e) => setNewStation((p) => ({ ...p, camera_available: e.target.checked }))}
                        className="rounded border-input text-primary"
                      />
                      <span className="text-xs text-foreground">Camera / Vision Available</span>
                    </label>
                  </div>
                </form>
              )}

              {createModal === "material" && (
                <form id="create-material-form" onSubmit={handleCreateMaterialSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="mat-name" className="text-xs font-semibold">Material Name *</Label>
                      <Input
                        id="mat-name"
                        value={newMaterial.name}
                        onChange={(e) => setNewMaterial((p) => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Epoxy D-90"
                        required
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mat-pn" className="text-xs font-semibold">Part Number</Label>
                      <Input
                        id="mat-pn"
                        value={newMaterial.part_number ?? ""}
                        onChange={(e) => setNewMaterial((p) => ({ ...p, part_number: e.target.value }))}
                        placeholder="e.g. EPX-900"
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="mat-family" className="text-xs font-semibold">Chemistry Family *</Label>
                      <select
                        id="mat-family"
                        value={newMaterial.family}
                        onChange={(e) => setNewMaterial((p) => ({ ...p, family: e.target.value as MaterialFamily }))}
                        className="w-full h-8 rounded-md border bg-background px-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
                      >
                        {MATERIAL_FAMILIES.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mat-pot" className="text-xs font-semibold">Pot Life (Hours)</Label>
                      <Input
                        id="mat-pot"
                        type="number"
                        value={newMaterial.pot_life_hours ?? ""}
                        onChange={(e) => setNewMaterial((p) => ({ ...p, pot_life_hours: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="e.g. 8"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="mat-out" className="text-xs font-semibold">Max Out-Time (Hours)</Label>
                      <Input
                        id="mat-out"
                        type="number"
                        value={newMaterial.out_time_hours ?? ""}
                        onChange={(e) => setNewMaterial((p) => ({ ...p, out_time_hours: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="e.g. 24"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mat-filler" className="text-xs font-semibold">Filler Particle (µm)</Label>
                      <Input
                        id="mat-filler"
                        type="number"
                        value={newMaterial.filler_particle_um ?? ""}
                        onChange={(e) => setNewMaterial((p) => ({ ...p, filler_particle_um: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="e.g. 15"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newMaterial.two_part}
                        onChange={(e) => setNewMaterial((p) => ({ ...p, two_part: e.target.checked }))}
                        className="rounded border-input text-primary"
                      />
                      <span className="text-xs text-foreground">Two-Part Reaction</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newMaterial.thixotropic}
                        onChange={(e) => setNewMaterial((p) => ({ ...p, thixotropic: e.target.checked }))}
                        className="rounded border-input text-primary"
                      />
                      <span className="text-xs text-foreground">Thixotropic Fluid</span>
                    </label>
                  </div>
                </form>
              )}

              {createModal === "profile" && (
                <form id="create-profile-form" onSubmit={handleCreateProfileSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-name" className="text-xs font-semibold">Profile Name *</Label>
                      <Input
                        id="prof-name"
                        value={newProfile.name}
                        onChange={(e) => setNewProfile((p) => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. BGA Underfill Standard"
                        required
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-mat" className="text-xs font-semibold">Fluid Material *</Label>
                      <select
                        id="prof-mat"
                        value={newProfile.material_id}
                        onChange={(e) => setNewProfile((p) => ({ ...p, material_id: Number(e.target.value) }))}
                        className="w-full h-8 rounded-md border bg-background px-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
                        required
                      >
                        <option value={0} disabled>Select material...</option>
                        {materials.map((m) => (
                          <option key={m.material_id} value={m.material_id}>
                            {m.name} ({m.family})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-needle" className="text-xs font-semibold">Needle Gauge</Label>
                      <Input
                        id="prof-needle"
                        value={newProfile.needle_gauge ?? ""}
                        onChange={(e) => setNewProfile((p) => ({ ...p, needle_gauge: e.target.value }))}
                        placeholder="e.g. 27G"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-nid" className="text-xs font-semibold">Needle ID (µm)</Label>
                      <Input
                        id="prof-nid"
                        type="number"
                        value={newProfile.needle_id_um ?? ""}
                        onChange={(e) => setNewProfile((p) => ({ ...p, needle_id_um: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="e.g. 200"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-press" className="text-xs font-semibold">Set Pressure (kPa)</Label>
                      <Input
                        id="prof-press"
                        type="number"
                        value={newProfile.set_pressure_kpa ?? ""}
                        onChange={(e) => setNewProfile((p) => ({ ...p, set_pressure_kpa: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="e.g. 120"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-time" className="text-xs font-semibold">Shot Time (ms)</Label>
                      <Input
                        id="prof-time"
                        type="number"
                        value={newProfile.set_time_ms ?? ""}
                        onChange={(e) => setNewProfile((p) => ({ ...p, set_time_ms: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="e.g. 100"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-standoff" className="text-xs font-semibold">Standoff (µm)</Label>
                      <Input
                        id="prof-standoff"
                        type="number"
                        value={newProfile.standoff_um ?? ""}
                        onChange={(e) => setNewProfile((p) => ({ ...p, standoff_um: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="e.g. 150"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-metric" className="text-xs font-semibold">Spec Metric</Label>
                      <Input
                        id="prof-metric"
                        value={newProfile.spec_metric ?? ""}
                        onChange={(e) => setNewProfile((p) => ({ ...p, spec_metric: e.target.value }))}
                        placeholder="e.g. dot_diameter_um"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-limit" className="text-xs font-semibold">Spec Limit / Tolerance</Label>
                      <Input
                        id="prof-limit"
                        value={newProfile.spec_limit ?? ""}
                        onChange={(e) => setNewProfile((p) => ({ ...p, spec_limit: e.target.value }))}
                        placeholder="e.g. 500±50"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t px-6 py-4 bg-muted/20">
              <Link
                href="/catalog"
                target="_blank"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Or open full Catalog page <ExternalLink className="size-3" />
              </Link>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingItem}
                  form={
                    createModal === "station"
                      ? "create-station-form"
                      : createModal === "material"
                        ? "create-material-form"
                        : "create-profile-form"
                  }
                  className="gap-1.5 font-semibold shadow-xs"
                >
                  <Plus className="size-3.5" />
                  {savingItem ? "Saving..." : "Create & Select"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
