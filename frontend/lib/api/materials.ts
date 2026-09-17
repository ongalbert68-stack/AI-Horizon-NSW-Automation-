import { apiRequest } from "@/lib/api/client";
import type { FluidMaterial, FluidMaterialInput, Page } from "@/lib/api/types";

export function listMaterials(params?: { limit?: number; offset?: number }) {
  return apiRequest<Page<FluidMaterial>>("/materials", { searchParams: params });
}

export function getMaterial(materialId: number) {
  return apiRequest<FluidMaterial>(`/materials/${materialId}`);
}

export function createMaterial(data: FluidMaterialInput) {
  return apiRequest<FluidMaterial>("/materials", { method: "POST", body: data });
}

export function updateMaterial(materialId: number, data: Partial<FluidMaterialInput>) {
  return apiRequest<FluidMaterial>(`/materials/${materialId}`, { method: "PATCH", body: data });
}

export function deleteMaterial(materialId: number) {
  return apiRequest<void>(`/materials/${materialId}`, { method: "DELETE" });
}
