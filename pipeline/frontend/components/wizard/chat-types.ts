export interface ChatMessage {
  id: string;
  role: "bot" | "user";
  text: string;
}

export interface ChipOption {
  value: string;
  label: string;
  /** Shown under the label. The option list is written so the label alone
   * is answerable and this is the recognisable example — "it leaves a
   * hair" rather than "stringing". */
  helpText?: string;
  /** Picking this clears every other pick, and picking anything else
   * clears this. "Nothing unusual" and "new lot just started" contradict
   * each other, and a fingerprint holding both matches both ways. */
  exclusive?: boolean;
}

/** The sentinel behind "Other (describe)…". Never stored: the page swaps
 * it for whatever the W7 mapper places the operator's words on, or for
 * `unmapped` when it can't place them. */
export const OTHER_VALUE = "__other__";

/** Stored as-is. No rule references it, so it adds no evidence, and
 * retrieval drops it rather than scoring it as a mismatch. */
export const DONT_KNOW_VALUE = "dont_know";

/** What "Other (describe)" becomes when the mapper can't place it. */
export const UNMAPPED_VALUE = "unmapped";

/** What the input area at the bottom of the chat currently expects. */
export type PendingPrompt =
  | { kind: "chips-single"; options: ChipOption[] }
  | {
      kind: "chips-multi";
      options: ChipOption[];
      maxPicks?: number;
      confirmLabel: string;
      /** Pre-ticked when the prompt opens — the photo's own reading of
       * axis 1, there to be confirmed or corrected rather than retyped. */
      preselected?: string[];
    }
  | {
      kind: "text";
      placeholder: string;
      confirmLabel: string;
      allowEmpty?: boolean;
      /** A textarea instead of a one-line input. Set wherever the honest
       * answer is an observation rather than a phrase — a single-line
       * input silently swallows the paragraph breaks in a pasted
       * observation, and there is no way to type one in the first place. */
      multiline?: boolean;
    }
  | {
      kind: "text-with-suggestions";
      suggestions: ChipOption[];
      placeholder: string;
      confirmLabel: string;
      skipLabel: string;
      multiline?: boolean;
    }
  | { kind: "photo-or-skip"; skipLabel: string }
  | { kind: "confirm"; options: ChipOption[] }
  | { kind: "none" };

let counter = 0;
export function nextId(): string {
  counter += 1;
  return `m${counter}`;
}
