import { Check } from "lucide-react";

export interface Phase {
  n: number;
  label: string;
  hint: string;
}

const PHASES: Omit<Phase, "hint">[] = [
  // The photo comes before the interview: it measures what the interview
  // would otherwise ask the operator to estimate, and it's the only
  // evidence that can clear Gate A's chance test.
  { n: 1, label: "Photo" },
  { n: 2, label: "Interview" },
  { n: 3, label: "Ranking" },
  { n: 4, label: "Troubleshooting" },
  { n: 5, label: "Report" },
  { n: 6, label: "Close" },
];

/**
 * Orientation for the chat wizard: which of the pipeline's phases you're in
 * right now and what to do at it, since the chat transcript alone doesn't
 * tell a first-time user that — DESIGN.md's 8 steps, collapsed to 6 that
 * mean something to someone who hasn't read the design doc.
 */
export function StageBar({ phase }: { phase: Phase }) {
  return (
    <div className="border-b bg-muted/30 px-4 py-3">
      <ol className="flex items-center">
        {PHASES.map((p, i) => {
          const done = p.n < phase.n;
          const current = p.n === phase.n;
          return (
            <li key={p.n} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    current
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : p.n}
                </div>
                <span
                  className={`text-[11px] whitespace-nowrap ${
                    current ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {p.label}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <div className={`mx-2 h-px flex-1 ${done ? "bg-primary/40" : "bg-border"}`} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          Step {phase.n} of {PHASES.length} &middot; {phase.label}.
        </span>{" "}
        {phase.hint}
      </p>
    </div>
  );
}
