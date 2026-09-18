import { apiRequest } from "@/lib/api/client";
import type {
  DispenseProfile,
  DispenseProfileCreate,
  DispenseProfileUpdate,
  Page,
} from "@/lib/api/types";

export function listProfiles(params?: { limit?: number; offset?: number }) {
  return apiRequest<Page<DispenseProfile>>("/profiles", { searchParams: params });
}

export function getProfile(profileId: number) {
  return apiRequest<DispenseProfile>(`/profiles/${profileId}`);
}

export function createProfile(data: DispenseProfileCreate) {
  return apiRequest<DispenseProfile>("/profiles", {
    method: "POST",
    body: data,
  });
}

export function updateProfile(profileId: number, data: DispenseProfileUpdate) {
  return apiRequest<DispenseProfile>(`/profiles/${profileId}`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteProfile(profileId: number) {
  return apiRequest<void>(`/profiles/${profileId}`, {
    method: "DELETE",
  });
}
