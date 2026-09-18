# Design

Code produces every number and every ranking. The LLM only turns results into sentences, and those sentences are checked before they're shown. The whole app works with no API key.

## What the ranking step is for

Being right is worth less than knowing when you're wrong. An engineer sent to strip a nozzle on a 55% hunch loses a shift; the same engineer told "these two causes can't be separated from this image, run twenty shots and watch whether it recovers" loses ten minutes. So the ranking step is measured on two things, not one: whether the top cause is right, and whether confidence falls when it isn't.

Everything below follows from that. The fault tree already produces a percentage per cause. What it doesn't produce is any sense of its own reliability — it is exactly as confident when the deciding measurement is decisive as when that measurement is indistinguishable from noise.

## Pipeline

| Brief step | What happens |
| :--- | :--- |
| 1 Define problem | A picked defect, or free text mapped onto the same list — this fills axis 1. Plus a photo, optional |
| 2 Ask questions | The four remaining axes, always asked, plus follow-ups chosen by code |
| 2b **Coarse case retrieval** | Key: the five axes + material + dispenser class. Orders the questions and pre-loads likely checks. Changes no ranking — not at this depth of evidence, which is what lets it degrade gracefully |
| 3 Analyse symptoms | Measurements and answers produce an identified defect with a star rating. Quality gate first: an unmeasurable image says so and the run continues on questions alone |
| 4 Compare causes | Every cause shows evidence for and against, with manual passages for each |
| 5 Rank | Two passes, then three gates (below) |
| 5b **Fine case retrieval** | Key: the full signal vector. Confirmed cases only. Can demote, never promote |
| 6 Troubleshooting sequence | Ordered checks; the user records each result, causes re-rank, repeat |
| 7 Report and verify | Printable: checks done, confirmed cause, engineer notes. Re-dispense and re-measure the deciding signal |
| 8 Close case | Saved to the case database, with what was proved |

Two retrieval points because early on you know the complaint and late on you know the numbers, and those match against past cases in completely different ways.

## Step 5: the ranking gate

**Pass 1 — instrument.** The deterministic fault tree over signals and answers. Every weight visible.

**Pass 2 — critic.** The LLM reasoner over the complaint and the photo, given **no signals**. The different view is what buys different failure modes; an ensemble that shares its inputs shares its mistakes. Pass 2 is an error detector, not a voter — its ranking is never merged into Pass 1's.

**Gate A — chance.** On disagreement, ask whether the signal that separates the two candidates is above its chance baseline. Below chance (p ≥ 0.05) the measurement decides nothing and confidence drops hard.

**Gate B — precedent.** Confirmed cases matching the fingerprint. History that agrees changes nothing; history that contradicts demotes the current top cause. Capped, and requires at least 3 matching cases.

Agreement never raises confidence. Two readers sharing a bad measurement agree just as firmly as two readers who are right, and if precedent could promote a cause the system would converge on whatever it diagnosed first — every confirmation feeding the prior that produced it.

| Tier | Reached when | Shown |
| :--- | :--- | :--- |
| T1 | Passes agree, signal beats chance, confirmed precedent | One lead cause, with evidence and matching past cases |
| T2 | Passes agree, no precedent or signal at chance | One lead cause, marked provisional, with what would confirm it |
| T3 | Passes disagree, signal beats chance | Both candidates, measurement holds the top slot, disagreement stated |
| T4 | Passes disagree, signal at chance | **No lead cause.** The output is the check that separates them |

T4 refusing to name a cause is a feature. `golden/nsw_inconsistent_size` is a T4: `size_cv` 0.486 says the volume is unstable and nothing in the image says why.

## Step 8: the case database

Problem → solution is the obvious shape and it's the one that fails. A case closes, the symptom is gone, and whatever was touched last takes the credit. If the operator re-primed the syringe *and* nudged the pressure, the record claims two things worked and neither was tested.

So the close step doesn't ask what was done. It asks what was proved:

- a check confirmed the cause
- exactly one thing was changed
- the deciding signal was re-measured
- it came back inside spec
- it held for the next N shots

