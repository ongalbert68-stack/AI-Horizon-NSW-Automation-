// Groq adapter, via the OpenAI-compatible chat completions endpoint. Every call
// declares a fallback, so the whole system runs with no API key and survives a
// dead network during a live demo.

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

export function llmAvailable(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

interface JsonCallOptions<T> {
  system: string;
  prompt: string;
  /** Returned verbatim when no key is configured or the call fails. */
  fallback: T;
  temperature?: number;
}

export interface LlmResult<T> {
  data: T;
  live: boolean;
  note: string;
}

export async function llmJson<T>(opts: JsonCallOptions<T>): Promise<LlmResult<T>> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return { data: opts.fallback, live: false, note: "offline fallback (no GROQ_API_KEY)" };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.prompt },
        ],
        temperature: opts.temperature ?? 0.4,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      return { data: opts.fallback, live: false, note: `fallback (Groq HTTP ${res.status})` };
    }

    const body = await res.json();
    const text = body?.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      return { data: opts.fallback, live: false, note: "fallback (empty Groq response)" };
    }

    return { data: JSON.parse(text) as T, live: true, note: `groq:${MODEL}` };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    return { data: opts.fallback, live: false, note: `fallback (${reason})` };
  }
}
