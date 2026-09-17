// Mirrors backend/app/schemas/*.py. Kept hand-written and in sync rather than
// generated, since the ERD is still small and stable enough for that to be
// more overhead than it saves at this size.

export type DispenserClass = "pressure_time" | "auger" | "piston" | "jetting";

export type MaterialFamily =
  | "epoxy"
  | "solder_paste"
  | "silicone"
  | "uv_cure"
  | "cyanoacrylate";

export type DiagnosedState = "check_confirmed" | "best_guess" | "never_tested";

export type CaseTier = "CONFIRMED" | "PLAUSIBLE" | "UNVERIFIED";

export type CheckOutcome = "confirms" | "rules_out" | "inconclusive";

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface FluidMaterial {
  material_id: number;
  name: string;
  part_number: string | null;
  family: MaterialFamily;
  two_part: boolean;
  thixotropic: boolean;
  requires_thaw: boolean;
  pot_life_hours: number | null;
  out_time_hours: number | null;
  storage_temp_c: number | null;
  filler_particle_um: number | null;
}

export type FluidMaterialInput = Omit<FluidMaterial, "material_id">;

export interface DispenseStation {
  station_id: number;
  name: string;
  line: string;
  dispenser_class: DispenserClass;
  valve_model: string | null;
  heated_reservoir: boolean;
  reports_dispense_order: boolean;
  camera_available: boolean;
}

export type DispenseStationInput = Omit<DispenseStation, "station_id">;

export interface GeometryPoint {
  x: number;
  y: number;
  r: number | null;
}

export interface Geometry {
  pattern: string;
  width: number | null;
  height: number | null;
  points: GeometryPoint[];
}

export interface DispenseProfile {
  profile_id: number;
  name: string;
  material_id: number;
  needle_gauge: string | null;
  needle_id_um: number | null;
  set_pressure_kpa: number | null;
  set_time_ms: number | null;
  standoff_um: number | null;
  speed_mm_s: number | null;
  set_temp_c: number | null;
  spec_metric: string | null;
  spec_limit: string | null;
  geometry: Geometry | null;
  material: FluidMaterial;
}

export type DispenseProfileInput = Omit<DispenseProfile, "profile_id" | "material">;

/** DispenseProfile as embedded in a Case response — no nested material. */
export type DispenseProfileSummary = Omit<DispenseProfile, "material">;

export interface FingerprintAxes {
  signature: string[];
  trajectory: string | null;
  footprint: string | null;
  inputs: string[];
  response: string | null;
}

export interface Fingerprint {
  axes: FingerprintAxes;
  signals: Record<string, number | string | null>;
}

export interface Diagnosis {
  cause_id: string | null;
  runners_up: string[];
  confirmed_by: { check: string; result: string } | null;
}

export interface Verification {
  signal: string | null;
  before: number | null;
  after: number | null;
  in_spec: boolean | null;
  shots_measured: number | null;
  recurred_after_days: number | null;
}

export interface CheckResult {
  check_result_id: number;
  case_id: number;
  sequence: number;
  check_name: string;
  cause_id: string | null;
  cost_minutes: number | null;
  invasive: boolean;
  safety_note: string | null;
  outcome: CheckOutcome | null;
  result_detail: string | null;
  performed_at: string | null;
}

export type CheckResultInput = Omit<CheckResult, "check_result_id" | "case_id">;

export interface Case {
  case_id: number;
  station_id: number;
  profile_id: number;
  rules_version: string;
  opened_at: string;
  closed_at: string | null;
  material_lot: string | null;
  complaint: string | null;
  complaint_text: string | null;
  fingerprint: Fingerprint | null;
  pre_intake_actions: string[];
  diagnosis: Diagnosis | null;
  verification: Verification | null;
  resolved: boolean;
  diagnosed: DiagnosedState;
  tier: CaseTier | null;
  escalate: boolean;
  engineer_notes: string | null;
  action_count: number;
  station: DispenseStation;
  profile: DispenseProfileSummary;
  check_results: CheckResult[];
}

export type CaseInput = Omit<
  Case,
  "case_id" | "action_count" | "check_results" | "pre_intake_actions" | "station" | "profile"
> & { pre_intake_actions?: string[] };