All five → **CONFIRMED**, adjusts the ranking through gate B. Some → **PLAUSIBLE**, shown to a human as context, adjusts nothing. Any no → **UNVERIFIED**, shown with the gap named ("3 changes at once, cause never tested"), adjusts nothing.

`action_count > 1` disqualifies a case from CONFIRMED outright. That single rule is what keeps post-hoc reasoning out of the database.

The unit that transfers between cases is not a sentence:

```jsonc
{
  "case_id": "2026-0914-031",
  "rules_version": "nsw-pack@3",         // old cases die when the tree changes

  "fingerprint": {                       // the retrieval key
    "complaint": "Inconsistent size shot to shot",
    "material": "Epoxy",
    "dispenser": "pressure-time",
    "signals": { "size_cv": 0.49, "mean_circularity": 0.90, "missing_count": 0,
                 "small_then_big": "1 of 4", "small_then_big_chance_p": 0.62 },
    "answers": { "frequency": "Occasionally", "recent_change": "New material lot" }
  },
  "diagnosis": {
    "cause_id": "air_in_fluid_path",     // vocabulary from golden/causes.json
    "confirmed_by": { "check": "purge and re-prime", "result": "air slug expelled" },
    "runners_up": ["pressure_time_instability", "material_rheology_change"]
  },
  "fix": { "actions": ["re-primed syringe, purged 20 shots"], "action_count": 1 },
  "verification": {                      // the field the mechanism rests on
    "signal": "size_cv", "before": 0.49, "after": 0.11,
    "spec": "< 0.15", "in_spec": true,
    "shots_measured": 30, "recurred_after_days": null
  },
  "tier": "CONFIRMED"
}
```

**Similarity is structured, not embedded.** The free-text description is the least reliable field in the record, and a match score nobody can explain is worth nothing in front of an engineer who disagrees with it. Hard filter on complaint class and material class, then distance across the discriminating signals only, each normalised by its own spread. A signal sitting at its chance level carries no weight in the match, for the same reason it carries none in the ranking. The match is shown: "3 confirmed cases, `size_cv` 0.46–0.52 against your 0.49, no dispense-order pattern in any, all pressure-time."

Precedent enters as its own evidence row with its own weight, next to the rules — never as a silent adjustment to a prior.

## Workstreams

Status: **[done]** shipped · **[next]** blocking · **[later]** wanted

### W1. A trustworthy test set (first, because every later step is measured against it)

- **[done]** Golden case 1 rebuilt: retrieval covers every candidate cause (26 passages), the answer key moved out of `rag_output.json` into `expected.json`, truth taken from `vision/synth/defects.py` rather than our own reading.
- **[done]** Golden case 2 (`nsw_missing_carryover`), where carryover is the right answer. The pair tests the exact failure we found: 1 of 4 at chance (p 0.62) against 3 of 3 (p 0.0098).
- **[done]** `golden/causes.json` — the shared cause vocabulary both cases grade against, and the id space the case database uses.
- **[done]** `check_golden.py` re-derives every signal, rejects a lookup that states a conclusion, enforces cause coverage.
- **[next]** Generate the validation set. NSW provided no real photos and none are obtainable open-source, but we own the generator — `vision/synth/` composes defect operators and writes per-dot ground truth, so ~200 labelled cases is a script run, not a data-collection project. This is the thing every threshold on this page is waiting for.
- **[next]** Scoring rule: a proper score over the cause set (Brier or log-loss), not top-1 accuracy. Top-1 accuracy cannot see calibration, which is the 80%.
- **[later]** Tag each scenario's source of truth: generator label, the brief's example, a manual passage, or team judgement. Team-judgement scenarios only test consistency, not correctness.

Do not hand-tune rule weights against two golden cases. Only structural changes generalise at this sample size.

### W2. Cause model (web/packs/nsw/index.ts, web/core/infer.ts)

