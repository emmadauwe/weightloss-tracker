import { useCloudDoc } from "./cloud-store";
import foxAvatar from "@/assets/avatars/fox.png";
import rabbitAvatar from "@/assets/avatars/rabbit.png";
import catAvatar from "@/assets/avatars/cat.png";
import bearAvatar from "@/assets/avatars/bear.png";
import owlAvatar from "@/assets/avatars/owl.png";
import whaleAvatar from "@/assets/avatars/whale.png";

export type Profile = {
  name?: string;
  /** Id van een cartoon-avatar. */
  avatar?: string;
  photo?: string;
};

export const PROFILE_KEY = "profile-v1";

export const AVATAR_CHOICES = [
  { id: "fox", label: "Vos", src: foxAvatar },
  { id: "rabbit", label: "Konijn", src: rabbitAvatar },
  { id: "cat", label: "Kat", src: catAvatar },
  { id: "bear", label: "Beer", src: bearAvatar },
  { id: "owl", label: "Uil", src: owlAvatar },
  { id: "whale", label: "Walvis", src: whaleAvatar },
] as const;

export function avatarSrc(id?: string) {
  return AVATAR_CHOICES.find((a) => a.id === id)?.src ?? AVATAR_CHOICES[0].src;
}

const EMPTY: Profile = {};

export function useProfile() {
  const { value, setValue, loaded } = useCloudDoc<Profile>(PROFILE_KEY, EMPTY);
  return { profile: value, setProfile: setValue, loaded };
}
