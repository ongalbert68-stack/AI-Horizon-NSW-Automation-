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
  index?: number;
  cx?: number;
  cy?: number;
  x?: number;
  y?: number;
  r?: number | null;
}

export interface Geometry {
  pattern: string;
  width: number | null;
  height: number | null;
  points?: GeometryPoint[];
  profile?: GeometryPoint[];
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
  /** Did this iteration alter the machine/tooling/material, or only observe
   * it? Only changes count toward `action_count`. */
  is_change: boolean;
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
  vision_result: Record<string, unknown> | null;
  ranking: Ranking | null;
  rank_tier: Tier | null;
  llm_map_used: boolean;
  llm_critic_used: boolean;
  llm_explain_used: boolean;
  diagnosis: Diagnosis | null;
  verification: Verification | null;
  resolved: boolean;
  diagnosed: DiagnosedState;
  tier: CaseTier | null;
  escalate: boolean;
  engineer_notes: string | null;
  action_count: number;
  /** Changes only. Observations are counted separately and cost nothing at close. */
  observation_count: number;
  station: DispenseStation;
  profile: DispenseProfile;
  check_results: CheckResult[];
}

export type CaseInput = Omit<
  Case,
  | "case_id"
  | "action_count"
  | "observation_count"
  | "check_results"
  | "pre_intake_actions"
  | "station"
  | "profile"
> & { pre_intake_actions?: string[] };

// ---- Intake (steps 1-2) ----------------------------------------------------

export interface QuestionOption {
  value: string;
  label: string;
  help_text: string;
  exclusive: boolean;
}

export interface Question {
  id: string;
  axis: string;
  prompt: string;
  kind: "single" | "multi";
  options: QuestionOption[];
  max_picks: number | null;
  has_dont_know: boolean;
  has_other: boolean;
}

export interface MapFreeTextResponse {
  mapped_value: string | null;
  used_llm: boolean;
}

// ---- Vision (step 3) --------------------------------------------------------

export interface VisionResult {
  quality_ok: boolean;
  quality_reason: string | null;
  signals: Record<string, number>;
  magnitude: string;
  small_then_big_above_chance: boolean;
  suggested_signature?: string[];
  cv_output: Record<string, unknown>;
}

// ---- Ranking (step 5) --------------------------------------------------------

export interface Evidence {
  label: string;
  detail: string;
  source: string;
  weight: number;
  kind: "signal" | "answer" | "check";
}

export interface Pass1Cause {
  cause_id: string;
  label: string;
  likelihood: number;
  evidence: Evidence[];
}

export interface Pass2Cause {
  cause_id: string;
  likelihood_pct: number;
}

export interface GateA {
  above_chance: boolean;
  deciding_signal: string | null;
  p_value: number | null;
  note: string;
}

export interface GateB {
  applied: boolean;
  matched_count: number;
  contradicting_count: number;
  note: string;
}

export type Tier = "T1" | "T2" | "T3" | "T4";

export interface Ranking {
  pass1: Pass1Cause[];
  pass2: Pass2Cause[] | null;
  agree: boolean;
  critic_top_cause_id?: string | null;
  critic_note?: string;
  gate_a: GateA;
  gate_b: GateB;
  tier: Tier;
  top_cause_id: string;
  runners_up: string[];
}

// ---- Causes (step 4) -------------------------------------------------------

export interface CauseVocab {
  id: string;
  label: string;
  sources: string[];
  image_signature: string | null;
  image_signature_note?: string | null;
}

export interface ComparisonRow {
  label: string;
  detail: string;
  source: string;
  weight: number;
}

export interface CauseComparison {
  cause_id: string;
  label: string;
  image_signature: string | null;
  supports: ComparisonRow[];
  contradicts: ComparisonRow[];
}

// ---- Retrieval --------------------------------------------------------------

export interface CoarseMatch {
  case_id: number;
  score: number;
  matched_axes: string[];
}

export interface FineMatch {
  case_id: number;
  cause_id: string | null;
  score: number;
}

// ---- Report (step 7) / close (step 8) ---------------------------------------

export interface Defect {
  signature: string[];
  magnitude: string;
  stars: number;
}

export interface CheckLogRow {
  sequence: number;
  check_name: string;
  cause_id: string | null;
  outcome: CheckOutcome | null;
  result_detail: string | null;
}

export interface Report {
  case_id: number;
  complaint: string | null;
  complaint_text: string | null;
  defect: Defect;
  quality: { ok: boolean | null; reason: string | null };
  tier: Tier | null;
  disagreement_note: string | null;
  causes: Pass1Cause[];
  explanation: string | null;
  explanation_used_llm: boolean;
  check_log: CheckLogRow[];
  diagnosis: Diagnosis | null;
  verification: Verification | null;
  engineer_notes: string | null;
  rules_version: string;
  llm_used: boolean;
  disclaimer: string;
  action_count: number;
  resolved: boolean;
  close_tier: CaseTier | null;
}

export interface CloseCaseResponse {
  tier: CaseTier;
  gaps: string[];
}
