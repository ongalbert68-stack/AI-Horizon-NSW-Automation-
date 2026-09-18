import { apiRequest } from "@/lib/api/client";
import type { DispenseProfile, Page } from "@/lib/api/types";

export function listProfiles(params?: { limit?: number }) {
  return apiRequest<Page<DispenseProfile>>("/profiles", { searchParams: params });
}

export function getProfile(profileId: number) {
  return apiRequest<DispenseProfile>(`/profiles/${profileId}`);
}
