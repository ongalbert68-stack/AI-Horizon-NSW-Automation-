// Proxies to the Python metrology service so the browser talks to one origin.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const VISION_URL = process.env.VISION_URL ?? "http://127.0.0.1:8000";

export async function POST(req: Request) {
  const incoming = await req.formData();
  try {
    const res = await fetch(`${VISION_URL}/measure`, {
      method: "POST",
      body: incoming,
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Metrology service returned ${res.status}.` }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { error: `Metrology service unreachable at ${VISION_URL}. Start it with: cd vision && .venv/bin/uvicorn main:app --port 8000` },
      { status: 503 },
    );
  }
}
