// NSW Automation domain pack: fluid dispensing defect diagnosis.
//
// Rule justifications are written in process terms rather than model terms, so
// a dispensing engineer can challenge any single weight on its physics.

import type { CauseDef } from "@/core/infer";
import type { Question } from "@/core/types";

export const NSW_QUESTIONS: Question[] = [
  {
    id: "material",
    prompt: "What material is being dispensed?",
    kind: "choice",
    options: ["Epoxy", "Solder paste", "Adhesive", "Silicone sealant", "UV-cure glue", "Other"],
    help: "Thixotropic materials behave differently under shear and temperature.",
  },
  {
    id: "deviation",
    prompt: "How does the dispensed result deviate from target?",
    kind: "choice",
    options: [
      "Too little material",
      "Too much material",
      "Inconsistent size shot to shot",
      "Missing dots",
      "Spreading beyond the required area",
      "Irregular shape or air bubbles",
    ],
  },
  {
    id: "frequency",
    prompt: "Is the defect continuous or occasional?",
    kind: "choice",
    options: [
      "Continuously, on every shot",
      "Occasionally and unpredictably",
      "After the machine has been running for some time",
      "Only on the first shots after idle",
    ],
    help: "Timing separates a steady mechanical restriction from an intermittent one.",
  },
  {
    id: "recent_change",
    prompt: "Has anything changed recently?",
    kind: "choice",
    options: [
      "New material lot or syringe",
      "Nozzle or needle changed",
      "Dispensing parameters adjusted",
      "Scheduled maintenance performed",
      "Nothing has changed",
    ],
  },
  {
    id: "location",
    prompt: "Where does the defect appear?",
    kind: "choice",
    options: [
      "At one location only",
      "Across multiple locations",
      "At random positions",
    ],
    help: "A tip-specific fault is localised; a material or pressure fault is systemic.",
  },
];

/** Scripted follow-ups: the deterministic engine's answer to the bonus challenge. */
export const NSW_FOLLOWUPS: Record<string, Question> = {
  inconsistent: {
    id: "thermal",
    prompt: "Does the inconsistency worsen the longer the machine runs?",
    kind: "choice",
    options: ["Yes, it gets worse over a run", "No, it is the same from the start", "Not sure"],
    help: "Separates thermal thinning of the material from trapped air.",
    dynamic: true,
  },
  missing: {
    id: "recovery",
    prompt: "After a missing dot, does the next shot recover to normal size?",
    kind: "choice",
    options: ["Yes, the next shot is normal", "No, several shots stay undersized", "Not sure"],
    help: "Self-recovery points to air; sustained starvation points to occlusion.",
    dynamic: true,
  },
  spreading: {
    id: "standoff",
    prompt: "Has the needle standoff height been verified since the last nozzle change?",
    kind: "choice",
    options: ["Yes, verified", "No, not verified", "Not sure"],
    dynamic: true,
  },
};

