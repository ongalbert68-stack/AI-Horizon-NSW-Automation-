import { Info } from "lucide-react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

/**
 * What "Rank", "Tier", "Diagnosed" and "Checks" mean — DESIGN.md steps 5 and
 * 8. Two different tiers show up side by side in this app (rank confidence
 * vs. close outcome) which is exactly the kind of thing that needs a legend
 * rather than a column header alone.
 */
export function TierInfo() {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <button
            type="button"
            className="inline-flex text-muted-foreground hover:text-foreground"
            aria-label="What do these mean?"
          />
        }
      >
        <Info className="size-3.5" />
      </HoverCardTrigger>
      <HoverCardContent className="w-80 space-y-3 text-xs">
        <div>
          <p className="mb-1 font-medium text-foreground">How the ranking is built</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>
              <span className="text-foreground">Pass 1 (rule engine)</span> — a fixed set of
              rules over your answers and the photo&apos;s signals. No database lookup here, and
              no guessing: every weight is visible.
            </li>
            <li>
              <span className="text-foreground">Pass 2 (LLM critic)</span> — a second, independent
              read of the complaint text alone, with none of pass 1&apos;s signals or answers. It
              only runs if an LLM key is configured; if not, it&apos;s skipped and counted as
              agreeing with pass 1.
            </li>
            <li>
              <span className="text-foreground">Gate A (chance check)</span> — asks whether the
              measurement separating the top candidates is actually above its statistical chance
              baseline, or could just be noise.
            </li>
            <li>
              <span className="text-foreground">Gate B (precedent)</span> — the one place this
              does search the database: it looks for confirmed past cases matching this
              fingerprint. Needs at least 3 to count for anything, and it can only ever demote the
              top cause, never promote one — agreement isn&apos;t allowed to inflate confidence.
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">Rank (T1–T4, step 5)</p>
          <p className="text-muted-foreground">
            How much the ranking trusts its top candidate cause, right now — not whether it&apos;s
            actually right.
          </p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            <li><span className="text-foreground">T1</span> — two independent passes agree, the evidence beats chance, and past confirmed cases back it up</li>
            <li><span className="text-foreground">T2</span> — the two passes agree, but without that extra backing</li>
            <li><span className="text-foreground">T3</span> — the passes disagree, but the evidence still beats chance</li>
            <li><span className="text-foreground">T4</span> — no lead cause; nothing beats chance yet</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">Diagnosed</p>
          <ul className="space-y-0.5 text-muted-foreground">
            <li><span className="text-foreground">never tested</span> — nothing tried yet</li>
            <li><span className="text-foreground">best guess</span> — something was tried, but no check confirmed it caused the fix</li>
            <li><span className="text-foreground">check confirmed</span> — a specific check confirmed the cause</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">Tier (step 8, set when the case closes)</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>
              <span className="text-foreground">CONFIRMED</span> — all five held: a check
              confirmed the cause, exactly one thing was changed, the deciding signal was
              re-measured, it came back in spec, and it held for the next 20 shots.
            </li>
            <li>
              <span className="text-foreground">PLAUSIBLE</span> — the symptom went away, but
              not every condition above was proven. Shown as context; changes nothing in the
              ranking.
            </li>
            <li>
              <span className="text-foreground">UNVERIFIED</span> — nothing was confirmed and
              it wasn&apos;t resolved either.
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">Checks</p>
          <p className="text-muted-foreground">
            Troubleshooting-loop iterations logged against the case, of two kinds.{" "}
            <span className="text-foreground">Looked</span> — you observed something and changed
            nothing; run as many as you like, they cost the case nothing.{" "}
            <span className="text-foreground">Changed</span> — you altered the machine, tooling
            or material. More than one change disqualifies the case from CONFIRMED, because with
            two changes at once there&apos;s no way to say which one worked.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
