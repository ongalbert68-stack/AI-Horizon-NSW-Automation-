// Mirrors backend/app/domains/*/schema.py. Hand-written and kept in sync
// rather than generated — the pipeline's shape is still moving, and at
// this size that's less overhead than a codegen step.

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---- ERD: stations / materials / profiles ---------------------------------

export type DispenserClass = "pressure_time" | "auger" | "piston" | "jetting";
export type MaterialFamily = "epoxy" | "solder_paste" | "silicone" | "uv_cure" | "cyanoacrylate";

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

export interface DispenseStationCreate {
  name: string;
  line: string;
  dispenser_class: DispenserClass;
  valve_model?: string | null;
  heated_reservoir?: boolean;
  reports_dispense_order?: boolean;
  camera_available?: boolean;
}

export interface DispenseStationUpdate {
  name?: string;
  line?: string;
  dispenser_class?: DispenserClass;
  valve_model?: string | null;
  heated_reservoir?: boolean;
  reports_dispense_order?: boolean;
  camera_available?: boolean;
}

export interface GeometryPoint {
  index?: number;
  cx?: number;
  cy?: number;
  r?: number;
  x?: number;
  y?: number;
}

export interface Geometry {
  pattern: string;
  width?: number | null;
  height?: number | null;
  profile?: GeometryPoint[];
  points?: GeometryPoint[];
}

export interface FluidMaterial {
  material_id: number;
  name: string;
  part_number: string | null;
  family: MaterialFamily;
  two_part?: boolean;
  thixotropic?: boolean;
  requires_thaw?: boolean;
  pot_life_hours?: number | null;
  out_time_hours?: number | null;
  storage_temp_c?: number | null;
  filler_particle_um?: number | null;
}

export interface FluidMaterialCreate {
  name: string;
  part_number?: string | null;
  family: MaterialFamily;
  two_part?: boolean;
  thixotropic?: boolean;
  requires_thaw?: boolean;
  pot_life_hours?: number | null;
  out_time_hours?: number | null;
  storage_temp_c?: number | null;
  filler_particle_um?: number | null;
}

export interface FluidMaterialUpdate {
  name?: string;
  part_number?: string | null;
  family?: MaterialFamily;
  two_part?: boolean;
  thixotropic?: boolean;
  requires_thaw?: boolean;
  pot_life_hours?: number | null;
  out_time_hours?: number | null;
  storage_temp_c?: number | null;
  filler_particle_um?: number | null;
}

export interface DispenseProfile {
  profile_id: number;
  name: string;
  material_id: number;
  needle_gauge?: string | null;
  needle_id_um?: number | null;
  set_pressure_kpa?: number | null;
  set_time_ms?: number | null;
  standoff_um?: number | null;
  speed_mm_s?: number | null;
  set_temp_c?: number | null;
  spec_metric: string | null;
  spec_limit: string | null;
  geometry?: Geometry | null;
  material: FluidMaterial;
}

export interface DispenseProfileCreate {
  name: string;
  material_id: number;
  needle_gauge?: string | null;
  needle_id_um?: number | null;
  set_pressure_kpa?: number | null;
  set_time_ms?: number | null;
  standoff_um?: number | null;
  speed_mm_s?: number | null;
  set_temp_c?: number | null;
  spec_metric?: string | null;
  spec_limit?: string | null;
  geometry?: Geometry | null;
}

export interface DispenseProfileUpdate {
  name?: string;
  material_id?: number;
  needle_gauge?: string | null;
  needle_id_um?: number | null;
  set_pressure_kpa?: number | null;
  set_time_ms?: number | null;
  standoff_um?: number | null;
  speed_mm_s?: number | null;
  set_temp_c?: number | null;
  spec_metric?: string | null;
  spec_limit?: string | null;
  geometry?: Geometry | null;
}

// ---- Intake (steps 1-2) ----------------------------------------------------

