import { NextResponse } from "next/server";
import { engineFor } from "@/engines";
import type { EngineContext, TrackId, VariantId } from "@/core/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = (await req.json()) as EngineContext & { variant: VariantId };
  const engine = engineFor(body.variant);
  const ctx = {
    track: body.track as TrackId,
    answers: body.answers ?? [],
    signals: body.signals ?? [],
  };
  const question = await engine.nextQuestion(ctx);
  return NextResponse.json({ question, engine: engine.id });
}
