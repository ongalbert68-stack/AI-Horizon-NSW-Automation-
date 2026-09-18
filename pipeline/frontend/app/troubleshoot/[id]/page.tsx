"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";

import { ArtifactPanel, type Artifacts } from "@/components/wizard/artifact-panel";
import { ChatPanel } from "@/components/wizard/chat-panel";
import {
  DONT_KNOW_VALUE, nextId, OTHER_VALUE, UNMAPPED_VALUE,
  type ChatMessage, type ChipOption, type PendingPrompt,
} from "@/components/wizard/chat-types";
import { StageBar, type Phase } from "@/components/wizard/stage-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, ApiError } from "@/lib/api/client";
import { createCheckResult, getCase } from "@/lib/api/cases";
import { updateCase } from "@/lib/api/cases";
import { getIntakeSpec, mapFreeText } from "@/lib/api/intake";
import { rankCase } from "@/lib/api/ranking";
import { getPrecedents } from "@/lib/api/retrieval";
import { closeCase, getReport, verifyCase } from "@/lib/api/report";
import { analysePhoto } from "@/lib/api/vision";
import type {
  Case, CoarseMatch, Fingerprint, FingerprintAxes, Question, Ranking, VisionResult,
} from "@/lib/api/types";

function describeRanking(ranking: Ranking): string {
  const top = ranking.pass1[0];
  const pct = Math.round(top.likelihood * 100);
  switch (ranking.tier) {
    case "T1":
      return (
        `Tier T1 — a clear lead: ${top.label} at ${pct}%. The rule engine and a second, ` +
        "independent read agree, the evidence beats chance, and past confirmed cases back it up."
      );
    case "T2": {
      // Nothing fired at all: every cause sits on the shared prior, and
      // the "lead" would just be whichever one the vocabulary lists
      // first. Saying so is the honest output — DESIGN.md's own argument
      // for T4 applies here too.
      const fired = ranking.pass1.filter((c) => c.evidence.length > 0).length;
      if (fired === 0) {
        return (
          "No cause is ahead: nothing you told me, and nothing in the photo, matches any of " +
          "the rules in the tree — so all seven candidates are sitting on the same starting " +
          "odds. That usually means the defect is real but outside what this tree models. A " +
          "troubleshooting check is the fastest way forward, and it's worth telling an " +
          "engineer the list came up empty."
        );
      }
      return (
        `Tier T2 — a likely lead: ${top.label} at ${pct}%, but it isn't backed by a strong ` +
        "measurement or precedent yet — see the panel on the right for why."
      );
    }
    case "T3":
      return (
        `Tier T3 — the rule engine and a second, independent read disagree, but the ` +
        `measurement still points to ${top.label} at ${pct}%. See the panel on the right for ` +
        "the breakdown of what each one said."
      );
    default:
      return (
        `No lead cause yet — the rule engine says ${top.label} at ${pct}%, but a second, ` +
        "independent read of your complaint picked a different one, and the measurement that " +
        "would break the tie isn't strong enough to trust on its own. See the panel on the " +
        "right for what each one said. A troubleshooting check will settle it faster than more " +
        "questions would."
      );
  }
}

/** Which axis question is still unanswered, in interview order — `null`
 * once all five are in. Used both to resume mid-interview after a reload
 * and (implicitly) to know when the interview is complete. */
interface SuggestedCheck {
  name: string;
  /** Does running this alter the machine, tooling or material? Only
   * changes count toward `action_count`, and step 8 can only close
   * CONFIRMED when exactly one thing was changed — so the loop has to
   * know which of its own suggestions are changes. */
  isChange: boolean;
  help: string;
}

/** Two suggestions per cause: something to *look at*, and something to
 * *change*. The remedies are the "Response: X helps" actions already
 * cited in ranking/rules.py; the observations are the cheap, reversible
 * way to test the same cause without spending the case's one change.
 *
 * Offering only the remedy — which is what this map used to hold — meant
 * the loop's own advice was "change something, then tell us if the
 * symptom went away", which is the post-hoc credit assignment DESIGN.md's
 * step 8 exists to keep out of the database.
 *
 * Per DESIGN.md W4: never invent a parameter number, so pressure/time
 * gets the "small steps, engineer to confirm" phrasing. */
const CHECK_SUGGESTIONS: Record<string, SuggestedCheck[]> = {
  volume_too_small_carryover: [
    { name: "Check the next dot after each small one", isChange: false, help: "is it oversized? that's the carryover signature" },
    { name: "Purge and re-prime the syringe", isChange: true, help: "changes the fluid path" },
  ],
  pressure_time_instability: [
    { name: "Watch the pressure gauge across 20 shots", isChange: false, help: "look for it wandering, not just the set value" },
    { name: "Adjust pressure or shot time in small steps within your process spec", isChange: true, help: "engineer to confirm the figure" },
  ],
  air_in_fluid_path: [
    { name: "Hold the syringe up to the light", isChange: false, help: "look for bubbles or a slug in the barrel" },
    { name: "Purge the line, or swap in a fresh syringe", isChange: true, help: "changes the material supply" },
  ],
  material_rheology_change: [
    { name: "Check the lot date and out-time against spec", isChange: false, help: "reading the label costs nothing" },
    { name: "Let the material warm up to spec temperature", isChange: true, help: "changes the material condition" },
  ],
  nozzle_blockage: [
    { name: "Look at the needle tip under a loupe", isChange: false, help: "partial blockage is usually visible" },
    { name: "Wipe or change the needle", isChange: true, help: "changes the tooling" },
  ],
  dispense_height_or_board_bending: [
    { name: "Measure standoff at the corners and the centre", isChange: false, help: "a bent board reads differently across it" },
    { name: "Re-check dispense height and board clamping", isChange: true, help: "changes the setup" },
  ],
  equipment_condition: [
    { name: "Inspect the valve and mounting for wear or residue", isChange: false, help: "look before touching" },
    { name: "Restart or re-home the machine", isChange: true, help: "changes the machine state" },
  ],
};