export const NSW_CAUSES: CauseDef[] = [
  {
    id: "air_entrapment",
    label: "Air entrapment in syringe or fluid path",
    prior: 0.3,
    rules: [
      {
        weight: 1.3,
        label: "Intermittent symptom",
        detail:
          "the deviation is occasional rather than continuous, and an air slug passing through the fluid path is one of the few faults that comes and goes; a blockage or a mis-set parameter would deviate on every shot.",
        answer: { id: "frequency", match: ["Occasionally"] },
      },
      {
        weight: -1.2,
        label: "Continuous symptom argues against air",
        detail: "a defect on every single shot is not characteristic of intermittent air slugs.",
        answer: { id: "frequency", match: ["Continuously"] },
      },
      {
        weight: 0.9,
        label: "Shot-to-shot variation",
        detail: "the volume is not repeatable, which is the signature of a compressible void in an otherwise incompressible fluid column.",
        answer: { id: "deviation", match: ["Inconsistent"] },
      },
      {
        weight: 0.6,
        label: "Recent syringe change",
        detail: "a syringe or lot change is the most common point at which air is introduced into the fluid path.",
        answer: { id: "recent_change", match: ["New material lot"] },
      },
      {
        weight: 0.5,
        label: "Randomly distributed",
        detail: "the defect is not tied to one position, so it travels with the fluid rather than the tooling.",
        answer: { id: "location", match: ["random"] },
      },
      {
        weight: 0.8,
        label: "Self-recovering shots",
        detail: "the following shot returns to normal size, which fits a void clearing the orifice rather than a persistent restriction.",
        answer: { id: "recovery", match: ["Yes, the next shot is normal"] },
      },
      {
        weight: 0.9,
        label: "Measured size dispersion above the repeatable band",
        detail: "the measured coefficient of variation across deposits exceeds 15%, which is beyond what a stable pressure-time system produces.",
        signal: { key: "size_cv", gt: 0.15 },
      },
    ],
    checks: [
      "Inspect the syringe barrel against the light for visible voids in the fluid column.",
      "Purge several shots to waste and re-measure repeatability.",
      "Check that the material was centrifuged or degassed before loading.",
      "Verify the piston seal is seated and following the fluid without a gap.",
    ],
  },
  {
    id: "nozzle_blockage",
    label: "Partial nozzle or needle blockage",
    prior: 0.25,
    rules: [
      {
        weight: 1.2,
        label: "Under-dispense",
        detail: "less material than target is reaching the substrate, which a reduced effective orifice produces directly.",
        answer: { id: "deviation", match: ["Too little"] },
      },
      {
        weight: 1.0,
        label: "Missing deposits",
        detail: "complete shot failures occur once an occlusion approaches full restriction.",
        answer: { id: "deviation", match: ["Missing"] },
      },
      {
        weight: -1.0,
        label: "Over-dispense argues against restriction",
        detail: "a restricted orifice cannot deliver more material than commanded.",
        answer: { id: "deviation", match: ["Too much"] },
      },
      {
        weight: 0.8,
        label: "Every shot affected",
        detail: "a partial occlusion restricts flow continuously rather than intermittently.",
        answer: { id: "frequency", match: ["Continuously"] },
      },
      {
        weight: 0.7,
        label: "Degrades over a run",
        detail: "material curing or drying at the tip accumulates progressively during production.",
        answer: { id: "frequency", match: ["After the machine has been running"] },
      },
      {
        weight: 0.9,
        label: "Localised to one position",
        detail: "the fault follows the tooling rather than the material, so it appears only where that tip dispenses.",
        answer: { id: "location", match: ["one location"] },
      },
      {
        weight: 0.8,
        label: "Sustained starvation after a miss",
        detail: "several consecutive shots stay undersized, which fits a persistent restriction rather than a passing void.",
        answer: { id: "recovery", match: ["No, several shots"] },
      },
      {
        weight: 0.7,
        label: "Measured shape irregularity",
        detail: "mean circularity below 0.80 indicates tailing or an asymmetric exit profile consistent with a partially wetted or restricted orifice.",
        signal: { key: "mean_circularity", lt: 0.8 },
      },
    ],
    checks: [
      "Remove the needle and perform a free-air purge to compare flow.",
      "Inspect the tip under magnification for cured material at the orifice.",
      "Replace with a known-good needle of identical gauge and re-test.",
      "Review the tip-wipe interval against the material's open time.",
    ],
  },
  {
    id: "viscosity_change",
    label: "Material viscosity shift",
    prior: 0.25,
    rules: [
      {
        weight: 1.2,
        label: "New material lot",
        detail: "a lot change is the single most common source of a step change in viscosity at constant machine settings.",
        answer: { id: "recent_change", match: ["New material lot"] },
      },
      {
        weight: 1.0,
        label: "Worsens with run time",
        detail: "the fluid path warms during a production run and most epoxies thin measurably with temperature, increasing dispensed volume at fixed pressure and time.",
        answer: { id: "frequency", match: ["After the machine has been running"] },
      },
      {
        weight: 1.0,
        label: "Thermal progression confirmed",
        detail: "the operator confirms the deviation tracks machine run time, which is the defining characteristic of a temperature-driven viscosity shift.",
        answer: { id: "thermal", match: ["Yes, it gets worse"] },
      },
      {
        weight: 0.6,
        label: "Over-dispense",
        detail: "thinner material flows more freely for the same pressure-time command.",
        answer: { id: "deviation", match: ["Too much"] },
      },
      {
        weight: 0.7,
        label: "All positions affected",
        detail: "a bulk material property changes every deposit simultaneously, not one station.",
        answer: { id: "location", match: ["multiple"] },
      },
      {
        weight: 0.4,
        label: "Shear-sensitive material",
        detail: "the material in use is thixotropic, so its apparent viscosity depends on recent shear and rest history.",
        answer: { id: "material", match: ["Epoxy", "Solder paste", "Silicone"] },
      },
    ],
    checks: [
      "Compare the new lot's certificate of analysis against the previous lot.",
      "Record fluid path temperature at the start and after one hour of running.",
      "Confirm the material reached full working temperature before production.",
      "Re-qualify pressure and time against the current lot on a test coupon.",
    ],
  },
  {
    id: "parameter_drift",
    label: "Dispensing pressure or time instability",
    prior: 0.2,
    rules: [
      {
        weight: 1.5,
        label: "Parameters recently adjusted",
        detail: "settings were changed immediately before the defect appeared, making the change itself the leading explanation.",
        answer: { id: "recent_change", match: ["parameters adjusted"] },
      },
      {
        weight: 0.9,
        label: "Consistent on every shot",
        detail: "a mis-set but stable parameter reproduces the same wrong volume every cycle.",
        answer: { id: "frequency", match: ["Continuously"] },
      },
      {
        weight: 0.6,
        label: "Affects all positions",
        detail: "a supply pressure fault is upstream of every dispense location.",
        answer: { id: "location", match: ["multiple"] },
      },
      {
        weight: 0.5,
        label: "Systematic volume error",
        detail: "the volume is wrong in a consistent direction rather than scattered.",
        answer: { id: "deviation", match: ["Too much", "Too little"] },
      },
    ],
    checks: [
      "Log regulator output pressure over several minutes and look for droop.",
      "Compare the active recipe against the last known-good revision.",
      "Check the air supply for water or pressure drop under multi-station demand.",
      "Verify valve open time against the controller's commanded value.",
    ],
  },
  {
    id: "needle_height",
    label: "Incorrect needle standoff height",
    prior: 0.15,
    rules: [
      {
        weight: 1.4,
        label: "Material spreading",
        detail: "a standoff set too low presses the deposit into the substrate and smears it outward past the target area.",
        answer: { id: "deviation", match: ["Spreading"] },
      },
      {
        weight: 1.0,
        label: "Nozzle recently changed",
        detail: "needle length varies between tips, so standoff must be re-qualified after any change.",
        answer: { id: "recent_change", match: ["Nozzle or needle"] },
      },
      {
        weight: 0.9,
        label: "Standoff not verified",
        detail: "height has not been checked since the last tooling change, leaving the most likely geometric cause unexcluded.",
        answer: { id: "standoff", match: ["No, not verified"] },
      },
      {
        weight: 0.5,
        label: "Irregular deposit shape",
        detail: "contact between the needle and a wet deposit distorts its profile.",
        answer: { id: "deviation", match: ["Irregular"] },
      },
      {
        weight: 0.8,
        label: "Measured spreading signature",
        detail: "deposits measure large in area but low in circularity, the geometric signature of a deposit flattened on contact rather than placed.",
        signal: { key: "spread_index", gt: 1.2 },
      },
    ],
    checks: [
      "Measure actual standoff with a feeler gauge against the recipe value.",
      "Re-run the height calibration routine for the affected station.",
      "Confirm substrate thickness and any warp against the fixture datum.",
      "Inspect the needle for a bent or burred tip.",
    ],
  },
  {
    id: "material_condition",
    label: "Material condition, age or temperature",
    prior: 0.18,
    rules: [
      {
        weight: 0.9,
        label: "First-shot deviation after idle",
        detail: "deviation confined to the first shots after a pause points to settling, skinning or separation at the tip during rest.",
        answer: { id: "frequency", match: ["Only on the first shots"] },
      },
      {
        weight: 0.8,
        label: "New material lot",
        detail: "a fresh lot may not have been conditioned to working temperature before use.",
        answer: { id: "recent_change", match: ["New material lot"] },
      },
      {
        weight: 0.6,
        label: "Cold-stored material",
        detail: "solder paste is time and temperature sensitive after removal from cold storage and degrades on a known clock.",
        answer: { id: "material", match: ["Solder paste"] },
      },
    ],
    checks: [
      "Check the material's expiry date and total time out of cold storage.",
      "Confirm the documented thaw and conditioning time was observed in full.",
      "Look for separation or skinning at the top of the syringe.",
      "Introduce a purge routine after any idle period longer than the open time.",
    ],
  },
  {
    id: "equipment_wear",
    label: "Dispensing valve or pump wear",
    prior: 0.1,
    rules: [
      {
        weight: 0.7,
        label: "No process change",
        detail: "nothing in the process was altered, so gradual mechanical drift becomes the leading remaining explanation.",
        answer: { id: "recent_change", match: ["Nothing has changed"] },
      },
      {
        weight: 0.4,
        label: "Persistent on every shot",
        detail: "worn seats or seals shift the delivered volume on every cycle.",
        answer: { id: "frequency", match: ["Continuously"] },
      },
      {
        weight: 0.3,
        label: "Confined to one station",
        detail: "wear is specific to the hardware at the affected position.",
        answer: { id: "location", match: ["one location"] },
      },
    ],
    checks: [
      "Review cycle count against the valve's rebuild interval.",
      "Swap the valve with a known-good unit and compare repeatability.",
      "Inspect seats and seals for wear or material ingress.",
      "Check the maintenance log for overdue scheduled service.",
    ],
  },
];

