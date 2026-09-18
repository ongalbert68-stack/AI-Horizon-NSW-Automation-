import Link from "next/link";

const PROTOTYPES = [
  {
    href: "/nsw/a", track: "NSW Automation", variant: "A", name: "Diagnostic Interviewer",
    engine: "LLM reasoner",
    bet: "Breadth. The model handles any symptom an operator can describe and asks natural follow-ups.",
    risk: "Confidence figures are asserted, not derived. Vulnerable to \"so it is a wrapper?\" in Q&A.",
  },
  {
    href: "/nsw/b", track: "NSW Automation", variant: "B", name: "Dispensing Metrology Instrument",
    engine: "OpenCV + weighted fault tree",
    bet: "Defensibility. Deposits are measured, then causes are ranked from those measurements.",
    risk: "Needs a usable image. Only covers defects the fault tree models.",
  },
  {
    href: "/exa/a", track: "Exabytes Malaysia", variant: "A", name: "Guided Assessment",
    engine: "LLM reasoner",
    bet: "The brief taken literally: five questions to a full transformation blueprint.",
    risk: "Every competing team will build approximately this.",
  },
  {
    href: "/exa/b", track: "Exabytes Malaysia", variant: "B", name: "Zero-Input Auditor",
    engine: "Live web probe + rubric engine",
    bet: "Evidence. Type a URL and maturity is scored from the real site before a single question.",
    risk: "Depends on a reachable site. Signals are surface-level, not a full audit.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
          AI Horizon Solution Challenge 2026
        </p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Four prototypes, two tracks</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Within each track, A and B are the same brief answered with opposite bets on where the reasoning
          should live. A lets the model reason end to end. B computes the result in code and uses the model
          only for language. Run both, then keep the one that survives the judges&apos; questions.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {PROTOTYPES.map((p) => (
          <Link key={p.href} href={p.href}
            className="group rounded-xl border border-line bg-panel p-5 transition hover:border-accent/60">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{p.track}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                p.variant === "B" ? "border-good/40 text-good" : "border-warn/40 text-warn"}`}>
                Prototype {p.variant}
              </span>
            </div>
            <h2 className="text-lg font-semibold group-hover:text-accent">{p.name}</h2>
            <p className="mt-0.5 font-mono text-[11px] text-accent">{p.engine}</p>
            <p className="mt-3 text-xs leading-relaxed text-muted"><strong className="text-ink">Bet:</strong> {p.bet}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted"><strong className="text-ink">Risk:</strong> {p.risk}</p>
          </Link>
        ))}
      </div>

      <footer className="mt-10 rounded-xl border border-line bg-panel p-5">
        <h2 className="text-sm font-semibold">Before demoing</h2>
        <ul className="mt-2 space-y-1.5 text-xs text-muted">
          <li>— Prototype A calls Groq. Without <code className="text-accent">GROQ_API_KEY</code> it falls back to the deterministic baseline and says so on screen.</li>
          <li>— NSW Prototype B needs the metrology service: <code className="text-accent">cd vision &amp;&amp; .venv/bin/uvicorn main:app --port 8000</code></li>
          <li>— Sample dispensing images are in <code className="text-accent">vision/samples/</code>. Regenerate with <code className="text-accent">generate_samples.py</code>.</li>
          <li>— Every report prints to PDF from the browser, which covers the PDF bonus in both briefs.</li>
        </ul>
      </footer>
    </main>
  );
}