/** The sentinel behind "Something else — I'll describe my own check" at the
 * cause step. Never sent: it drops `cause_id` from the draft, and the check
 * is logged with a null cause.
 *
 * A check filed against no cause is recorded on the case and shown in the
 * loop log, but it moves nothing in the ranking — the re-rank only folds in
 * outcomes whose `cause_id` is one of the ranked causes (see
 * ranking/service.py `_apply_check_results`). That's the honest behaviour,
 * and the chip says so rather than letting the operator find out by
 * watching the bars not move. */
const OWN_CHECK_VALUE = "__own_check__";

/** "Don't know" and "Other (describe)" are appended to every axis from
 * `has_dont_know` / `has_other`, which the API has always reported and
 * the UI used to ignore — leaving no way to answer a question the
 * operator genuinely can't, so the only way forward was a guess that
 * then entered the fingerprint as fact. */
function toChips(q: Question, opts: { includeEscapes?: boolean } = {}): ChipOption[] {
  const chips: ChipOption[] = q.options.map((o) => ({
    value: o.value, label: o.label, helpText: o.help_text, exclusive: o.exclusive,
  }));
  if (opts.includeEscapes === false) return chips;
  if (q.has_dont_know) {
    chips.push({
      value: DONT_KNOW_VALUE, label: "Don't know",
      helpText: "adds no evidence — better than a guess", exclusive: true,
    });
  }
  if (q.has_other) {
    chips.push({
      value: OTHER_VALUE, label: "Other (describe)…",
      helpText: "say it in your own words", exclusive: true,
    });
  }
  return chips;
}

function nextUnansweredAxis(axes: FingerprintAxes | undefined):
  | "ask_signature" | "ask_trajectory" | "ask_footprint" | "ask_inputs" | "ask_response" | null {
  if (!axes || axes.signature.length === 0) return "ask_signature";
  if (!axes.trajectory) return "ask_trajectory";
  if (!axes.footprint) return "ask_footprint";
  if (axes.inputs.length === 0) return "ask_inputs";
  if (!axes.response) return "ask_response";
  return null;
}

type StepId =
  | "intro" | "ask_photo" | "analyse_photo"
  | "ask_signature" | "ask_trajectory" | "ask_footprint" | "ask_inputs" | "ask_response"
  | "ask_axis_other" | "save_fingerprint" | "retrieve_coarse" | "rank" | "loop_prompt"
  | "loop_check_name" | "loop_check_cause" | "loop_check_kind" | "loop_check_outcome"
  | "loop_check_detail" | "loop_submit"
  | "report" | "verify_prompt" | "verify_photo" | "close_prompt" | "close" | "done";

const INTERVIEW_HINT = "Answer on the left. Five questions, and \"Don't know\" is a real answer.";

const STAGE_HINTS: Record<StepId, Phase> = {
  intro: { n: 1, label: "Photo", hint: "Getting the case set up…" },
  // The photo is asked first: it measures the things an operator is worst
  // at eyeballing, it's one tap, and it's the only evidence that can
  // clear Gate A's chance test — so asking it last meant every case was
  // ranked without it (DESIGN.md W3's "skip what the photo answers").
  ask_photo: { n: 1, label: "Photo", hint: "A photo of the deposits measures the defect for you, and fills in the first question. Optional — skip it and we'll just ask." },
  analyse_photo: { n: 1, label: "Photo", hint: "Measuring the deposits…" },
  ask_signature: { n: 2, label: "Interview", hint: INTERVIEW_HINT },
  ask_trajectory: { n: 2, label: "Interview", hint: INTERVIEW_HINT },
  ask_footprint: { n: 2, label: "Interview", hint: INTERVIEW_HINT },
  ask_inputs: { n: 2, label: "Interview", hint: INTERVIEW_HINT },
  ask_response: { n: 2, label: "Interview", hint: INTERVIEW_HINT },
  ask_axis_other: { n: 2, label: "Interview", hint: "Describe it in your own words — we'll file it against the closest option, or keep it as-is." },
  save_fingerprint: { n: 2, label: "Interview", hint: "Saving your answers…" },
  retrieve_coarse: { n: 2, label: "Interview", hint: "Checking for similar past cases…" },
  rank: { n: 3, label: "Ranking", hint: "Comparing candidate causes against your answers and the photo." },
  loop_prompt: { n: 4, label: "Troubleshooting", hint: "Log a check to test the top candidate cause, or move straight to the report if you're confident." },
  loop_check_cause: { n: 4, label: "Troubleshooting", hint: "Pick which candidate cause you want to test, or describe a check of your own." },
  loop_check_name: { n: 4, label: "Troubleshooting", hint: "Look at something first if you can — it costs nothing and doesn't spend the one change the case is allowed." },
  loop_check_kind: { n: 4, label: "Troubleshooting", hint: "Did you change anything, or only look? Only changes are counted against the case." },
  loop_check_outcome: { n: 4, label: "Troubleshooting", hint: "Say what happened — this re-ranks the causes." },
  loop_check_detail: { n: 4, label: "Troubleshooting", hint: "Add any detail worth keeping, or leave it blank." },
  loop_submit: { n: 4, label: "Troubleshooting", hint: "Logging the check and re-ranking…" },
  report: { n: 5, label: "Report", hint: "Compiling the findings…" },
  verify_prompt: { n: 5, label: "Report", hint: "Optionally attach a fresh photo to confirm the fix held, or skip straight to closing." },
  verify_photo: { n: 5, label: "Report", hint: "Re-measuring from the new photo…" },
  close_prompt: { n: 6, label: "Close", hint: "Confirm to close the case and record the outcome." },
  close: { n: 6, label: "Close", hint: "Closing the case…" },
  done: { n: 6, label: "Close", hint: "Case closed — see the summary on the right." },
};

