import { apiRequest } from "@/lib/api/client";
import type { DispenseProfile, DispenseProfileInput, Page } from "@/lib/api/types";

export function listProfiles(params?: { limit?: number; offset?: number }) {
  return apiRequest<Page<DispenseProfile>>("/profiles", { searchParams: params });
}

export function getProfile(profileId: number) {
  return apiRequest<DispenseProfile>(`/profiles/${profileId}`);
}

export function createProfile(data: DispenseProfileInput) {
  return apiRequest<DispenseProfile>("/profiles", { method: "POST", body: data });
}

export function updateProfile(profileId: number, data: Partial<DispenseProfileInput>) {
  return apiRequest<DispenseProfile>(`/profiles/${profileId}`, { method: "PATCH", body: data });
}

export function deleteProfile(profileId: number) {
  return apiRequest<void>(`/profiles/${profileId}`, { method: "DELETE" });
}
