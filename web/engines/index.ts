import type { Engine, VariantId } from "@/core/types";
import { deterministicEngine } from "./deterministic";
import { llmReasonerEngine } from "./llmReasoner";

/** A is the LLM reasoner, B is the deterministic engine. */
export function engineFor(variant: VariantId): Engine {
  return variant === "a" ? llmReasonerEngine : deterministicEngine;
}