- **[next]** New causes grounded in the manual: marginal volume with carryover (§3.5, §4.5, §5.5), pressure-time pump variability (§2.1, §3.2), up height too low (§3.3), needle bore too small for the paste particles (§3.1). Case 2 fails outright today because the pack has no carryover cause to rank.
- **[next]** Signal rules are binary thresholds today (`size_cv > 0.15`, `mean_circularity < 0.8`, `spread_index > 1.2`) and add the same weight at 0.16 as at 0.49. Scale each rule's weight by how far the value sits from its chance or nominal baseline.
- **[next]** Dispense-order signal in the app: how often a small dot is followed by a big one, against chance, computed only when dispense order is known. The carryover rule fires only above chance. This fixes the "pattern found in noise" failure in code.
- **[later]** Every rule gets a source (manual section and page, the brief, or "engineering judgement"), and the UI shows it.
- **[later]** Every question gets a "Don't know" option. It adds no evidence and lowers confidence.
- **[later]** Stars come from how much deciding evidence is known and how far #1 leads #2, not from the raw percentage.
- Keep cause percentages independent (not summing to 100), matching the brief's table, and say so on screen.

### W3. Questions: a fixed spine, then adaptive follow-ups (web/packs/nsw/index.ts, web/engines/)

Five questions are always asked, whatever the complaint. They are the interview and they are the answer half of the fingerprint, and they only work as a key because every case has all five. Adaptive follow-ups are chosen per case and never enter the fingerprint: a question asked in one case and skipped in another cannot be compared across cases, and the current record's `answers` block has exactly that defect today.

The five are picked to be orthogonal — each localises the fault on a different dimension, so no two can be answered from each other. Redundant questions cost interview budget and, worse, inflate the match score between cases that are only superficially alike.

| id | axis | what it localises |
| :--- | :--- | :--- |
| `signature` | what the deposit looks like | volume vs. rheology vs. motion |
| `trajectory` | how it behaved since it started | step change vs. wear vs. random vs. cycle-linked |
| `footprint` | what it follows when things are swapped | material vs. tooling vs. machine vs. recipe vs. human |
| `inputs` | state of the material and the supply | pot life, lot, fill level, ambient, plant air |
| `response` | what makes it stop, even briefly | where the restriction or the variance actually sits |

**The defect picker and `signature` are one field, not two.** Step 1 asks what is wrong; that answer *is* axis 1. So step 2 asks the remaining four, not five. The same option list serves both, and the axis is filled up to twice from different sources — by the user at step 1, from memory, and by the image at step 3, from measurement. Agreement raises nothing on its own, but disagreement is evidence: lower confidence and fire the follow-up that settles it.

**Axis 1 · `signature`** — multi-select, **max 2**, first pick is primary. *Compared with a good deposit, what is wrong with the bad one?*

| # | Option | Help text | Picker | Image |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Too little | starved, thin, under-filled | ● | ● |
| 2 | Too much | oversized, flooded | ● | ● |
| 3 | Size varies shot to shot | some big, some small, no pattern | ● | ● |
| 4 | Missing deposits | nothing came out at that point | ● | ● |
| 5 | Shape or size changes across the board | squat in one area, tall in another | ○ | ● |
| 6 | Wrong shape | tails, strings, satellites, voids, not round | ● | ● |
| 7 | Spread, smeared or out of position | looked right, then ran out of place | ● | ○ |
| 8 | A small dot, then an oversized one | — | — | ● |
| — | Other / not sure | free text, routes to `unclassified` | ● | — |

Option 8 needs per-dot dispense order, so only `vision/detect/` can set it. The vocabulary holds eight values; the picker exposes seven. Option 7 is temporal and a still frame cannot see it. Option 6 is claimed by no cause in the pack — it stays in the list precisely because it will be reported, and counting it is how we learn the cause list is short.

Sized to what the causes can separate, not to the defect space: five of the seven entries in `golden/causes.json` carry `image_signature: null`, meaning their own sources say there is no way to tell them apart from a picture of dots. A finer picker would be claiming discrimination the cause model does not have.

**Axis 2 · `trajectory`** — single. *How has it behaved since it started?*
Sudden, fine then bad from one point on · Gradual, worse over hours or days · Random, comes and goes · Only on the first shots after a pause · Only after running a while · Only near the end of a syringe · It has always been like this.

The last option matters: a process that was never capable is a different case class from one that degraded, and it routes to recipe and geometry rather than to wear or contamination. "Continuous or occasional" gives the rate only; step-versus-ramp gives the mechanism, which is the more useful half.

