import { apiClient } from "@/services/apiClient";
import type { AnimatedPetState, AvatarPetState, PetCompanionState, PetStyle } from "@/hooks/usePetCompanion";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export type UserPetStateResponse = {
  userId: string;
  state: Partial<PetCompanionState>;
  updatedAt: string;
};

export type PublicPetSummary = {
  userId: string;
  visible: true;
  petStyle: PetStyle;
  animatedPet?: AnimatedPetState | null;
  avatarPet?: Partial<AvatarPetState> | null;
  petName: string;
  level?: number;
  mood?: number;
  intro?: string;
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

export async function fetchPublicPetSummary(userId: string) {
  const response = await apiClient.get<ApiEnvelope<{ pet: PublicPetSummary | null }> | { pet: PublicPetSummary | null }>(
    `/users/${userId}/pet-public`
  );
  return unwrapData(response).pet;
}
