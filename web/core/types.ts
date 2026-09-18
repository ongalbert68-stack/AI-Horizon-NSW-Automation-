// Shared contract. Everything a prototype needs to run is expressed here, so a
// track (nsw | exa) and an engine (a | b) can be swapped independently.

export type TrackId = "nsw" | "exa";
export type VariantId = "a" | "b";
export type EngineId = "llm-reasoner" | "deterministic";

export interface Question {
  id: string;
  prompt: string;
  kind: "choice" | "multi" | "text" | "number";
  options?: string[];
  help?: string;
  /** True when the engine invented this question in response to earlier answers. */
  dynamic?: boolean;
}

export interface Answer {
  questionId: string;
  prompt: string;
  value: string;
}

/** An observed fact that moves a score. The unit of "evidence-based analysis". */
export interface Evidence {
  label: string;
  detail: string;
  source: "user" | "measurement" | "web" | "prior";
  /** Log-odds contribution. Positive supports, negative argues against. */
  weight: number;
}

/** A measured input that did not come from a question (CV output, web probe). */
export interface Signal {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  note?: string;
}

export interface ScoreDimension {
  id: string;
  label: string;
  stars: number; // 0..5
  score: number; // 0..100
  rationale: string;
}

export interface RankedCause {
  id: string;
  label: string;
  likelihood: number; // 0..1
  reasoning: string;
  evidence: Evidence[];
  checks: string[];
}

export interface ActionStep {
  order: number;
  title: string;
  detail: string;
  phase?: string;
  horizon?: string;
  impact?: string;
}

export interface Analysis {
  headline: string;
  summary: string;
  overall: number; // 0..100
  dimensions: ScoreDimension[];
  causes: RankedCause[];
  actions: ActionStep[];
  signals: Signal[];
  meta: {
    engine: EngineId;
    /** Deterministic engines return identical output for identical input. */
    reproducible: boolean;
    grounded: boolean;
    elapsedMs: number;
    notes: string[];
  };
}

export interface EngineContext {
  track: TrackId;
  answers: Answer[];
  signals: Signal[];
}

export interface Engine {
  id: EngineId;
  label: string;
  /** Returns the next question, or null when the interview has enough to analyse. */
  nextQuestion(ctx: EngineContext): Promise<Question | null>;
  analyze(ctx: EngineContext): Promise<Analysis>;
}
