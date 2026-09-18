"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Compass,
  Edit2,
  ExternalLink,
  Eye,
  FilePlus2,
  FlaskConical,
  Gauge,
  Layers,
  Plus,
  Search,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfileGeometryPattern } from "@/components/profile-geometry-pattern";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createMaterial,
  listMaterials,
  updateMaterial,
} from "@/lib/api/materials";
import {
  createProfile,
  listProfiles,
  updateProfile,
} from "@/lib/api/profiles";
import {
  createStation,
  listStations,
  updateStation,
} from "@/lib/api/stations";
import type {
  DispenserClass,
  DispenseProfile,
  DispenseProfileCreate,
  DispenseStation,
  DispenseStationCreate,
  FluidMaterial,
  FluidMaterialCreate,
  Geometry,
  MaterialFamily,
} from "@/lib/api/types";

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

/** The patterns the vision side already classifies — see
 * components/profile-geometry-pattern.tsx's `classifyPattern`, which reads
 * the pattern string to decide how to draw it. Free text is still allowed,
 * so a shop-specific name isn't blocked; these are the ones that render as
 * something other than dots. */
const GEOMETRY_PATTERNS = ["dots", "line", "bead", "area", "perimeter"];

/** One editable point. `index` is not held here — it's assigned on save
 * from array order, so reordering or deleting a row can't leave a gap or a
 * duplicate in what the backend stores. */
interface GeometryPointDraft {
  /** Stable across edits so React keys don't reuse a deleted row's state. */
  key: string;
  cx: string;
  cy: string;
  r: string;
}

let geometryRowCounter = 0;
function newGeometryRow(cx = "", cy = "", r = ""): GeometryPointDraft {
  geometryRowCounter += 1;
  return { key: `g${geometryRowCounter}`, cx, cy, r };
}

/** The drafts are strings so a half-typed "1." or a cleared field doesn't
 * become NaN or snap to 0 mid-keystroke. This is the one place they turn
 * into numbers. */
function toGeometry(
  enabled: boolean, pattern: string, width: string, height: string, rows: GeometryPointDraft[],
): Geometry | null {
  if (!enabled || !pattern.trim()) return null;
  const profile = rows
    .map((row) => ({ cx: Number(row.cx), cy: Number(row.cy), r: Number(row.r) }))
    .filter((p) => [p.cx, p.cy, p.r].every(Number.isFinite))
    .map((p, index) => ({ index, ...p }));
  if (profile.length === 0) return null;
  return {
    pattern: pattern.trim(),
    width: width.trim() ? Number(width) : null,
    height: height.trim() ? Number(height) : null,
    profile,
  };
}

/** Lays `count` dots out evenly across the canvas, which is how every
 * real dot profile on file is shaped — typing four near-identical rows by
 * hand is the tedious part this removes. */
function evenlySpacedDots(count: number, width: number, height: number, radius: number): GeometryPointDraft[] {
  const pitch = width / (count + 1);
  return Array.from({ length: count }, (_, i) =>
    newGeometryRow(String(Math.round(pitch * (i + 1))), String(Math.round(height / 2)), String(radius)),
  );
}

