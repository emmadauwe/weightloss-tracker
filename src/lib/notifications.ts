import { useCallback, useMemo } from "react";
import { useCloudDoc } from "./cloud-store";
import { goalReached, progressKg, useFriends, useFriendStats, useHighFives } from "./social";
import { personalRecord, sportOf, useFriendWorkouts } from "./workouts";

export type Notification = {
  /** Stabiele sleutel voor de lijst. */
  id: string;
  kind: "milestone" | "goal" | "highfive" | "record";
  friendId: string;
  name: string;
  avatarId: string | null;
  text: string;
  /** Interne waarde die bij het sluiten wordt onthouden. */
  kg?: number;
  highFiveId?: string;
  /** Sessie-id van een sportrecord. */
  recordId?: string;
};

type Ack = Record<string, { kg?: number; goal?: boolean; record?: string }>;

const ACK_KEY = "friend-milestones-v1";

export function useNotifications() {
  const { friends } = useFriends();
  const stats = useFriendStats(friends.map((f) => f.friendId));
  const { received, markSeenOne, send } = useHighFives();
  const { value: ack, setValue: setAck } = useCloudDoc<Ack>(ACK_KEY, {});

  const items = useMemo<Notification[]>(() => {
    const out: Notification[] = [];
    const nameOf = (id: string) =>
      friends.find((f) => f.friendId === id)?.profile?.display_name ?? "Een vriend";
    const avatarOf = (id: string) => friends.find((f) => f.friendId === id)?.profile?.avatar_id ?? null;

    for (const f of friends) {
      const s = stats[f.friendId];
      if (!s) continue;
      const seen = ack[f.friendId] ?? {};
      const wantsGain = s.goal_type === "bijkomen" || s.goal_type === "spiermassa";

      if (goalReached(s) && !seen.goal) {
        out.push({
          id: `goal-${f.friendId}`,
          kind: "goal",
          friendId: f.friendId,
          name: nameOf(f.friendId),
          avatarId: avatarOf(f.friendId),
          text: `${nameOf(f.friendId)} heeft het doelgewicht bereikt! 🎉`,
        });
      }

      const prog = progressKg(s);
      const reached = prog != null && prog >= 1 ? Math.floor(prog) : 0;
      if (reached > (seen.kg ?? 0)) {
        out.push({
          id: `kg-${f.friendId}-${reached}`,
          kind: "milestone",
          friendId: f.friendId,
          name: nameOf(f.friendId),
          avatarId: avatarOf(f.friendId),
          kg: reached,
          text: `${nameOf(f.friendId)} is al ${reached} kg ${wantsGain ? "bijgekomen" : "afgevallen"}!`,
        });
      }
    }

    for (const h of received.filter((r) => !r.seen)) {
      out.push({
        id: `hf-${h.id}`,
        kind: "highfive",
        friendId: h.from_user,
        name: nameOf(h.from_user),
        avatarId: avatarOf(h.from_user),
        highFiveId: h.id,
        text: `${nameOf(h.from_user)} gaf je een high five 🙌`,
      });
    }

    return out;
  }, [friends, stats, ack, received]);

  const dismiss = useCallback(
    async (n: Notification) => {
      if (n.kind === "highfive" && n.highFiveId) {
        await markSeenOne(n.highFiveId);
        return;
      }
      setAck((prev) => ({
        ...prev,
        [n.friendId]: {
          ...(prev[n.friendId] ?? {}),
          ...(n.kind === "goal" ? { goal: true } : { kg: n.kg }),
        },
      }));
    },
    [markSeenOne, setAck],
  );

  const highFive = useCallback(
    async (n: Notification) => {
      await send(n.friendId, n.kind === "goal" ? "goal" : "milestone");
      await dismiss(n);
    },
    [send, dismiss],
  );

  return { items, dismiss, highFive };
}
