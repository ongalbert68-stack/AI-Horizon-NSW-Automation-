import { apiRequest } from "@/lib/api/client";
import type { DispenseStation, DispenseStationInput, Page } from "@/lib/api/types";

export function listStations(params?: { limit?: number; offset?: number }) {
  return apiRequest<Page<DispenseStation>>("/stations", { searchParams: params });
}

export function getStation(stationId: number) {
  return apiRequest<DispenseStation>(`/stations/${stationId}`);
}

export function createStation(data: DispenseStationInput) {
  return apiRequest<DispenseStation>("/stations", { method: "POST", body: data });
}

export function updateStation(stationId: number, data: Partial<DispenseStationInput>) {
  return apiRequest<DispenseStation>(`/stations/${stationId}`, { method: "PATCH", body: data });
}

export function deleteStation(stationId: number) {
  return apiRequest<void>(`/stations/${stationId}`, { method: "DELETE" });
}
