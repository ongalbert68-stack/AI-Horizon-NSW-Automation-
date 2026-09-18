# Baseline: manual LLM-relay diagnostic run

A "human relay" baseline for the NSW 7-step diagnostic procedure -- run entirely
by hand, through whatever chatbot you already have, with no API key and no
code calling a model. It exists to see what the 7-step reasoning process
*should* produce before any of it gets automated.

## How the relay works

1. Claude (this assistant) writes a copy-paste block for the current step.
2. You paste it into your chatbot (same thread for the whole run, so it
   keeps earlier context).
3. You paste the chatbot's reply back to Claude.
4. Claude reads it, folds in whatever golden data the next step needs, and
   hands you the next copy-paste block.
5. Repeat through Step 7 (report generation).

Claude never calls a model itself here -- every chatbot turn is manual, by
design, so this stays a transparent, inspectable record of the reasoning
rather than a black box.

## The 7 steps

| Step | What happens | Where the data comes from |
|---|---|---|
| 1 | Define the dispensing problem | The fixed operator report in `golden/nsw_inconsistent_size/user_input.json` |
| 2 | AI asks clarifying questions | The chatbot's own output; answered live (only the top-level complaint is golden-fixed) |
| 3 | Analyse the symptoms | The real CV measurements in `golden/nsw_inconsistent_size/cv_output.json` / `signals.json` -- "image analysis," already done for us, handed over as structured data |
| 4 | Compare possible causes | The manual excerpts in `golden/nsw_inconsistent_size/rag_output.json` -- "troubleshooting db" |
| 5 | Rank possible causes | The chatbot's own reasoning over steps 3+4 |
| 6 | Recommend a troubleshooting sequence | Grounded in the same RAG excerpts, plus the `checks` lists already written for each cause in `web/packs/nsw/index.ts` (for comparison, not pasted verbatim) |
| 7 | Generate a report | Everything above, summarised |

## Files

- `nsw_inconsistent_size/persona.md` -- the standing rules block, pasted once
  as your first message to the chatbot. Doesn't change between steps.
- `nsw_inconsistent_size/transcript.md` -- the running record: what was sent
  at each step, and what came back. Appended to turn by turn as the run
  actually happens, so it doubles as this baseline's permanent result once
  Step 7 is done.

## Why this matters for NSW automation

Once this manual run is complete, `transcript.md` is a real, human-reviewed
example of what "good" looks like end to end -- the thing to compare a real
automated pipeline's output against, the same way `expected_reasoning.md`
in the golden folder is a smaller-scale version of that idea.
