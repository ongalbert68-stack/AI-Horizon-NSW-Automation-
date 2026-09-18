"use client";

import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-panel p-5 print-break ${className}`}>{children}</div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {hint && <p className="mt-1 text-xs text-muted/80">{hint}</p>}
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="tracking-[0.15em] text-warn" aria-label={`${n} out of 5`}>
      {"★".repeat(Math.max(0, Math.min(5, n)))}
      <span className="text-line">{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

export function Bar({ value, tone = "accent" }: { value: number; tone?: "accent" | "good" | "warn" | "bad" }) {
  const colour = { accent: "bg-accent", good: "bg-good", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-panel2">
      <div className={`h-full rounded-full ${colour} transition-all duration-500`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "accent" }) {
  const cls = {
    neutral: "border-line text-muted",
    good: "border-good/40 text-good",
    warn: "border-warn/40 text-warn",
    accent: "border-accent/40 text-accent",
  }[tone];
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

export function toneFor(score: number) {
  return score >= 70 ? "good" : score >= 40 ? "warn" : "bad";
}
