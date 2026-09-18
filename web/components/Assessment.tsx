"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis, Answer, Question, Signal, TrackId, VariantId } from "@/core/types";
import { Badge, Bar, Card, SectionTitle, Stars, toneFor } from "./ui";

export interface ProtoConfig {
  track: TrackId;
  variant: VariantId;
  sponsor: string;
  title: string;
  tagline: string;
  engineName: string;
  engineNote: string;
  /** Prototype B gathers measured evidence before the interview begins. */
  signalStep?: "image" | "url";
}

type Phase = "signals" | "interview" | "analysis";

export default function Assessment({ config }: { config: ProtoConfig }) {
  const [phase, setPhase] = useState<Phase>(config.signalStep ? "signals" : "interview");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const [annotated, setAnnotated] = useState("");
  const [openCause, setOpenCause] = useState<string | null>(null);
  const started = useRef(false);

  const post = useCallback(async (path: string, body: unknown) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  const advance = useCallback(
    async (nextAnswers: Answer[], nextSignals: Signal[]) => {
      setBusy(true);
      setError("");
      try {
        const { question: q } = await post("/api/interview", {
          track: config.track, variant: config.variant, answers: nextAnswers, signals: nextSignals,
        });
        if (q) {
          setQuestion(q);
        } else {
          setQuestion(null);
          const result = await post("/api/analyze", {
            track: config.track, variant: config.variant, answers: nextAnswers, signals: nextSignals,
          });
          setAnalysis(result);
          setPhase("analysis");
        }
      } catch {
        setError("Could not reach the analysis service.");
      } finally {
        setBusy(false);
      }
    },
    [config.track, config.variant, post],
  );

  useEffect(() => {
    if (phase !== "interview" || started.current) return;
    started.current = true;
    void advance(answers, signals);
  }, [phase, advance, answers, signals]);

  async function submitAnswer() {
    if (!question) return;
    const value = question.kind === "multi" ? multi.join(", ") : draft;
    if (!value.trim()) return;
    const next = [...answers, { questionId: question.id, prompt: question.prompt, value }];
    setAnswers(next);
    setDraft("");
    setMulti([]);
    await advance(next, signals);
  }

  async function runImage(file: File) {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/vision", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setSignals(data.signals);
      setAnnotated(data.annotated_png_b64 ? `data:image/png;base64,${data.annotated_png_b64}` : "");
    } catch {
      setError("Measurement failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runProbe(url: string) {
    setBusy(true);
    setError("");
    try {
      const data = await post("/api/probe", { url });
      if (data.error) { setError(data.error); return; }
      setSignals(data.signals);
    } catch {
      setError("Could not reach that site.");
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    started.current = false;
    setPhase(config.signalStep ? "signals" : "interview");
    setSignals([]); setAnswers([]); setQuestion(null); setAnalysis(null);
    setAnnotated(""); setDraft(""); setMulti([]); setError("");
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="accent">{config.sponsor}</Badge>
          <Badge>Prototype {config.variant.toUpperCase()}</Badge>
          <Badge tone={config.variant === "b" ? "good" : "warn"}>{config.engineName}</Badge>
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{config.title}</h1>
        <p className="mt-1 text-sm text-muted">{config.tagline}</p>
        <p className="mt-2 text-xs text-muted/80">{config.engineNote}</p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{error}</div>
      )}

      {phase === "signals" && (
        <Card>
          <SectionTitle hint={config.signalStep === "image"
            ? "Measurements are taken from the image before any question is asked, so the interview starts from evidence."
            : "The live site is inspected first, so maturity is observed rather than self-reported."}>
            Step 1 — Gather evidence
          </SectionTitle>

          {config.signalStep === "image" ? (
            <ImageStep busy={busy} onFile={runImage} annotated={annotated} />
          ) : (
            <UrlStep busy={busy} onProbe={runProbe} />
          )}

          {signals.length > 0 && (
            <>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {signals.map((s) => (
                  <div key={s.key} className="rounded-lg border border-line bg-panel2 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-muted">{s.label}</span>
                      <span className="font-mono text-sm font-semibold">{String(s.value)}{s.unit ?? ""}</span>
                    </div>
                    {s.note && <p className="mt-1 text-[11px] leading-snug text-muted/80">{s.note}</p>}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setPhase("interview")}
                className="no-print mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90"
              >
                Continue to questions →
              </button>
            </>
          )}
        </Card>
      )}

      {phase === "interview" && (
        <Card>
          <SectionTitle hint={`${answers.length} answered`}>Step 2 — Discovery</SectionTitle>
          {busy && !question && <p className="text-sm text-muted">Thinking…</p>}
          {question && (
            <div>
              <div className="mb-3 flex items-start gap-2">
                <p className="flex-1 text-lg font-medium">{question.prompt}</p>
                {question.dynamic && <Badge tone="accent">follow-up</Badge>}
              </div>
              {question.help && <p className="mb-3 text-xs text-muted">{question.help}</p>}

              {question.kind === "choice" && (
                <div className="grid gap-2">
                  {question.options?.map((o) => (
                    <button key={o} onClick={() => setDraft(o)}
                      className={`rounded-lg border px-4 py-2.5 text-left text-sm transition ${
                        draft === o ? "border-accent bg-accent/10 text-ink" : "border-line bg-panel2 hover:border-accent/50"
                      }`}>{o}</button>
                  ))}
                </div>
              )}

              {question.kind === "multi" && (
                <div className="grid gap-2">
                  {question.options?.map((o) => {
                    const on = multi.includes(o);
                    return (
                      <button key={o}
                        onClick={() => setMulti(on ? multi.filter((x) => x !== o) : [...multi, o])}
                        className={`rounded-lg border px-4 py-2.5 text-left text-sm transition ${
                          on ? "border-accent bg-accent/10" : "border-line bg-panel2 hover:border-accent/50"
                        }`}>
                        <span className="mr-2 font-mono text-xs">{on ? "✓" : "○"}</span>{o}
                      </button>
                    );
                  })}
                </div>
              )}

              {(question.kind === "text" || question.kind === "number") && (
                <input autoFocus type={question.kind === "number" ? "number" : "text"}
                  value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submitAnswer()}
                  className="w-full rounded-lg border border-line bg-panel2 px-4 py-2.5 text-sm outline-none focus:border-accent"
                  placeholder="Type your answer…" />
              )}

              <button onClick={() => void submitAnswer()}
                disabled={busy || (question.kind === "multi" ? multi.length === 0 : !draft.trim())}
                className="no-print mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg disabled:opacity-40 hover:opacity-90">
                {busy ? "Analysing…" : "Next →"}
              </button>
            </div>
          )}
        </Card>
      )}

      {phase === "analysis" && analysis && (
        <Report analysis={analysis} annotated={annotated} answers={answers}
          openCause={openCause} setOpenCause={setOpenCause} onReset={reset} variant={config.variant} />
      )}
    </main>
  );
}

function ImageStep({ busy, onFile, annotated }: { busy: boolean; onFile: (f: File) => void; annotated: string }) {
  return (
    <div>
      <label className="block cursor-pointer rounded-lg border border-dashed border-line bg-panel2 p-8 text-center hover:border-accent/60">
        <input type="file" accept="image/*" className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <p className="text-sm font-medium">{busy ? "Measuring…" : "Upload a dispensing image"}</p>
        <p className="mt-1 text-xs text-muted">Sample images are in vision/samples/</p>
      </label>
      {annotated && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted">
            Detected deposits. Green is within limits; amber undersized, red oversized, magenta irregular.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={annotated} alt="Annotated dispensing measurement" className="w-full rounded-lg border border-line" />
        </div>
      )}
    </div>
  );
}

function UrlStep({ busy, onProbe }: { busy: boolean; onProbe: (u: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input value={url} onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && url && onProbe(url)}
        placeholder="yourbusiness.com.my"
        className="flex-1 rounded-lg border border-line bg-panel2 px-4 py-2.5 text-sm outline-none focus:border-accent" />
      <button onClick={() => url && onProbe(url)} disabled={busy || !url}
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-40 hover:opacity-90">
        {busy ? "Inspecting…" : "Inspect site"}
      </button>
    </div>
  );
}

function Report({ analysis, annotated, answers, openCause, setOpenCause, onReset, variant }: {
  analysis: Analysis; annotated: string; answers: Answer[];
  openCause: string | null; setOpenCause: (v: string | null) => void;
  onReset: () => void; variant: VariantId;
}) {
  const phases = [...new Set(analysis.actions.map((a) => a.phase).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{analysis.headline}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">{analysis.summary}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{analysis.overall}<span className="text-base text-muted">/100</span></div>
            <div className="mt-1 flex gap-1">
              <Badge tone={analysis.meta.reproducible ? "good" : "warn"}>
                {analysis.meta.reproducible ? "reproducible" : "non-deterministic"}
              </Badge>
              {analysis.meta.grounded && <Badge tone="good">measured</Badge>}
            </div>
          </div>
        </div>
        {analysis.meta.notes.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-line pt-3">
            {analysis.meta.notes.map((n, i) => (
              <li key={i} className="text-xs text-muted">— {n}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Scores</SectionTitle>
        <div className="space-y-3">
          {analysis.dimensions.map((d) => (
            <div key={d.id}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{d.label}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Stars n={d.stars} /> {d.score}
                </span>
              </div>
              <Bar value={d.score} tone={toneFor(d.score)} />
              <p className="mt-1 text-[11px] text-muted/80">{d.rationale}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle hint={variant === "b"
          ? "Each percentage is derived. Open one to see every term that produced it."
          : "Percentages are the model's own judgement and are not derived from a fixed formula."}>
          Ranked analysis
        </SectionTitle>
        <div className="space-y-3">
          {analysis.causes.map((c) => {
            const open = openCause === c.id;
            const value = Math.round(c.likelihood * 100);
            return (
              <div key={c.id} className="rounded-lg border border-line bg-panel2 p-3">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="font-mono text-sm font-semibold">{value}%</span>
                </div>
                <Bar value={value} tone={toneFor(100 - value)} />
                <p className="mt-2 text-xs leading-relaxed text-muted">{c.reasoning}</p>

                {c.evidence.length > 0 && (
                  <button onClick={() => setOpenCause(open ? null : c.id)}
                    className="no-print mt-2 text-[11px] font-medium text-accent hover:underline">
                    {open ? "Hide" : "Show"} the arithmetic ({c.evidence.length} terms)
                  </button>
                )}

                {open && (
                  <div className="mt-2 space-y-1.5 rounded-md border border-line bg-panel p-3">
                    <p className="mb-2 text-[11px] text-muted">
                      Contributions in log-odds. The sum is converted to a probability, so every term below is
                      an independent piece of evidence rather than a weighting chosen after the fact.
                    </p>
                    {c.evidence.map((e, i) => (
                      <div key={i} className="flex gap-2 text-[11px]">
                        <span className={`w-12 shrink-0 text-right font-mono ${e.weight >= 0 ? "text-good" : "text-bad"}`}>
                          {e.weight >= 0 ? "+" : ""}{e.weight.toFixed(2)}
                        </span>
                        <span className="text-muted">
                          <strong className="text-ink">{e.label}</strong>
                          {e.source === "measurement" && <span className="ml-1 text-accent">[measured]</span>} — {e.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {c.checks.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {c.checks.slice(0, 2).map((chk, i) => (
                      <li key={i} className="text-[11px] text-muted/80">→ {chk}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle>Recommended plan</SectionTitle>
        {phases.length > 0 ? (
          phases.map((p) => (
            <div key={p} className="mb-4 last:mb-0">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{p}</h3>
                <Badge>{analysis.actions.find((a) => a.phase === p)?.horizon}</Badge>
              </div>
              <div className="space-y-2">
                {analysis.actions.filter((a) => a.phase === p).map((a) => (
                  <div key={a.order} className="rounded-lg border border-line bg-panel2 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{a.title}</span>
                      {a.impact && <Badge tone="accent">{a.impact}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted">{a.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <ol className="space-y-2">
            {analysis.actions.map((a) => (
              <li key={a.order} className="flex gap-3 rounded-lg border border-line bg-panel2 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                  {a.order}
                </span>
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{a.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {annotated && (
        <Card>
          <SectionTitle>Measured image</SectionTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={annotated} alt="Annotated dispensing measurement" className="w-full rounded-lg border border-line" />
        </Card>
      )}

      <Card className="hidden print:block">
        <SectionTitle>Assessment transcript</SectionTitle>
        <dl className="space-y-2">
          {answers.map((a) => (
            <div key={a.questionId}>
              <dt className="text-xs text-muted">{a.prompt}</dt>
              <dd className="text-sm font-medium">{a.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 border-t border-line pt-3 text-[11px] text-muted">
          Engine: {analysis.meta.engine} · {analysis.meta.reproducible ? "reproducible" : "non-deterministic"} ·
          generated in {analysis.meta.elapsedMs}ms. Engineer notes: _______________________________
        </p>
      </Card>

      <div className="no-print flex gap-2">
        <button onClick={() => window.print()}
          className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90">
          Download PDF report
        </button>
        <button onClick={onReset}
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:border-accent/60">
          Start over
        </button>
      </div>
    </div>
  );
}
