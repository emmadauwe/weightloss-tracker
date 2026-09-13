import { useCloudDoc } from "./cloud-store";

export type Profile = {
  name?: string;
  /** Emoji-cartoon of "photo" wanneer een eigen foto is gekozen. */
  avatar?: string;
  photo?: string;
};

export const PROFILE_KEY = "profile-v1";

export const AVATAR_CHOICES = ["🥑", "🍋", "🌿", "🐣", "🐳", "🌸", "🦊", "☀️"] as const;

const EMPTY: Profile = {};

export function useProfile() {
  const { value, setValue, loaded } = useCloudDoc<Profile>(PROFILE_KEY, EMPTY);
  return { profile: value, setProfile: setValue, loaded };
}
