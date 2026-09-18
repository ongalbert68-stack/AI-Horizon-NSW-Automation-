import { apiRequest } from "@/lib/api/client";
import type { VisionResult } from "@/lib/api/types";

export function analysePhoto(caseId: number, photo: File) {
  const form = new FormData();
  form.set("photo", photo);
  return apiRequest<VisionResult>(`/cases/${caseId}/vision`, { method: "POST", formData: form });
}
