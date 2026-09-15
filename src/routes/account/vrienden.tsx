import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell, Check, ChevronRight, Hand, Search, Trash2, UserPlus, X } from "lucide-react";
import { avatarSrc } from "@/lib/profile-store";
import {
  friendSummary,
  useFriends,
  useFriendStats,
  type ProfileRow,
} from "@/lib/social";
import { useNotifications } from "@/lib/notifications";
import { AppHeader } from "@/components/app-header";


export const Route = createFileRoute("/account/vrienden")({
  head: () => ({
    meta: [
      { title: "Vrienden | Lichter" },
      { name: "description", content: "Zoek vrienden, volg hun voortgang en geef een high five." },
      { property: "og:title", content: "Vrienden | Lichter" },
      { property: "og:description", content: "Zoek vrienden, volg hun voortgang en geef een high five." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VriendenPage,
});

function VriendenPage() {
  const { friends, incoming, outgoing, findByEmail, sendRequest, accept, removeLink, reload } = useFriends();
  const { items: notifications, dismiss, highFive: highFiveFor } = useNotifications();
  const stats = useFriendStats(friends.map((f) => f.friendId));

  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<{ id: string; display_name: string | null; avatar_id: string | null } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const search = async () => {
    setMessage(null);
    setFound(null);
    if (!email.trim()) return;
    setSearching(true);
    const row = await findByEmail(email.trim());
    setSearching(false);
    if (!row) {
      setMessage("Geen account gevonden met dit e-mailadres.");
      return;
    }
    setFound(row);
  };

  const invite = async (id: string) => {
    const { error } = await sendRequest(id);
    setFound(null);
    setEmail("");
    setMessage(error ?? "Verzoek verstuurd.");
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Vrienden" subtitle="Samen volhouden" back />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        {/* Zoeken */}
        <Card>
          <CardContent className="space-y-3 px-5 py-4">
            <div className="text-sm font-medium">Vriend zoeken</div>
            <div className="flex gap-2">
              <Input
                type="email"
                inputMode="email"
                placeholder="E-mailadres"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void search();
                }}
              />
              <Button onClick={() => void search()} disabled={searching}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {found && (
              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <img src={avatarSrc(found.avatar_id)} alt="" width={512} height={512} className="h-9 w-9 rounded-full object-cover" />
                <div className="min-w-0 flex-1 truncate text-sm">{found.display_name ?? "Zonder naam"}</div>
                <Button size="sm" onClick={() => void invite(found.id)}>
                  <UserPlus className="mr-1 h-4 w-4" /> Vraag
                </Button>
              </div>
            )}
            {message && <p className="text-xs text-muted-foreground">{message}</p>}
            <p className="text-xs text-muted-foreground">
              Zoeken lukt alleen met het volledige e-mailadres van je vriend.
            </p>
          </CardContent>
        </Card>

        {/* Meldingen */}
        {notifications.length > 0 && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="space-y-2 px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Bell className="h-4 w-4" /> Meldingen
              </div>
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <img
                      src={avatarSrc(n.avatarId)}
                      alt=""
                      width={512}
                      height={512}
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1 text-xs">{n.text}</div>
                    {n.kind !== "highfive" && (
                      <Button size="sm" variant="outline" onClick={() => void highFiveFor(n)}>
                        <Hand className="mr-1 h-4 w-4 text-primary" /> High five
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" aria-label="Melding sluiten" onClick={() => void dismiss(n)}>
                      <X className="h-4 w-4 text-primary" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verzoeken */}
        {incoming.length > 0 && (
          <Card>
            <CardContent className="space-y-3 px-5 py-4">
              <div className="text-sm font-medium">Verzoeken voor jou</div>
              {incoming.map((l) => (
                <div key={l.id} className="flex items-center gap-3">
                  <Avatar p={l.profile} />
                  <div className="min-w-0 flex-1 truncate text-sm">{l.profile?.display_name ?? "Zonder naam"}</div>
                  <Button size="sm" onClick={() => void accept(l.id)}>
                    <Check className="mr-1 h-4 w-4" /> Accepteer
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Weigeren" onClick={() => void removeLink(l.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {outgoing.length > 0 && (
          <Card>
            <CardContent className="space-y-3 px-5 py-4">
              <div className="text-sm font-medium">Verstuurde verzoeken</div>
              {outgoing.map((l) => (
                <div key={l.id} className="flex items-center gap-3">
                  <Avatar p={l.profile} />
                  <div className="min-w-0 flex-1 truncate text-sm">{l.profile?.display_name ?? "Zonder naam"}</div>
                  <span className="text-xs text-muted-foreground">Wacht op antwoord</span>
                  <Button size="sm" variant="ghost" aria-label="Intrekken" onClick={() => void removeLink(l.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Vrienden */}
        <Card>
          <CardContent className="space-y-3 px-5 py-4">
            <div className="text-sm font-medium">Je vrienden</div>
            {friends.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nog geen vrienden. Zoek iemand op e-mailadres en stuur een verzoek.
              </p>
            ) : (
              friends.map((f) => {
                const summary = friendSummary(stats[f.friendId], f.profile);
                return (
                  <div key={f.id} className="rounded-lg border border-border">
                    <Link
                      to="/vriend/$id"
                      params={{ id: f.friendId }}
                      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent"
                    >
                      <Avatar p={f.profile} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{f.profile?.display_name ?? "Zonder naam"}</div>
                        <div className="truncate text-xs text-muted-foreground">{summary}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                    <div className="flex justify-end border-t border-border px-3 py-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await removeLink(f.id);
                          await reload();
                        }}
                      >
                        <Trash2 className="mr-1 h-4 w-4 text-destructive" /> Verwijderen
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Avatar({ p }: { p: ProfileRow | null }) {
  return (
    <img
      src={avatarSrc(p?.avatar_id)}
      alt=""
      width={512}
      height={512}
      className="h-9 w-9 shrink-0 rounded-full object-cover"
    />
  );
}
