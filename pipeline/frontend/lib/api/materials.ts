import { apiRequest } from "@/lib/api/client";
import type {
  FluidMaterial,
  FluidMaterialCreate,
  FluidMaterialUpdate,
  Page,
} from "@/lib/api/types";

export function listMaterials(params?: { limit?: number; offset?: number }) {
  return apiRequest<Page<FluidMaterial>>("/materials", { searchParams: params });
}

export function getMaterial(materialId: number) {
  return apiRequest<FluidMaterial>(`/materials/${materialId}`);
}

export function createMaterial(data: FluidMaterialCreate) {
  return apiRequest<FluidMaterial>("/materials", {
    method: "POST",
    body: data,
  });
}

export function updateMaterial(materialId: number, data: FluidMaterialUpdate) {
  return apiRequest<FluidMaterial>(`/materials/${materialId}`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteMaterial(materialId: number) {
  return apiRequest<void>(`/materials/${materialId}`, {
    method: "DELETE",
  });
}
