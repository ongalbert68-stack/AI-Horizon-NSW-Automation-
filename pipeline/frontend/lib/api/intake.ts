import { apiRequest } from "@/lib/api/client";
import type { MapFreeTextResponse, Question } from "@/lib/api/types";

export function getIntakeSpec() {
  return apiRequest<Question[]>("/intake/spec");
}

export function mapFreeText(data: { case_id: number; question_id: string; text: string }) {
  return apiRequest<MapFreeTextResponse>("/intake/map", { method: "POST", body: data });
}