export default function CaseWizardPage() {
  const params = useParams<{ id: string }>();
  const caseId = Number(params.id);

  const [loading, setLoading] = React.useState(true);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [pending, setPending] = React.useState<PendingPrompt>({ kind: "none" });
  const [busy, setBusy] = React.useState(false);
  const [artifacts, setArtifacts] = React.useState<Artifacts | null>(null);
  const [phase, setPhase] = React.useState<Phase>(STAGE_HINTS.intro);

  const questionsRef = React.useRef<Question[]>([]);
  const axesRef = React.useRef<Partial<FingerprintAxes>>({});
  /** Raw "Other (describe)" words per axis, kept whether or not the W7
   * mapper could place them on a real option. */
  const axisNotesRef = React.useRef<Record<string, string>>({});
  /** Which axis the pending free-text answer belongs to. */
  const otherAxisRef = React.useRef<string | null>(null);
  const draftCheckRef = React.useRef<{
    check_name?: string; cause_id?: string; outcome?: string; is_change?: boolean;
  }>({});
  const artifactsRef = React.useRef<Artifacts | null>(null);
  const currentStepRef = React.useRef<StepId>("intro");

  function setStage(step: StepId) {
    currentStepRef.current = step;
    setPhase(STAGE_HINTS[step]);
  }

  function say(text: string) {
    setMessages((prev) => [...prev, { id: nextId(), role: "bot", text }]);
  }
  function echo(text: string) {
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text }]);
  }
  function patchArtifacts(patch: Partial<Artifacts>) {
    setArtifacts((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      artifactsRef.current = next;
      return next;
    });
  }

  /** Saves whatever's in axesRef so far — fired after every answer, not
   * just at the end of the interview, so a reload mid-interview resumes
   * instead of losing the answers already given. Best-effort: a failure
   * here just means the next answer (or the final save) retries it. */
  async function persistAxes(caseId: number) {
    try {
      const fingerprint: Fingerprint = {
        axes: {
          signature: axesRef.current.signature ?? [],
          trajectory: axesRef.current.trajectory ?? null,
          footprint: axesRef.current.footprint ?? null,
          inputs: axesRef.current.inputs ?? [],
          response: axesRef.current.response ?? null,
        },
        signals: {},
        axis_notes: { ...axisNotesRef.current },
      };
      await updateCase(caseId, { fingerprint });
      patchArtifacts({ axes: { ...axesRef.current }, axisNotes: { ...axisNotesRef.current } });
    } catch {
      // best-effort — see comment above
    }
  }

  async function runStep(step: StepId, caseData: Case, arg?: unknown) {
    setStage(step);
    switch (step) {
      case "intro": {
        say(
          `Opened case #${caseData.case_id} on ${caseData.station.name}, running ${caseData.profile.name} ` +
            `(${caseData.profile.material.name}). Let's find out what's wrong.`,
        );
        return runStep("ask_photo", caseData);
      }

      case "ask_photo": {
        say(
          "First: can you photograph the deposits? It measures the size spread, shape and any " +
            "missing dots, and answers the first question for you. Skip it if you can't — " +
            "everything still runs on the answers alone.",
        );
        setPending({ kind: "photo-or-skip", skipLabel: "Skip — no photo" });
        return;
      }

      case "analyse_photo": {
        const file = arg as File;
        setBusy(true);
        try {
          const url = URL.createObjectURL(file);
          patchArtifacts({ photoUrl: url });
          echo(`[attached ${file.name}]`);
          say("Measuring…");
          const vision = await analysePhoto(caseData.case_id, file);
          patchArtifacts({ vision });
          say(
            vision.quality_ok
              ? `Measured it — the deviation is ${vision.magnitude}.`
              : `Couldn't measure it reliably: ${vision.quality_reason} Continuing on the answers alone.`,
          );
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Could not analyse the photo.");
        } finally {
          setBusy(false);
        }
        return runStep("ask_signature", caseData);
      }

      case "ask_signature": {
        const q = questionsRef.current.find((x) => x.id === "signature")!;
        // What the photo measured, pre-ticked for the operator to confirm
        // or correct. Confirming costs one tap; disagreeing is itself
        // evidence, which is why the measurement is never just written in.
        const suggested = artifactsRef.current?.vision?.suggested_signature ?? [];
        const preselected = suggested.filter((v) => q.options.some((o) => o.value === v));
        say(
          preselected.length > 0
            ? `${q.prompt}\n\nI've ticked what the photo measured — change it if that's not what you see.`
            : q.prompt,
        );
        setPending({
          kind: "chips-multi", options: toChips(q), maxPicks: q.max_picks ?? undefined,
          confirmLabel: preselected.length > 0 ? "That's right" : "Confirm",
          preselected,
        });
        return;
      }
      case "ask_trajectory": {
        const q = questionsRef.current.find((x) => x.id === "trajectory")!;
        say(q.prompt);
        setPending({ kind: "chips-single", options: toChips(q) });
        return;
      }
      case "ask_footprint": {
        const q = questionsRef.current.find((x) => x.id === "footprint")!;
        say(q.prompt);
        setPending({ kind: "chips-single", options: toChips(q) });
        return;
      }
      case "ask_inputs": {
        const q = questionsRef.current.find((x) => x.id === "inputs")!;
        say(q.prompt);
        setPending({ kind: "chips-multi", options: toChips(q), confirmLabel: "Confirm" });
        return;
      }
      case "ask_response": {
        const q = questionsRef.current.find((x) => x.id === "response")!;
        say(q.prompt);
        setPending({ kind: "chips-single", options: toChips(q) });
        return;
      }

      case "ask_axis_other": {
        const axisId = otherAxisRef.current;
        const q = axisId ? questionsRef.current.find((x) => x.id === axisId) : undefined;
        say(q ? `In your own words: ${q.prompt.toLowerCase()}` : "Describe it in your own words.");
        setPending({
          kind: "text", placeholder: "e.g. it leaves a hair between the pads",
          confirmLabel: "Next", multiline: true,
        });
        return;
      }

      case "save_fingerprint": {
        setBusy(true);
        try {
          await persistAxes(caseData.case_id);
          say("Recorded.");
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Could not save the answers.");
        } finally {
          setBusy(false);
        }
        return runStep("retrieve_coarse", caseData);
      }

      case "retrieve_coarse": {
        setBusy(true);
        try {
          const matches = await apiRequest<CoarseMatch[]>(`/cases/${caseData.case_id}/retrieval/coarse`);
          patchArtifacts({ coarse: matches });
          // The same matches, tallied by what they were diagnosed as.
          // Best-effort and separate from the ranking on purpose — it is
          // shown as context and feeds nothing.
          try {
            const precedents = await getPrecedents(caseData.case_id);
            patchArtifacts({ precedents });
            if (precedents.sentence) say(precedents.sentence);
          } catch {
            // no history endpoint or no history — the panel just stays empty
          }
          // Says what it matched on, and claims nothing else: this step
          // orders the interview and reads past cases. It does not feed
          // the ranking, and it does not pre-load the checklist — the
          // loop's suggestions come from the cause's own cited remedies.
          say(
            matches.length === 0
              ? "No similar past cases on file yet."
              : `Found ${matches.length} similar past case(s), matching on ` +
                `${[...new Set(matches.flatMap((m) => m.matched_axes))].join(", ")} — ` +
                "listed on the right. They don't move the ranking.",
          );
        } catch {
          patchArtifacts({ coarse: [] });
        } finally {
          setBusy(false);
        }
        return runStep("rank", caseData);
      }

      case "rank": {
        setBusy(true);
        say("Ranking causes…");
        try {
          const ranking = await rankCase(caseData.case_id);
          patchArtifacts({ ranking });
          say(describeRanking(ranking));
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Could not rank causes.");
        } finally {
          setBusy(false);
        }
        return runStep("loop_prompt", caseData);
      }

      case "loop_prompt": {
        say("Want to log a troubleshooting check, or move on to the report?");
        setPending({
          kind: "confirm",
          options: [{ value: "log", label: "Log a check" }, { value: "report", label: "Continue to report" }],
        });
        return;
      }

      case "loop_check_cause": {
        const ranking = artifactsRef.current?.ranking;
        // Every ranked cause, not just the top four: the list is ordered by
        // likelihood, and hiding the tail meant the only way to test a
        // long-shot was to not log the check at all.
        const options: ChipOption[] = (ranking?.pass1 ?? []).map((c, i) => ({
          value: c.cause_id,
          label: c.label,
          helpText: `${Math.round(c.likelihood * 100)}%${i === 0 ? " · currently ahead" : ""}`,
        }));
        options.push({
          value: OWN_CHECK_VALUE,
          label: "Something else — I'll describe my own check",
          helpText: "logged on the case, but it moves no cause's ranking",
          exclusive: true,
        });
        say(
          "Which candidate cause do you want to test? Or describe your own check — it gets " +
            "logged on the case either way.",
        );
        setPending({ kind: "chips-single", options });
        return;
      }
      case "loop_check_name": {
        const causeId = draftCheckRef.current.cause_id;
        const suggestions = (causeId ? CHECK_SUGGESTIONS[causeId] : undefined) ?? [];
        say(
          suggestions.length > 0
            ? "Two ways to test that — the first only looks, the second changes something. " +
                "The case can only close CONFIRMED if exactly one thing was changed, so start " +
                "with the look if you can. Or describe your own."
            : causeId
              ? "What did you try, or want to try?"
              : "Describe the check in your own words — what did you do, or what do you want to do?",
        );
        setPending({
          kind: "text-with-suggestions",
          suggestions: suggestions.map((s) => ({ value: s.name, label: s.name, helpText: s.help })),
          placeholder: "e.g. purge and re-prime",
          confirmLabel: "Next",
          skipLabel: "Not sure — skip this check",
          multiline: true,
        });
        return;
      }

      case "loop_check_kind": {
        // Only reached for a check the operator typed themselves: the
        // suggestions already declare which of them is a change, so
        // tapping one skips this question entirely.
        say("Did that change anything on the machine, or did you only look?");
        setPending({
          kind: "chips-single",
          options: [
            { value: "observe", label: "Only looked", helpText: "nothing altered — costs the case nothing" },
            { value: "change", label: "I changed something", helpText: "tooling, material, pressure, program…" },
          ],
        });
        return;
      }
      case "loop_check_outcome": {
        say("What happened?");
        setPending({
          kind: "chips-single",
          options: [
            { value: "confirms", label: "Confirms it" },
            { value: "rules_out", label: "Rules it out" },
            { value: "inconclusive", label: "Inconclusive" },
          ],
        });
        return;
      }
      case "loop_check_detail": {
        say("Any detail worth recording? (optional)");
        setPending({
          kind: "text",
          placeholder:
            "e.g. air slug expelled\n\nParagraphs are fine — paste the full observation if you have one.",
          confirmLabel: "Log it", allowEmpty: true, multiline: true,
        });
        return;
      }
      case "loop_submit": {
        setBusy(true);
        try {
          const detail = arg as string;
          const causeId = draftCheckRef.current.cause_id ?? null;
          const updated = await createCheckResult(caseData.case_id, {
            check_name: draftCheckRef.current.check_name!,
            cause_id: causeId,
            cost_minutes: null, invasive: false, safety_note: null,
            is_change: draftCheckRef.current.is_change ?? false,
            outcome: draftCheckRef.current.outcome as "confirms" | "rules_out" | "inconclusive",
            result_detail: detail || null,
          });
          const refreshed = await getCase(caseData.case_id);
          patchArtifacts({ ranking: updated, checks: refreshed.check_results, caseData: refreshed });
          const actionNote =
            refreshed.action_count === 1
              ? "One change on the case so far, which is what CONFIRMED needs."
              : refreshed.action_count === 0
                ? "Nothing changed yet, so nothing is spent."
                : `${refreshed.action_count} changes on the case now — it can't close CONFIRMED.`;
          say(
            causeId
              ? `Logged — re-ranked. Top candidate now: ${updated.pass1[0].label} at ` +
                  `${Math.round(updated.pass1[0].likelihood * 100)}%. ${actionNote}`
              : // No cause to fold the outcome into, so the ranking is
                // untouched. Saying "re-ranked" here would claim an update
                // the operator can see didn't happen.
                "Logged on the case. It isn't tied to one of the ranked causes, so the ranking is " +
                  `unchanged — still ${updated.pass1[0].label} at ` +
                  `${Math.round(updated.pass1[0].likelihood * 100)}%. ${actionNote}`,
          );
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Could not log the check.");
        } finally {
          setBusy(false);
          draftCheckRef.current = {};
        }
        return runStep("loop_prompt", caseData);
      }

      case "report": {
        setBusy(true);
        say("Compiling the report…");
        try {
          const report = await getReport(caseData.case_id, true);
          patchArtifacts({ report });
          say(report.explanation ?? "Report ready — see the panel.");
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Could not compile the report.");
        } finally {
          setBusy(false);
        }
        setStage("verify_prompt");
        say("Want to verify the fix with a fresh photo?");
        setPending({ kind: "photo-or-skip", skipLabel: "Skip verification" });
        return;
      }

      case "verify_photo": {
        const file = arg as File;
        setBusy(true);
        try {
          const verification = await verifyCase(caseData.case_id, file, 30);
          const currentReport = artifactsRef.current?.report ?? null;
          patchArtifacts({ report: currentReport ? { ...currentReport, verification } : currentReport });
          say(
            verification.in_spec
              ? `Re-measured: ${verification.before ?? "—"} → ${verification.after ?? "—"}, back in spec.`
              : `Re-measured: ${verification.before ?? "—"} → ${verification.after ?? "—"}, still not in spec.`,
          );
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Could not verify.");
        } finally {
          setBusy(false);
        }
        return runStep("close_prompt", caseData);
      }

      case "close_prompt": {
        say("Ready to close the case?");
        setPending({ kind: "confirm", options: [{ value: "close", label: "Close the case" }] });
        return;
      }
      case "close": {
        setBusy(true);
        try {
          const result = await closeCase(caseData.case_id);
          patchArtifacts({ close: result });
          // "Closed" on its own gets read as "fixed". It isn't: the tier is
          // a verdict on what was proved, and only CONFIRMED claims the
          // repair worked — so the message says which one this is.
          say(
            result.gaps.length === 0
              ? `Closed as ${result.tier}. All five conditions were met — the cause was confirmed by a ` +
                  "check, exactly one thing was changed, and the re-measurement came back in spec and held. " +
                  "This case counts as fixed and proved."
              : `Closed as ${result.tier} — that records what was proved, not that it's fixed. ` +
                  `Still open: ${result.gaps.join("; ")}.`,
          );
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Could not close the case.");
        } finally {
          setBusy(false);
        }
        setStage("done");
        setPending({ kind: "none" });
        return;
      }

      default:
        return;
    }
  }

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([getCase(caseId), getIntakeSpec()])
      .then(([caseData, questions]) => {
        if (cancelled) return;
        questionsRef.current = questions;

        const axes = caseData.fingerprint?.axes;
        axesRef.current = axes ? { ...axes } : {};
        axisNotesRef.current = { ...(caseData.fingerprint?.axis_notes ?? {}) };

        // Hydrate from whatever the case already has on file — a reload or
        // a "Continue troubleshooting" link both land here with a case
        // that may already be partway through the pipeline, and the panel
        // (and the resume point below) need to reflect that, not blank.
        // The backend stores a reduced subset onto case.vision_result — the
        // signals it derived live on in fingerprint.signals instead (the
        // canonical place for them), so a resume has to recombine the two
        // rather than casting vision_result straight to VisionResult.
        const storedVision = caseData.vision_result as Omit<VisionResult, "signals" | "small_then_big_above_chance"> | null;
        const numericSignals = Object.fromEntries(
          Object.entries(caseData.fingerprint?.signals ?? {}).filter(
            (entry): entry is [string, number] => typeof entry[1] === "number",
          ),
        );
        const vision: VisionResult | null = storedVision
          ? { ...storedVision, signals: numericSignals, small_then_big_above_chance: false }
          : null;

        const initial: Artifacts = {
          caseData, photoUrl: null,
          questions,
          axes: axes ?? {},
          axisNotes: { ...axisNotesRef.current },
          vision,
          coarse: null,
          precedents: null,
          ranking: caseData.ranking,
          comparison: null,
          checks: caseData.check_results,
          report: null,
          close: caseData.tier ? { tier: caseData.tier, gaps: [] } : null,
        };
        artifactsRef.current = initial;
        setArtifacts(initial);
        setLoading(false);

        // Resuming past the retrieval step (or landing on a closed case)
        // skips runStep("retrieve_coarse"), so the history card would only
        // ever appear on a first run through. Fetch it here too.
        if (axes) {
          void getPrecedents(caseId)
            .then((precedents) => {
              if (!cancelled) patchArtifacts({ precedents });
            })
            .catch(() => {
              // no history yet — the card stays hidden
            });
        }

        const hasProgress =
          Boolean(caseData.closed_at) || Boolean(caseData.ranking) || Boolean(caseData.vision_result) ||
          Boolean(axes && (axes.signature.length > 0 || axes.trajectory || axes.footprint
            || axes.inputs.length > 0 || axes.response));

        if (!hasProgress) {
          void runStep("intro", caseData);
          return;
        }

        // Resuming a case that already has something on file. Rather than
        // one generic "you already answered these" line, replay each
        // question/answer pair that's actually on record — the transcript
        // should show your own prior replies, not just the bot's recap of
        // them — then pick up at the first step that isn't already done.
        say(
          `Welcome back to case #${caseData.case_id} on ${caseData.station.name}, running ` +
            `${caseData.profile.name} (${caseData.profile.material.name}).`,
        );

        const axisOrder: { id: "signature" | "trajectory" | "footprint" | "inputs" | "response"; value: string[] | string | undefined }[] = [
          { id: "signature", value: axes?.signature && axes.signature.length > 0 ? axes.signature : undefined },
          { id: "trajectory", value: axes?.trajectory ?? undefined },
          { id: "footprint", value: axes?.footprint ?? undefined },
          { id: "inputs", value: axes?.inputs && axes.inputs.length > 0 ? axes.inputs : undefined },
          { id: "response", value: axes?.response ?? undefined },
        ];
        for (const a of axisOrder) {
          if (a.value === undefined) break; // answered in order — stop at the first gap
          const q = questionsRef.current.find((x) => x.id === a.id);
          if (!q) continue;
          say(q.prompt);
          echo(Array.isArray(a.value) ? a.value.map((v) => labelFor(a.id, v)).join(", ") : labelFor(a.id, a.value));
        }

        // A closed case is reopened into the loop rather than dead-ended.
        // It used to stop here with "already closed" and no prompt, so
        // every "reopen" affordance on the case page led to a screen that
        // could do nothing. Nothing in the pipeline forbids continuing:
        // check-results still log and re-rank, and close re-scores the
        // case against step 8's five conditions from scratch.
        if (caseData.closed_at) {
          const closedNote = caseData.tier
            ? `This case was closed as ${caseData.tier}.`
            : "This case was closed.";
          say(
            `${closedNote} You can log another check — it re-ranks the causes, and closing again ` +
              "re-scores the case on what's been proved by then.",
          );
          void runStep("loop_prompt", caseData);
          return;
        }
        if (caseData.verification) {
          say("Verification is already on file. Ready to close whenever you are.");
          void runStep("close_prompt", caseData);
          return;
        }
        if (caseData.ranking) {
          const checkNote = caseData.check_results.length > 0
            ? ` ${caseData.check_results.length} check(s) already logged.`
            : "";
          say(`Ranking is already done — tier ${caseData.ranking.tier}.${checkNote} You can log another check or revisit the report.`);
          void runStep("loop_prompt", caseData);
          return;
        }
        // Resume points follow the pipeline's own order, which now runs
        // photo -> interview -> retrieval -> rank.
        const nextAxis = nextUnansweredAxis(axes);
        if (nextAxis === null) {
          void runStep("retrieve_coarse", caseData);
          return;
        }
        if (!caseData.vision_result) {
          say("We never got as far as a photo — want to add one now? It answers the first question for you.");
          setStage("ask_photo");
          setPending({ kind: "photo-or-skip", skipLabel: "Skip — no photo" });
          return;
        }
        say("Picking up where we left off.");
        void runStep(nextAxis, caseData);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Could not load the case."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  function requireCase(): Case | null {
    return artifactsRef.current?.caseData ?? null;
  }

  /** The single-select axes, in interview order, with where each one goes
   * next. Kept as data so "Other (describe)" can bounce out to a text
   * prompt and come back to the right place. */
  const SINGLE_AXIS_FLOW: Record<string, { axis: "trajectory" | "footprint" | "response"; next: StepId }> = {
    ask_trajectory: { axis: "trajectory", next: "ask_footprint" },
    ask_footprint: { axis: "footprint", next: "ask_inputs" },
    ask_response: { axis: "response", next: "save_fingerprint" },
  };

  function handleChipSingle(value: string) {
    const caseData = requireCase();
    if (!caseData) return;
    const step = currentStepRef.current;

    const single = SINGLE_AXIS_FLOW[step];
    if (single) {
      if (value === OTHER_VALUE) {
        otherAxisRef.current = single.axis;
        echo("Other (describe)…");
        void runStep("ask_axis_other", caseData);
        return;
      }
      axesRef.current[single.axis] = value;
      echo(labelFor(single.axis, value));
      void persistAxes(caseData.case_id);
      void runStep(single.next, caseData);
      return;
    }

    if (step === "loop_check_kind") {
      draftCheckRef.current.is_change = value === "change";
      echo(value === "change" ? "I changed something" : "Only looked");
      void runStep("loop_check_outcome", caseData);
      return;
    }
    if (step === "loop_prompt") {
      echo(value === "log" ? "Log a check" : "Continue to report");
      void runStep(value === "log" ? "loop_check_cause" : "report", caseData);
      return;
    }
    if (step === "loop_check_cause") {
      if (value === OWN_CHECK_VALUE) {
        // No cause_id at all, rather than one picked to have something to
        // send. The backend takes a null cause_id, and a check filed under
        // a cause nobody tested would put fake evidence on that cause.
        draftCheckRef.current.cause_id = undefined;
        echo("Something else — I'll describe my own check");
        void runStep("loop_check_name", caseData);
        return;
      }
      draftCheckRef.current.cause_id = value;
      const label = artifactsRef.current?.ranking?.pass1.find((c) => c.cause_id === value)?.label ?? value;
      echo(label);
      void runStep("loop_check_name", caseData);
      return;
    }
    if (step === "loop_check_outcome") {
      draftCheckRef.current.outcome = value;
      echo(value.replaceAll("_", " "));
      void runStep("loop_check_detail", caseData);
      return;
    }
    if (step === "close_prompt") {
      echo("Close the case");
      void runStep("close", caseData);
      return;
    }
  }

  function handleChipsMulti(values: string[]) {
    const caseData = requireCase();
    if (!caseData) return;
    const step = currentStepRef.current;
    const axis = step === "ask_signature" ? "signature" : step === "ask_inputs" ? "inputs" : null;
    if (!axis) return;
    const next: StepId = axis === "signature" ? "ask_trajectory" : "ask_response";

    // "Other" is exclusive, so it can only arrive alone.
    if (values.includes(OTHER_VALUE)) {
      otherAxisRef.current = axis;
      echo("Other (describe)…");
      void runStep("ask_axis_other", caseData);
      return;
    }

    axesRef.current[axis] = values;
    echo(values.map((v) => labelFor(axis, v)).join(", "));
    void persistAxes(caseData.case_id);
    void runStep(next, caseData);
  }

  /** The "Other (describe)" landing: try to place the words on a real
   * option (W7 call-1), and say which one, because an operator who can't
   * see where their words went can't correct it. If it won't map, the
   * words are kept and the axis is marked `unmapped` — retrieval then
   * drops that axis instead of scoring it as a mismatch. */
  async function resolveOtherText(caseData: Case, axisId: string, text: string) {
    axisNotesRef.current = { ...axisNotesRef.current, [axisId]: text };
    const isMulti = axisId === "signature" || axisId === "inputs";
    setBusy(true);
    let mapped: string | null = null;
    try {
      const result = await mapFreeText({ case_id: caseData.case_id, question_id: axisId, text });
      mapped = result.mapped_value;
    } catch {
      mapped = null; // offline or no LLM — fall through to unmapped
    } finally {
      setBusy(false);
    }

    const stored = mapped ?? UNMAPPED_VALUE;
    if (isMulti) axesRef.current[axisId as "signature" | "inputs"] = [stored];
    else axesRef.current[axisId as "trajectory" | "footprint" | "response"] = stored;

    say(
      mapped
        ? `Filed that as "${labelFor(axisId, mapped)}" — your words are kept on the case either way.`
        : "Nothing in the list matches that, so I've kept your words as-is and left this " +
            "question out of the past-case matching rather than guessing.",
    );
    await persistAxes(caseData.case_id);
    otherAxisRef.current = null;

    const nextStep: StepId =
      axisId === "signature" ? "ask_trajectory"
        : axisId === "trajectory" ? "ask_footprint"
          : axisId === "footprint" ? "ask_inputs"
            : axisId === "inputs" ? "ask_response"
              : "save_fingerprint";
    void runStep(nextStep, caseData);
  }

  function handleText(value: string) {
    const caseData = requireCase();
    if (!caseData) return;
    const step = currentStepRef.current;

    if (step === "ask_axis_other") {
      const axisId = otherAxisRef.current;
      if (!axisId) return;
      echo(value);
      void resolveOtherText(caseData, axisId, value);
      return;
    }
    if (step === "loop_check_name") {
      draftCheckRef.current.check_name = value;
      echo(value);
      // A tapped suggestion already says whether it changes anything;
      // anything typed has to be asked, because guessing it wrong either
      // fabricates a change or hides one, and step 8 rests on the count.
      const suggested = (CHECK_SUGGESTIONS[draftCheckRef.current.cause_id ?? ""] ?? [])
        .find((s) => s.name === value);
      if (suggested) {
        draftCheckRef.current.is_change = suggested.isChange;
        void runStep("loop_check_outcome", caseData);
      } else {
        void runStep("loop_check_kind", caseData);
      }
      return;
    }
    if (step === "loop_check_detail") {
      echo(value || "(no detail)");
      void runStep("loop_submit", caseData, value);
      return;
    }
  }

  function handlePhoto(file: File) {
    const caseData = requireCase();
    if (!caseData) return;
    const step = currentStepRef.current;
    if (step === "ask_photo") void runStep("analyse_photo", caseData, file);
    if (step === "verify_prompt") void runStep("verify_photo", caseData, file);
  }

  function handleSkip() {
    const caseData = requireCase();
    if (!caseData) return;
    const step = currentStepRef.current;
    if (step === "verify_prompt") {
      echo("Skip verification");
      void runStep("close_prompt", caseData);
    } else if (step === "loop_check_name") {
      echo("Not sure — skip this check");
      draftCheckRef.current = {};
      void runStep("loop_prompt", caseData);
    } else {
      // Photo skipped: straight into the interview, which now has to
      // carry the case on its own.
      echo("Skip — no photo");
      void runStep("ask_signature", caseData);
    }
  }

  function labelFor(axisId: string, value: string): string {
    if (value === DONT_KNOW_VALUE) return "Don't know";
    if (value === UNMAPPED_VALUE) return axisNotesRef.current[axisId] ?? "described in own words";
    const q = questionsRef.current.find((x) => x.id === axisId);
    return q?.options.find((o) => o.value === value)?.label ?? value.replaceAll("_", " ");
  }

  if (loading || !artifacts) {
    return (
      <div className="mx-auto max-w-5xl flex-1 space-y-3 px-6 py-10">
        <Link
          href="/cases"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "mb-4 gap-1.5" })}
        >
          <ArrowLeft className="size-4" />
          Back to Cases
        </Link>
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      {/* Top Navigation Header Bar */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b bg-card/80 px-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Link
            href="/cases"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground",
            })}
          >
            <ArrowLeft className="size-3.5" />
            <span>Past Cases</span>
          </Link>
          <span className="text-muted-foreground/30">/</span>
          <Link
            href={`/cases/${caseId}`}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Case #{caseId} Details
          </Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="text-xs font-semibold text-foreground">
            Troubleshooting Wizard
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground",
            })}
          >
            <Home className="size-3.5" />
            <span>Home</span>
          </Link>
          <Link
            href="/cases"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "h-8 text-xs",
            })}
          >
            All Cases
          </Link>
        </div>
      </header>

      <StageBar phase={phase} />
      <div className="grid min-h-0 flex-1 grid-cols-1 divide-x overflow-hidden md:grid-cols-2">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <ChatPanel
            messages={messages} pending={pending} busy={busy}
            onChipSingle={handleChipSingle} onChipsMulti={handleChipsMulti}
            onText={handleText} onPhoto={handlePhoto} onSkip={handleSkip}
          />
        </div>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <ArtifactPanel artifacts={artifacts} />
        </div>
      </div>
    </div>
  );
}