export default function CatalogPage() {
  const [activeTab, setActiveTab] = React.useState("materials");
  const [loading, setLoading] = React.useState(true);

  const [materials, setMaterials] = React.useState<FluidMaterial[]>([]);
  const [stations, setStations] = React.useState<DispenseStation[]>([]);
  const [profiles, setProfiles] = React.useState<DispenseProfile[]>([]);

  // Search queries
  const [searchQuery, setSearchQuery] = React.useState("");

  // Modal Dialogs
  const [createType, setCreateType] = React.useState<"material" | "station" | "profile" | null>(null);
  const [editItem, setEditItem] = React.useState<{
    type: "material" | "station" | "profile";
    item: FluidMaterial | DispenseStation | DispenseProfile;
  } | null>(null);

  // Material Form state
  const [matForm, setMatForm] = React.useState<FluidMaterialCreate>({
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

  // Station Form state
  const [stationForm, setStationForm] = React.useState<DispenseStationCreate>({
    name: "",
    line: "",
    dispenser_class: "pressure_time",
    valve_model: "",
    heated_reservoir: false,
    camera_available: false,
    reports_dispense_order: false,
  });

  // Profile Form state
  const [profileForm, setProfileForm] = React.useState<DispenseProfileCreate>({
    name: "",
    material_id: 0,
    needle_gauge: "",
    needle_id_um: null,
    set_pressure_kpa: null,
    set_time_ms: null,
    standoff_um: null,
    speed_mm_s: null,
    set_temp_c: null,
    spec_metric: "size_cv",
    spec_limit: "< 0.15",
  });

  // Geometry lives outside profileForm: it's edited as strings (so a
  // half-typed number stays half-typed) and only becomes a Geometry on
  // save.
  const [geomEnabled, setGeomEnabled] = React.useState(false);
  const [geomPattern, setGeomPattern] = React.useState("dots");
  const [geomWidth, setGeomWidth] = React.useState("260");
  const [geomHeight, setGeomHeight] = React.useState("100");
  const [geomRows, setGeomRows] = React.useState<GeometryPointDraft[]>([]);

  const geometryPreview = React.useMemo(
    () => toGeometry(geomEnabled, geomPattern, geomWidth, geomHeight, geomRows),
    [geomEnabled, geomPattern, geomWidth, geomHeight, geomRows],
  );

  function resetGeometry(geometry?: Geometry | null) {
    const points = geometry?.profile ?? geometry?.points ?? [];
    setGeomEnabled(Boolean(geometry && points.length > 0));
    setGeomPattern(geometry?.pattern ?? "dots");
    setGeomWidth(geometry?.width != null ? String(geometry.width) : "260");
    setGeomHeight(geometry?.height != null ? String(geometry.height) : "100");
    setGeomRows(
      points.length > 0
        ? points.map((p) =>
            newGeometryRow(
              String(p.cx ?? p.x ?? 0), String(p.cy ?? p.y ?? 0), String(p.r ?? 0),
            ),
          )
        : evenlySpacedDots(4, 260, 100, 26),
    );
  }

  const fetchData = React.useCallback(async () => {
    try {
      const [mRes, sRes, pRes] = await Promise.all([
        listMaterials({ limit: 200 }),
        listStations({ limit: 200 }),
        listProfiles({ limit: 200 }),
      ]);
      setMaterials(mRes.items);
      setStations(sRes.items);
      setProfiles(pRes.items);
    } catch {
      toast.error("Failed to load catalog items.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Create Dialog
  function openCreate(type: "material" | "station" | "profile") {
    if (type === "material") {
      setMatForm({
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
    } else if (type === "station") {
      setStationForm({
        name: "",
        line: "Line 1",
        dispenser_class: "pressure_time",
        valve_model: "",
        heated_reservoir: false,
        camera_available: false,
        reports_dispense_order: false,
      });
    } else if (type === "profile") {
      setProfileForm({
        name: "",
        material_id: materials[0]?.material_id ?? 0,
        needle_gauge: "27G",
        needle_id_um: 210,
        set_pressure_kpa: 150,
        set_time_ms: 120,
        standoff_um: 300,
        speed_mm_s: 25,
        set_temp_c: 25,
        spec_metric: "size_cv",
        spec_limit: "< 0.15",
      });
      resetGeometry(null);
    }
    setCreateType(type);
  }

  // Open Edit Dialog
  function openEdit(type: "material" | "station" | "profile", item: any) {
    if (type === "material") {
      const m = item as FluidMaterial;
      setMatForm({
        name: m.name,
        part_number: m.part_number ?? "",
        family: m.family,
        two_part: m.two_part ?? false,
        thixotropic: m.thixotropic ?? false,
        requires_thaw: m.requires_thaw ?? false,
        pot_life_hours: m.pot_life_hours ?? null,
        out_time_hours: m.out_time_hours ?? null,
        storage_temp_c: m.storage_temp_c ?? null,
        filler_particle_um: m.filler_particle_um ?? null,
      });
    } else if (type === "station") {
      const s = item as DispenseStation;
      setStationForm({
        name: s.name,
        line: s.line,
        dispenser_class: s.dispenser_class,
        valve_model: s.valve_model ?? "",
        heated_reservoir: s.heated_reservoir ?? false,
        camera_available: s.camera_available ?? false,
        reports_dispense_order: s.reports_dispense_order ?? false,
      });
    } else if (type === "profile") {
      const p = item as DispenseProfile;
      setProfileForm({
        name: p.name,
        material_id: p.material_id,
        needle_gauge: p.needle_gauge ?? "",
        needle_id_um: p.needle_id_um ?? null,
        set_pressure_kpa: p.set_pressure_kpa ?? null,
        set_time_ms: p.set_time_ms ?? null,
        standoff_um: p.standoff_um ?? null,
        speed_mm_s: p.speed_mm_s ?? null,
        set_temp_c: p.set_temp_c ?? null,
        spec_metric: p.spec_metric ?? "",
        spec_limit: p.spec_limit ?? "",
      });
      resetGeometry(p.geometry);
    }
    setEditItem({ type, item });
  }

  // Handle Save (Create or Edit)
  async function handleSaveMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!matForm.name.trim()) {
      toast.error("Material name is required.");
      return;
    }
    try {
      if (editItem && editItem.type === "material") {
        const id = (editItem.item as FluidMaterial).material_id;
        await updateMaterial(id, matForm);
        toast.success(`Updated material "${matForm.name}"!`);
      } else {
        await createMaterial(matForm);
        toast.success(`Created material "${matForm.name}"!`);
      }
      setCreateType(null);
      setEditItem(null);
      await fetchData();
    } catch {
      toast.error("Failed to save fluid material.");
    }
  }

  async function handleSaveStation(e: React.FormEvent) {
    e.preventDefault();
    if (!stationForm.name.trim() || !stationForm.line.trim()) {
      toast.error("Station name and line are required.");
      return;
    }
    try {
      if (editItem && editItem.type === "station") {
        const id = (editItem.item as DispenseStation).station_id;
        await updateStation(id, stationForm);
        toast.success(`Updated station "${stationForm.name}"!`);
      } else {
        await createStation(stationForm);
        toast.success(`Created station "${stationForm.name}"!`);
      }
      setCreateType(null);
      setEditItem(null);
      await fetchData();
    } catch {
      toast.error("Failed to save dispense station.");
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileForm.name.trim() || !profileForm.material_id) {
      toast.error("Profile name and material are required.");
      return;
    }
    // Turned on but unfillable is a mistake worth naming, not silently
    // dropping — the profile would save and the blueprint would stay empty.
    if (geomEnabled && !geometryPreview) {
      toast.error("Add a pattern name and at least one complete point, or turn geometry off.");
      return;
    }
    // `null` when off, so clearing the geometry on an existing profile
    // actually clears it rather than leaving the old shape on file.
    const payload = { ...profileForm, geometry: geometryPreview };
    try {
      if (editItem && editItem.type === "profile") {
        const id = (editItem.item as DispenseProfile).profile_id;
        await updateProfile(id, payload);
        toast.success(`Updated profile "${profileForm.name}"!`);
      } else {
        await createProfile(payload);
        toast.success(`Created profile "${profileForm.name}"!`);
      }
      setCreateType(null);
      setEditItem(null);
      await fetchData();
    } catch {
      toast.error("Failed to save dispense profile.");
    }
  }

  // Filtered lists based on search
  const q = searchQuery.toLowerCase().trim();

  const filteredMaterials = materials.filter((m) => {
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      (m.part_number && m.part_number.toLowerCase().includes(q)) ||
      m.family.toLowerCase().includes(q)
    );
  });

  const filteredStations = stations.filter((s) => {
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.line.toLowerCase().includes(q) ||
      s.dispenser_class.toLowerCase().includes(q) ||
      (s.valve_model && s.valve_model.toLowerCase().includes(q))
    );
  });

  const filteredProfiles = profiles.filter((p) => {
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.material.name.toLowerCase().includes(q) ||
      (p.needle_gauge && p.needle_gauge.toLowerCase().includes(q)) ||
      (p.geometry?.pattern && p.geometry.pattern.toLowerCase().includes(q))
    );
  });

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
            href="/troubleshoot"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Troubleshoot Intake
          </Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="text-xs font-semibold text-foreground">
            Equipment & Material Catalog
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/troubleshoot"
            className={buttonVariants({
              variant: "default",
              size: "sm",
              className: "gap-1.5 text-xs font-medium shadow-xs",
            })}
          >
            <FilePlus2 className="size-3.5" />
            <span>Start Case Intake</span>
          </Link>
        </div>
      </div>

      {/* Hero Title with Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-xs font-semibold text-primary">
              Configuration & Assets
            </Badge>
            <span className="text-xs text-muted-foreground">Manage machines, chemicals, and dispense profiles</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl text-foreground">
            Equipment & Material Catalog
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Browse, inspect, create, and update dispense stations, fluid materials, and calibrated process profiles. Any changes made here are immediately available for selection during troubleshooting intake.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs font-semibold"
            onClick={() => openCreate("material")}
          >
            <Plus className="size-3.5 text-primary" />
            <span>Add Material</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs font-semibold"
            onClick={() => openCreate("station")}
          >
            <Plus className="size-3.5 text-primary" />
            <span>Add Station</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs font-semibold"
            onClick={() => openCreate("profile")}
          >
            <Plus className="size-3.5 text-primary" />
            <span>Add Profile</span>
          </Button>
        </div>
      </div>

      {/* Search & Tabs Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, part #, line, or needle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-3 w-full sm:w-[360px]">
              <TabsTrigger value="materials" className="text-xs">
                Materials ({materials.length})
              </TabsTrigger>
              <TabsTrigger value="stations" className="text-xs">
                Stations ({stations.length})
              </TabsTrigger>
              <TabsTrigger value="profiles" className="text-xs">
                Profiles ({profiles.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab 1: Fluid Materials */}
        {activeTab === "materials" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMaterials.map((m) => (
                <Card key={m.material_id} className="relative overflow-hidden shadow-xs hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-1.5">
                          <FlaskConical className="size-4 text-primary shrink-0" />
                          <span>{m.name}</span>
                        </CardTitle>
                        {m.part_number && (
                          <span className="font-mono text-xs text-muted-foreground">
                            Part #{m.part_number}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                        {m.family}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 rounded-md border bg-muted/20 p-2.5 text-muted-foreground">
                      <div>Formulation: <span className="font-medium text-foreground">{m.two_part ? "2-Part" : "1-Part"}</span></div>
                      <div>Thixotropic: <span className="font-medium text-foreground">{m.thixotropic ? "Yes" : "No"}</span></div>
                      <div>Pot Life: <span className="font-medium text-foreground">{m.pot_life_hours ? `${m.pot_life_hours}h` : "—"}</span></div>
                      <div>Out-Time: <span className="font-medium text-foreground">{m.out_time_hours ? `${m.out_time_hours}h` : "—"}</span></div>
                      <div>Storage Temp: <span className="font-medium text-foreground">{m.storage_temp_c != null ? `${m.storage_temp_c}°C` : "Ambient"}</span></div>
                      <div>Filler Particle: <span className="font-medium text-foreground">{m.filler_particle_um ? `${m.filler_particle_um}µm` : "None"}</span></div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <Link
                        href={`/troubleshoot?selectType=material&selectId=${m.material_id}`}
                        className="text-[11px] text-primary font-medium hover:underline inline-flex items-center gap-1"
                      >
                        Use in Case Intake &rarr;
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                        onClick={() => openEdit("material", m)}
                      >
                        <Edit2 className="size-3" />
                        <span>Edit Material</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {filteredMaterials.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No materials match your query. Click &quot;Add Material&quot; to create one.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Dispense Stations */}
        {activeTab === "stations" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStations.map((s) => (
                <Card key={s.station_id} className="relative overflow-hidden shadow-xs hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-1.5">
                          <Wrench className="size-4 text-primary shrink-0" />
                          <span>{s.name}</span>
                        </CardTitle>
                        <span className="text-xs text-muted-foreground font-mono">
                          ID #{s.station_id}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 font-semibold">
                        {s.line}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 rounded-md border bg-muted/20 p-2.5 text-muted-foreground">
                      <div>Dispenser: <span className="font-medium text-foreground font-mono">{s.dispenser_class}</span></div>
                      <div>Valve Model: <span className="font-medium text-foreground">{s.valve_model ?? "Standard"}</span></div>
                      <div>Heated Tank: <span className="font-medium text-foreground">{s.heated_reservoir ? "Yes" : "No"}</span></div>
                      <div>Camera: <span className="font-medium text-foreground">{s.camera_available ? "Yes" : "No"}</span></div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <Link
                        href={`/troubleshoot?selectType=station&selectId=${s.station_id}`}
                        className="text-[11px] text-primary font-medium hover:underline inline-flex items-center gap-1"
                      >
                        Use in Case Intake &rarr;
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                        onClick={() => openEdit("station", s)}
                      >
                        <Edit2 className="size-3" />
                        <span>Edit Station</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {filteredStations.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No stations match your query. Click &quot;Add Station&quot; to create one.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Dispense Profiles */}
        {activeTab === "profiles" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProfiles.map((p) => (
                <Card key={p.profile_id} className="relative overflow-hidden shadow-xs hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-1.5">
                          <Compass className="size-4 text-primary shrink-0" />
                          <span>{p.name}</span>
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                          Material: {p.material.name}
                        </span>
                      </div>
                      {p.needle_gauge && (
                        <Badge variant="secondary" className="text-[10px] shrink-0 font-bold">
                          {p.needle_gauge}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 rounded-md border bg-muted/20 p-2.5 text-muted-foreground">
                      <div>Needle ID: <span className="font-medium text-foreground">{p.needle_id_um ? `${p.needle_id_um}µm` : "—"}</span></div>
                      <div>Pressure: <span className="font-medium text-foreground">{p.set_pressure_kpa ? `${p.set_pressure_kpa} kPa` : "—"}</span></div>
                      <div>Shot Time: <span className="font-medium text-foreground">{p.set_time_ms ? `${p.set_time_ms} ms` : "—"}</span></div>
                      <div>Standoff: <span className="font-medium text-foreground">{p.standoff_um ? `${p.standoff_um}µm` : "—"}</span></div>
                      <div>Speed: <span className="font-medium text-foreground">{p.speed_mm_s ? `${p.speed_mm_s} mm/s` : "—"}</span></div>
                      <div>Spec Limit: <span className="font-medium text-foreground">{p.spec_metric ? `${p.spec_metric} ${p.spec_limit}` : "—"}</span></div>
                    </div>

                    {p.geometry && (
                      <div className="pt-2 border-t flex items-center justify-between text-xs">
                        <span className="font-medium">
                          Pattern: {p.geometry.pattern.toUpperCase()}
                        </span>
                        <Link
                          href={`/profiles/${p.profile_id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[11px] text-sky-500 hover:underline"
                        >
                          Blueprint <ExternalLink className="size-3" />
                        </Link>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <Link
                        href={`/troubleshoot?selectType=profile&selectId=${p.profile_id}`}
                        className="text-[11px] text-primary font-medium hover:underline inline-flex items-center gap-1"
                      >
                        Use in Case Intake &rarr;
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                        onClick={() => openEdit("profile", p)}
                      >
                        <Edit2 className="size-3" />
                        <span>Edit Profile</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {filteredProfiles.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No profiles match your query. Click &quot;Add Profile&quot; to create one.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Creation / Edit Modal Dialogs */}
      {(createType === "material" || (editItem && editItem.type === "material")) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => { setCreateType(null); setEditItem(null); }}
        >
          <div
            className="w-full max-w-xl rounded-xl border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <FlaskConical className="size-4 text-primary" />
                {editItem ? "Edit Fluid Material" : "Add New Fluid Material"}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-full"
                onClick={() => { setCreateType(null); setEditItem(null); }}
              >
                <X className="size-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="mat-name" className="text-xs">Material Name *</Label>
                  <Input
                    id="mat-name"
                    required
                    placeholder="e.g. Epoxy B or Dow Corning 732"
                    value={matForm.name}
                    onChange={(e) => setMatForm({ ...matForm, name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mat-part" className="text-xs">Part Number</Label>
                  <Input
                    id="mat-part"
                    placeholder="e.g. EPX-200 or 2409-X"
                    value={matForm.part_number ?? ""}
                    onChange={(e) => setMatForm({ ...matForm, part_number: e.target.value || null })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="mat-family" className="text-xs">Chemical Family</Label>
                  <select
                    id="mat-family"
                    value={matForm.family}
                    onChange={(e) => setMatForm({ ...matForm, family: e.target.value as MaterialFamily })}
                    className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    {MATERIAL_FAMILIES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mat-potlife" className="text-xs">Pot Life Limit (Hours)</Label>
                  <Input
                    id="mat-potlife"
                    type="number"
                    step="0.5"
                    placeholder="e.g. 8"
                    value={matForm.pot_life_hours ?? ""}
                    onChange={(e) => setMatForm({ ...matForm, pot_life_hours: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="mat-outtime" className="text-xs">Out-Time Limit (Hrs)</Label>
                  <Input
                    id="mat-outtime"
                    type="number"
                    step="0.5"
                    placeholder="e.g. 4"
                    value={matForm.out_time_hours ?? ""}
                    onChange={(e) => setMatForm({ ...matForm, out_time_hours: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mat-storage" className="text-xs">Storage Temp (°C)</Label>
                  <Input
                    id="mat-storage"
                    type="number"
                    placeholder="e.g. 4"
                    value={matForm.storage_temp_c ?? ""}
                    onChange={(e) => setMatForm({ ...matForm, storage_temp_c: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mat-filler" className="text-xs">Filler Particle (µm)</Label>
                  <Input
                    id="mat-filler"
                    type="number"
                    placeholder="e.g. 15"
                    value={matForm.filler_particle_um ?? ""}
                    onChange={(e) => setMatForm({ ...matForm, filler_particle_um: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={matForm.two_part}
                    onChange={(e) => setMatForm({ ...matForm, two_part: e.target.checked })}
                    className="rounded border"
                  />
                  <span>Two-part mix required</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={matForm.thixotropic}
                    onChange={(e) => setMatForm({ ...matForm, thixotropic: e.target.checked })}
                    className="rounded border"
                  />
                  <span>Thixotropic fluid behavior</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setCreateType(null); setEditItem(null); }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="font-semibold shadow-xs">
                  {editItem ? "Save Changes" : "Create Material"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Station Modal */}
      {(createType === "station" || (editItem && editItem.type === "station")) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => { setCreateType(null); setEditItem(null); }}
        >
          <div
            className="w-full max-w-xl rounded-xl border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Wrench className="size-4 text-primary" />
                {editItem ? "Edit Dispense Station" : "Add New Dispense Station"}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-full"
                onClick={() => { setCreateType(null); setEditItem(null); }}
              >
                <X className="size-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveStation} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="st-name" className="text-xs">Station Name *</Label>
                  <Input
                    id="st-name"
                    required
                    placeholder="e.g. Line 4 Dispenser"
                    value={stationForm.name}
                    onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="st-line" className="text-xs">Production Line *</Label>
                  <Input
                    id="st-line"
                    required
                    placeholder="e.g. Line 4 or SMT-B"
                    value={stationForm.line}
                    onChange={(e) => setStationForm({ ...stationForm, line: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="st-class" className="text-xs">Dispenser Class</Label>
                  <select
                    id="st-class"
                    value={stationForm.dispenser_class}
                    onChange={(e) => setStationForm({ ...stationForm, dispenser_class: e.target.value as DispenserClass })}
                    className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    {DISPENSER_CLASSES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="st-valve" className="text-xs">Valve Model (Optional)</Label>
                  <Input
                    id="st-valve"
                    placeholder="e.g. Nordson 741 or Vermes 3200"
                    value={stationForm.valve_model ?? ""}
                    onChange={(e) => setStationForm({ ...stationForm, valve_model: e.target.value || null })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={stationForm.heated_reservoir}
                    onChange={(e) => setStationForm({ ...stationForm, heated_reservoir: e.target.checked })}
                    className="rounded border"
                  />
                  <span>Heated Reservoir Tank</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={stationForm.camera_available}
                    onChange={(e) => setStationForm({ ...stationForm, camera_available: e.target.checked })}
                    className="rounded border"
                  />
                  <span>Vision Camera Installed</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setCreateType(null); setEditItem(null); }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="font-semibold shadow-xs">
                  {editItem ? "Save Changes" : "Create Station"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {(createType === "profile" || (editItem && editItem.type === "profile")) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => { setCreateType(null); setEditItem(null); }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Compass className="size-4 text-primary" />
                {editItem ? "Edit Dispense Profile" : "Add New Dispense Profile"}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-full"
                onClick={() => { setCreateType(null); setEditItem(null); }}
              >
                <X className="size-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="prof-name" className="text-xs">Profile Name *</Label>
                  <Input
                    id="prof-name"
                    required
                    placeholder="e.g. Small Dot 27G"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prof-mat" className="text-xs">Assigned Material *</Label>
                  <select
                    id="prof-mat"
                    value={profileForm.material_id}
                    onChange={(e) => setProfileForm({ ...profileForm, material_id: Number(e.target.value) })}
                    className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    {materials.map((m) => (
                      <option key={m.material_id} value={m.material_id}>
                        {m.name} ({m.family})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="prof-needle" className="text-xs">Needle Gauge</Label>
                  <Input
                    id="prof-needle"
                    placeholder="e.g. 27G"
                    value={profileForm.needle_gauge ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, needle_gauge: e.target.value || null })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prof-needle-id" className="text-xs">Needle ID (µm)</Label>
                  <Input
                    id="prof-needle-id"
                    type="number"
                    placeholder="e.g. 210"
                    value={profileForm.needle_id_um ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, needle_id_um: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prof-press" className="text-xs">Pressure (kPa)</Label>
                  <Input
                    id="prof-press"
                    type="number"
                    placeholder="e.g. 150"
                    value={profileForm.set_pressure_kpa ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, set_pressure_kpa: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="prof-time" className="text-xs">Shot Time (ms)</Label>
                  <Input
                    id="prof-time"
                    type="number"
                    placeholder="e.g. 120"
                    value={profileForm.set_time_ms ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, set_time_ms: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prof-standoff" className="text-xs">Standoff (µm)</Label>
                  <Input
                    id="prof-standoff"
                    type="number"
                    placeholder="e.g. 300"
                    value={profileForm.standoff_um ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, standoff_um: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prof-speed" className="text-xs">Speed (mm/s)</Label>
                  <Input
                    id="prof-speed"
                    type="number"
                    placeholder="e.g. 25"
                    value={profileForm.speed_mm_s ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, speed_mm_s: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="prof-spec-metric" className="text-xs">Spec Metric</Label>
                  <Input
                    id="prof-spec-metric"
                    placeholder="e.g. size_cv or diameter"
                    value={profileForm.spec_metric ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, spec_metric: e.target.value || null })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prof-spec-limit" className="text-xs">Spec Limit</Label>
                  <Input
                    id="prof-spec-limit"
                    placeholder="e.g. < 0.15"
                    value={profileForm.spec_limit ?? ""}
                    onChange={(e) => setProfileForm({ ...profileForm, spec_limit: e.target.value || null })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Dispense pattern geometry — the expected layout the vision
                  step measures each photo against. Without it, a case on
                  this profile has nothing to compare deposits to. */}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Layers className="size-3.5 text-primary" />
                      Dispense Pattern Geometry
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      The expected layout each photo is measured against. Leave it off if you
                      don&apos;t have one — cases still run on the interview alone.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={geomEnabled ? "default" : "outline"}
                    size="xs"
                    className="shrink-0"
                    onClick={() => setGeomEnabled(!geomEnabled)}
                  >
                    {geomEnabled ? "On" : "Off"}
                  </Button>
                </div>

                {geomEnabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="geom-pattern" className="text-xs">Pattern</Label>
                        <Input
                          id="geom-pattern"
                          list="geom-pattern-options"
                          placeholder="e.g. dots"
                          value={geomPattern}
                          onChange={(e) => setGeomPattern(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <datalist id="geom-pattern-options">
                          {GEOMETRY_PATTERNS.map((p) => <option key={p} value={p} />)}
                        </datalist>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="geom-width" className="text-xs">Canvas Width</Label>
                        <Input
                          id="geom-width"
                          type="number"
                          placeholder="e.g. 260"
                          value={geomWidth}
                          onChange={(e) => setGeomWidth(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="geom-height" className="text-xs">Canvas Height</Label>
                        <Input
                          id="geom-height"
                          type="number"
                          placeholder="e.g. 100"
                          value={geomHeight}
                          onChange={(e) => setGeomHeight(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">
                          Points{" "}
                          <span className="font-normal text-muted-foreground">
                            (centre x, centre y, target radius)
                          </span>
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              setGeomRows(
                                evenlySpacedDots(
                                  Math.max(geomRows.length, 1),
                                  Number(geomWidth) || 260,
                                  Number(geomHeight) || 100,
                                  Number(geomRows[0]?.r) || 26,
                                ),
                              )
                            }
                            disabled={geomRows.length === 0}
                          >
                            Space evenly
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className="gap-1"
                            onClick={() => setGeomRows([...geomRows, newGeometryRow("0", "0", "26")])}
                          >
                            <Plus className="size-3" /> Point
                          </Button>
                        </div>
                      </div>

                      {geomRows.length === 0 ? (
                        <p className="rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">
                          No points yet — add at least one, or turn geometry off.
                        </p>
                      ) : (
                        <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                          {geomRows.map((row, i) => (
                            <div key={row.key} className="flex items-center gap-1.5">
                              <span className="w-5 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
                                {i}
                              </span>
                              {(["cx", "cy", "r"] as const).map((field) => (
                                <Input
                                  key={field}
                                  type="number"
                                  aria-label={`Point ${i} ${field}`}
                                  placeholder={field}
                                  value={row[field]}
                                  onChange={(e) =>
                                    setGeomRows(
                                      geomRows.map((r) =>
                                        r.key === row.key ? { ...r, [field]: e.target.value } : r,
                                      ),
                                    )
                                  }
                                  className="h-7 text-xs"
                                />
                              ))}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Remove point ${i}`}
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setGeomRows(geomRows.filter((r) => r.key !== row.key))}
                              >
                                <X className="size-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* The same renderer the wizard and blueprint use, so
                        what's drawn here is what an operator will see. */}
                    {geometryPreview && (
                      <div className="space-y-1">
                        <Label className="text-xs">Preview</Label>
                        <ProfileGeometryPattern
                          geometry={geometryPreview}
                          specMetric={profileForm.spec_metric}
                          specLimit={profileForm.spec_limit}
                          canvasClassName="h-40"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setCreateType(null); setEditItem(null); }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="font-semibold shadow-xs">
                  {editItem ? "Save Changes" : "Create Profile"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