**Axis 3 · `footprint`** — single. *If you move things around, what does the defect follow?*
The material, it moves with the syringe or lot · The nozzle, needle or valve · The machine or head · The product or program · The shift or operator · Nothing, it happens everywhere · Not tested yet.

The highest-yield question in the set and the one the current pack has no form of. `location` asks where on the board; this asks where in the system.

**Axis 4 · `inputs`** — multi, uncapped. *What is the state of the material and the supply right now?*
Fresh lot, within pot life, thawed and degassed per spec · New lot or syringe just started · Near or past out-time · Syringe nearly empty · Room temperature or humidity changed · Air supply changed, wet, or recently serviced · Nothing unusual.

**Axis 5 · `response`** — single. *What helps most, even temporarily?*
Purging or priming · Wiping or changing the needle · A new syringe · Turning pressure or shot time up · Letting it warm up · Restarting or re-homing · Nothing tried helps · Not tried yet.

Single deliberately. If three things help, the one that helps *most* is the diagnostic one; letting all three be ticked produces a fingerprint that matches everything.

**Why the caps differ.** `signature` is a high-weight match dimension, so six ticks would make a fingerprint resembling every case — the cap protects discriminability. `inputs` is the lowest-weight axis and matches by overlap rather than equality, so a long list degrades gracefully, and the conditions genuinely co-occur: a new lot *and* humid weather is one real Tuesday.

**Exclusive options clear the rest.** "Other / not sure" on `signature`, and "Nothing unusual" and "Don't know" on `inputs`, cannot be combined with a real option. Without this rule you get `["nothing unusual", "new lot just started"]`, which contradicts itself and matches both ways.

**How each is asked.** Options, plus "Don't know", plus "Other (describe)" on all five. Free text alone gives no key; options alone lose the case that does not fit. Each option carries a plain-language example in its help text, because nobody on a line says "stringing", they say "it leaves a hair". "Other" is routed through the W7 call-1 mapper onto an existing option; if it will not map, store the text, mark the axis `unmapped`, and exclude that axis from the match rather than letting the enum space fork silently.

**"Not tested" is not "Don't know".** Don't-know lowers confidence and stops. Not-tested on `footprint` and `response` names a cheap experiment, so it is promoted into the W4 check list and, once there are cases, backed by precedent: "4 confirmed cases were resolved after the swap test."

**What is not on the spine, and why.**

- `material` and `dispenser` are not axes. They are the hard filter at step 2b, where they already sit. Keep them as case metadata; "both were epoxy" is a fact about the line, not evidence of similarity.
- `location` generalises to `footprint`.
- `recent_change` is dropped as a spine question. A sudden step that follows the nozzle *is* "the nozzle was changed", inferred from observation instead of self-report, and operators routinely answer "nothing changed" when something did. Ask it as a follow-up fired only by `trajectory = sudden step`, the one branch where it discriminates.
- Magnitude is computed from the signals, not asked. Bucket the measured deviation to `marginal` / `moderate` / `gross` / `total-failure`, with `unknown` when the W6 quality gate fails. An operator should not be asked to estimate what the image measures.

`Answer.value` is a `string`, so the two multi-select axes need a value-array widening or a join convention before they can be stored.

**Adaptive follow-ups**, unchanged in mechanism:

- For each unasked question, try every possible answer through `rankCauses` and ask the one that would move the ranking most.
- No LLM, can say why it was asked, earns the brief's bonus for dynamic follow-up questions.
- Skip what the photo already answers — `signature` and magnitude often come free from `vision/`, so the interview should open on `trajectory` or `footprint` when the image is good. Stop at 5–7 questions, or earlier once #1 clearly leads.
- `NSW_FOLLOWUPS.missing` needs a third option — it cannot currently express "the next shot is oversized", which is the carryover signature.

### W4. Troubleshooting loop

- Each check carries its cost (time and how invasive it is), a safety note, and its possible results, with whether each confirms, rules out, or is inconclusive for a cause.
- Order checks by likelihood divided by cost, so cheap, likely checks come first.
- The UI flow: record a result, causes re-rank instantly, move to the next check.
- The loop ends in one of two ways: a fix is verified (re-dispense test dots and re-measure the size spread), or checks run out and the case escalates to an engineer. Both write a case.
- Never invent parameter numbers. Write "adjust in small steps within your process spec, engineer to confirm" unless the manual gives a figure.

