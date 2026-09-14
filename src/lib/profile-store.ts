import { useCallback } from "react";
import { useMyProfile } from "./social";
import foxAvatar from "@/assets/avatars/fox.png";
import rabbitAvatar from "@/assets/avatars/rabbit.png";
import catAvatar from "@/assets/avatars/cat.png";
import bearAvatar from "@/assets/avatars/bear.png";
import owlAvatar from "@/assets/avatars/owl.png";
import dogAvatar from "@/assets/avatars/dog.png";
import tigerAvatar from "@/assets/avatars/tiger.png";
import fennecAvatar from "@/assets/avatars/fennec.png";

export type Profile = {
  name?: string;
  /** Id van een cartoon-avatar. */
  avatar?: string;
};

export const AVATAR_CHOICES = [
  { id: "fox", label: "Vos", src: foxAvatar },
  { id: "rabbit", label: "Konijn", src: rabbitAvatar },
  { id: "cat", label: "Kat", src: catAvatar },
  { id: "bear", label: "Beer", src: bearAvatar },
  { id: "owl", label: "Uil", src: owlAvatar },
  { id: "dog", label: "Hond", src: dogAvatar },
  { id: "tiger", label: "Tijger", src: tigerAvatar },
  { id: "fennec", label: "Woestijnvos", src: fennecAvatar },
] as const;

export function avatarSrc(id?: string | null) {
  return AVATAR_CHOICES.find((a) => a.id === id)?.src ?? AVATAR_CHOICES[0].src;
}

/** Profiel (naam + cartoon) leeft in de gedeelde profieltabel, zodat vrienden het kunnen zien. */
export function useProfile() {
  const { profile, loaded, update } = useMyProfile();

  const setProfile = useCallback(
    (next: Profile) => {
      void update({
        display_name: next.name ?? null,
        avatar_id: next.avatar ?? null,
      });
    },
    [update],
  );

  return {
    profile: {
      name: profile?.display_name ?? undefined,
      avatar: profile?.avatar_id ?? undefined,
    } as Profile,
    setProfile,
    loaded,
  };
}
