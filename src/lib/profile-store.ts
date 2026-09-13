import { useCloudDoc } from "./cloud-store";
import foxAvatar from "@/assets/avatars/fox.png";
import rabbitAvatar from "@/assets/avatars/rabbit.png";
import catAvatar from "@/assets/avatars/cat.png";
import bearAvatar from "@/assets/avatars/bear.png";
import owlAvatar from "@/assets/avatars/owl.png";
import frogAvatar from "@/assets/avatars/frog.png";
import dogAvatar from "@/assets/avatars/dog.png";
import tigerAvatar from "@/assets/avatars/tiger.png";
import fennecAvatar from "@/assets/avatars/fennec.png";

export type Profile = {
  name?: string;
  /** Id van een cartoon-avatar. */
  avatar?: string;
};

export const PROFILE_KEY = "profile-v1";

export const AVATAR_CHOICES = [
  { id: "fox", label: "Vos", src: foxAvatar },
  { id: "rabbit", label: "Konijn", src: rabbitAvatar },
  { id: "cat", label: "Kat", src: catAvatar },
  { id: "bear", label: "Beer", src: bearAvatar },
  { id: "owl", label: "Uil", src: owlAvatar },
  { id: "whale", label: "Kikker", src: frogAvatar },
  { id: "dog", label: "Hond", src: dogAvatar },
  { id: "tiger", label: "Tijger", src: tigerAvatar },
  { id: "fennec", label: "Woestijnvos", src: fennecAvatar },
] as const;

export function avatarSrc(id?: string) {
  return AVATAR_CHOICES.find((a) => a.id === id)?.src ?? AVATAR_CHOICES[0].src;
}

const EMPTY: Profile = {};

export function useProfile() {
  const { value, setValue, loaded } = useCloudDoc<Profile>(PROFILE_KEY, EMPTY);
  return { profile: value, setProfile: setValue, loaded };
}