### W5. Case database (Bonus 3, and the "troubleshooting database" in the Advanced tier)

- A SQLite file behind an API route, holding the record above.
- Tiering at close, per step 8. Only CONFIRMED cases reach gate B.
- Influence is capped at 0.4 log-odds total regardless of case count, and requires ≥3 matching confirmed cases, so a handful of cases can't flatten the tree.
- The UI shows "N similar cases, X of them caused by Y", with the fields that matched.
- Start empty. At zero cases gate B does nothing and no case reaches T1 — the UI says "no precedent" rather than filling the space. Seeded sample cases stay visibly labelled as samples.

**The fingerprint has two halves, read at two different points.** Step 2b has the axes and no measurements; step 5b has both. They match differently and must not share a scorer.

- **2b, the axes.** Hard filter on material and dispenser class, then weighted agreement across the five axes: equality for `trajectory`, `footprint`, `response`, Jaccard for the two multi-selects. Weight `footprint` and `response` above `trajectory`, and `signature` and `inputs` below it — an axis is worth what it localises.
- **Scale each axis match by the inverse frequency of that answer in the case base itself**, recomputed on write. "Too little material" matches half the cases and means almost nothing; "follows the nozzle" matches few and means a lot. This needs no hand-set constants for an engineer to argue with, and it corrects itself as the base fills.
- **5b, the signals**, unchanged: distance across the discriminating signals only, each normalised by its own spread, with a signal at its chance level carrying no weight in the match for the same reason it carries none in the ranking.
- Axes marked `unmapped` or answered "Don't know" are excluded from the match, not scored as a mismatch. A missing axis is missing evidence, not evidence of difference.

**When the complaint has no class.** "Other (describe)" and "not sure" are different answers and neither breaks 2b, because the hard filter does not depend on them — material and dispenser class are known regardless, so 2b always returns *something*. What degrades is the axis match: `signature` drops out of the numerator **and** the denominator, and 2b runs on four axes instead of five. Never score an unanswered axis as a mismatch.

- The two remaining high-weight axes, `footprint` and `response`, are untouched, so losing `signature` costs less than losing almost any other axis would.
- **Require a floor, expressed in axes agreed rather than in score.** At least two axes must agree, and at least one of them must be `footprint` or `response`. Below that, "6 similar cases" means "6 cases that also ran epoxy", which is worse than showing nothing.
- **Say what it matched on.** "6 cases on epoxy, pressure-time, agreeing on trajectory and footprint — your defect type was not classified." An engineer can then price the precedent themselves.
- The free text from "Other" may be offered as *reading* — past cases whose description shares words — but visually separated and never scored as an axis match. It is a pointer for a human, not a similarity.
- **2b is allowed to run on partial information precisely because it is forbidden from touching the ranking.** The blast radius of a bad 2b is question order and a stale check preload, so there is no need to re-run it when step 3 later resolves `signature`. That constraint is what makes graceful degradation safe rather than merely tolerable.
- An unclassified complaint costs 2b only. Verification does not depend on the complaint class, so the case can still close CONFIRMED, and it is still retrievable at 5b on its signal vector. It files with `complaint: unclassified` plus the raw text, and those are the cases to read when deciding whether the picker list is short.

**On the retrieval method.** Not embeddings, and not TF-IDF either — those are both text methods and neither half of this fingerprint is text. The axes are categorical and match structurally; the signals are numeric and match by distance. The only free text in the record is the engineer's note, and it is the least reliable field in it. A similarity score nobody can explain is worth nothing in front of an engineer who disagrees with it, and every gate on this page is built to be argued with.

This is also why the manual side (W8) needs no vector store: 41 pages, and the primary path is not search at all but a direct link from each rule to its section and page, which is what the W7 validator checks against. Keyword search over the hand-chunks is the fallback for free-text description only, and it never feeds the cause ranking.

### W6. Image evidence (vision/)

