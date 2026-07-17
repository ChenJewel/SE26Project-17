import { apiClient } from "@/services/apiClient";
import type { PetCompanionState } from "@/hooks/usePetCompanion";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export type UserPetStateResponse = {
  userId: string;
  state: Partial<PetCompanionState>;
  updatedAt: string;
};

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
}

export async function fetchMyPetState() {
  const response = await apiClient.get<ApiEnvelope<UserPetStateResponse> | UserPetStateResponse>("/users/me/pet");
  return unwrapData(response);
}

export async function updateMyPetState(state: PetCompanionState) {
  const response = await apiClient.patch<ApiEnvelope<UserPetStateResponse> | UserPetStateResponse>("/users/me/pet", state);
  return unwrapData(response);
}
