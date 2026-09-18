import { apiRequest } from "@/lib/api/client";
import type { Ranking } from "@/lib/api/types";

export function rankCase(caseId: number) {
  return apiRequest<Ranking>(`/cases/${caseId}/rank`, { method: "POST" });
}