- **[next]** Wire `vision/detect/` into the app. It is the only pipeline producing per-dot tags in dispense order, which the carryover signal needs; `main.py`, which the app calls today, does not.
- **[next]** Fix `spread_index`. It reports 1.778 and 3.792 on the two golden images, neither of which is smeared, and that false signal feeds a false claim into the needle-height cause — through both passes, since it reaches Pass 2 as well.
- **[next]** Quality gate: too few deposits, low contrast, or odd polarity means "can't measure reliably" and the run continues on questions only. This is upstream of everything, because a bad measurement fools both passes and they then agree confidently.
- **[later]** Fix the mismatched notes in `main.py` (they say "mean ± 2 sigma" where the code uses 1.40×/0.70× of the median).
- Run on the 6 photos in `docs/personal/imgs/` and log the results, failures included. Only demo validated images.
- Keep the VLM track paused (13.6%).

### W7. LLM, at most 2 calls per session

- **[done]** Groq adapter (`llama-3.1-8b-instant`, 14,400 requests/day). The old Gemini ceiling of 20/day could not support a scored evaluation run; this can. Untested against the live API — no key on the machine yet.
- Call 1 turns a free-text description into a defect and pre-filled answers.
- Call 2 writes the final explanation, using passages retrieved for the top 3 causes, competitors included.
- Pass 2 of the ranking gate is a third call, and it is the one worth the budget.
- A validator checks every cited section was actually retrieved and every number exists in the computed results. If either check fails, the code-written explanation is shown instead, labelled as such. This is the `forbidden_claims` list from the golden cases promoted from test time to run time.
- Cache responses by input.

### W8. Manual knowledge base

- Hand-chunk the manual by section with page numbers (41 pages). This is more reliable than PDF parsing in the time available. The golden cases already carry 26 hand-verified passages to start from.
- Each rule links to its passages, and free text is searched by keyword.
- Mark topics the manual doesn't cover (sealants, silicone, UV glue) as having no manual source.
- Credit the NPL / Crown copyright in the app and in the video.

### W9. Report (existing Report in Assessment.tsx)

- Add the original description, identified defect with stars, and quality score; causes with evidence and sources; the check log and confirmed fix; an editable engineer notes field; rules version, whether the LLM was used, and "preliminary triage aid, not a replacement for an engineer" (brief 1.2).
- Show the confidence tier and, at T3 and T4, why the two passes disagreed.
- Keep print-to-PDF.

### W10. Evaluation runner (this is the video's Testing section)

- Run every scenario through the engine and report top-1 and top-3 accuracy, the proper score, stars vs correctness, citation validity (must be 100%), invented numbers (must be 0), questions asked, and whether reruns match.
- Report agreement rate between the two passes, and the error rate within each branch. Until that is measured, every threshold in the ranking gate is a placeholder.
- Compare the brief's three levels: questions only, then with ranking, then with image, manual, and case history.
- Run LLM-dependent checks on a small fixed subset.
- Report the CV result as 96.6% on generated images, with real-photo results shown separately.
- Adds a tsx dev dependency; declare it.

## Known risks

- **None of the gate thresholds are measured.** The two-reader split is borrowed from a task that measured its own error rates. We have two golden cases. W1 unblocks this.
- **The two passes are not fully independent.** Withholding signals from Pass 2 helps, but both read one photograph.
- **Verification asks work of the operator.** Nobody re-measures thirty shots to feed a database. Step 7 has to be the same photo flow as step 3, one tap. If it isn't, every case files as PLAUSIBLE and the loop is decorative.
- **Seven causes, and a real floor has more.** Cases that escalate unresolved are the signal that one is missing. Count them and read them.
- **Vocabulary drift.** Change a cause id or split a cause in two and historical fingerprints stop meaning what they meant. Remap old cases deliberately or exclude them; never silently reinterpret. The same applies to an axis option list: adding an option is safe, splitting or renaming one invalidates every fingerprint that used it.
- **The `response` axis often arrives already contaminated.** It asks what has been tried, and the honest answer on a real floor is usually "purged it, changed the needle, and put the pressure up" — three changes before the case was even opened. That is useful evidence for ranking and fatal for verification: `action_count` is already above one on arrival, so the case can never close CONFIRMED. The record needs to separate what was done *before* intake from what the loop instructed, and only count the latter.
