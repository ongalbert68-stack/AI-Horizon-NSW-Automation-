import { Info } from "lucide-react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

/**
 * What "Tier", "Diagnosed" and "Checks" mean — DESIGN.md step 8. Shown as a
 * hover card next to those columns/badges since the words alone (CONFIRMED,
 * best guess, action count) don't explain themselves to someone who hasn't
 * read the design doc.
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
          <p className="mb-1 font-medium text-foreground">Diagnosed</p>
          <ul className="space-y-0.5 text-muted-foreground">
            <li><span className="text-foreground">never tested</span> — nothing tried yet</li>
            <li><span className="text-foreground">best guess</span> — something was tried, but no check confirmed it caused the fix</li>
            <li><span className="text-foreground">check confirmed</span> — a specific check confirmed the cause</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">Tier (set when the case closes)</p>
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
            Troubleshooting-loop actions logged against the case. More than one disqualifies it
            from ever reaching CONFIRMED — with two changes at once, there&apos;s no way to say
            which one worked.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