export interface QuestionOption {
  value: string;
  /** What the operator reads. `value` is the stored id and is never shown. */
  label: string;
  /** The plain-language example shown under the label. */
  help_text: string;
  /** Picking this clears every other pick on the same question. */
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

// ---- Fingerprint ------------------------------------------------------------

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
  /** Raw words from "Other (describe)", keyed by axis id. Kept for a human
   * to read; never scored. */
  axis_notes?: Record<string, string>;
}

// ---- Vision (step 3) --------------------------------------------------------

export interface VisionResult {
  quality_ok: boolean;
  quality_reason: string | null;
  signals: Record<string, number>;
  magnitude: string;
  small_then_big_above_chance: boolean;
  /** Axis-1 picks the measurement supports, for the interview to open
   * pre-filled on. A suggestion the operator can change — the backend
   * never writes it into the fingerprint itself. */
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
  /** "Not contradicted", not "actively agreed" — see `critic_note`. */
  agree: boolean;
  /** The critic's pick, or null when it abstained. Null alongside a
   * non-empty `pass2` means it ranked the causes but had no clear view,
   * which is not counted as disagreement. Optional: rankings stored
   * before this field existed don't carry it. */
  critic_top_cause_id?: string | null;
  /** Why the critic did or didn't get a vote, in words. */
  critic_note?: string;
  gate_a: GateA;
  gate_b: GateB;
  tier: Tier;
  top_cause_id: string;
  runners_up: string[];
}

// ---- Causes (step 4) ----------------------------------------------------------

export interface CauseVocab {
  id: string;
  label: string;
  sources: string[];
  image_signature: string | null;
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

// ---- Checks (step 6) -----------------------------------------------------------

export type CheckOutcome = "confirms" | "rules_out" | "inconclusive";

export interface CheckResult {
  check_result_id: number;
  case_id: number;
  sequence: number;
  check_name: string;
  cause_id: string | null;
  cost_minutes: number | null;
  invasive: boolean;
  safety_note: string | null;
  /** Did this iteration alter the machine/tooling/material, or only
   * observe it? Only changes count toward `action_count`. */
  is_change: boolean;
  outcome: CheckOutcome | null;
  result_detail: string | null;
  performed_at: string | null;
}

export interface CheckResultInput {
  check_name: string;
  cause_id: string | null;
  cost_minutes: number | null;
  invasive: boolean;
  safety_note: string | null;
  is_change: boolean;
  outcome: CheckOutcome | null;
  result_detail: string | null;
}

// ---- Cases -----------------------------------------------------------------------

export type DiagnosedState = "check_confirmed" | "best_guess" | "never_tested";
export type CaseTier = "CONFIRMED" | "PLAUSIBLE" | "UNVERIFIED";

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

export interface CaseOpenInput {
  station_id: number;
  profile_id: number;
  material_lot?: string | null;
  complaint?: string | null;
  complaint_text?: string | null;
}

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
  /** Changes only. Observations are counted separately and cost nothing
   * at close. */
  action_count: number;
  observation_count: number;
  station: DispenseStation;
  profile: DispenseProfile;
  check_results: CheckResult[];
}

// ---- Report (step 7) / close (step 8) ---------------------------------------------

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

export interface CauseTally {
  cause_id: string;
  label: string;
  count: number;
  share: number;
}

/** The learning-database read: how often a problem shaped like this one
 * has been seen, and what it turned out to be. `sentence` is null when the
 * history is too thin to summarise — show `note` instead. */
export interface Precedents {
  total: number;
  diagnosed_total: number;
  matched_axes: string[];
  by_cause: CauseTally[];
  sentence: string | null;
  note: string;
}

/** What to check next, in order — distinct from `check_log`, which is what
 * was already done. */
export interface RecommendedAction {
  step: number;
  check_name: string;
  cause_id: string;
  cause_label: string;
  is_change: boolean;
  help: string;
  likelihood: number | null;
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
  recommended_actions: RecommendedAction[];
  precedents: Precedents | null;
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

export interface CoarseMatch {
  case_id: number;
  score: number;
  matched_axes: string[];
}