/** Maps the reported deviation onto a named defect with its expected symptoms. */
export const NSW_DEFECTS: Record<string, { label: string; symptoms: string[] }> = {
  "Too little material": {
    label: "Insufficient Dispensing Volume",
    symptoms: ["Deposits smaller than target", "Weak bond line or incomplete coverage", "Volume below the lower control limit"],
  },
  "Too much material": {
    label: "Excess Dispensing Volume",
    symptoms: ["Deposits larger than target", "Material encroaching on adjacent features", "Volume above the upper control limit"],
  },
  "Inconsistent size shot to shot": {
    label: "Inconsistent Dispensing Volume",
    symptoms: ["Some deposits larger, some smaller", "Results are not repeatable", "Volume scatter exceeds the process window"],
  },
  "Missing dots": {
    label: "Missing Deposit",
    symptoms: ["Expected positions have no material", "Intermittent complete shot failure", "Downstream assembly defects"],
  },
  "Spreading beyond the required area": {
    label: "Excessive Material Spreading",
    symptoms: ["Deposit footprint larger than the pad", "Low deposit height relative to width", "Risk of bridging to adjacent features"],
  },
  "Irregular shape or air bubbles": {
    label: "Irregular Deposit Geometry",
    symptoms: ["Tailing or stringing from the tip", "Visible voids within the deposit", "Asymmetric or non-circular footprint"],
  },
};
