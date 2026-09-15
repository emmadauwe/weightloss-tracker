import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Check, ChevronRight, LogOut, Pencil, ShieldCheck, Target, Trash2, Users, UserRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/lib/account.functions";
import { AVATAR_CHOICES, avatarSrc, useProfile } from "@/lib/profile-store";
import { useAuth, signOut } from "@/lib/auth";
import { useFriends } from "@/lib/social";
import { useNotifications } from "@/lib/notifications";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/account/")({
  head: () => ({
    meta: [
      { title: "Account | Lichter" },
      { name: "description", content: "Beheer je profiel, je gegevens, je doel, je privacy en je vrienden." },
      { property: "og:title", content: "Account | Lichter" },
      { property: "og:description", content: "Beheer je profiel, je gegevens, je doel, je privacy en je vrienden." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { profile, setProfile } = useProfile();
  const { user } = useAuth();
  const { incoming } = useFriends();
  const { items: notifications } = useNotifications();


  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(profile.name ?? "");

  useEffect(() => {
    if (!editingName) setDraft(profile.name ?? "");
  }, [profile.name, editingName]);

  const hasName = Boolean(profile.name?.trim());
  const badge = incoming.length + notifications.length;

  const saveName = () => {
    setProfile({ ...profile, name: draft.trim() || undefined });
    setEditingName(false);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Account" subtitle="Profiel, gegevens en vrienden" />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        <Card>
          <CardContent className="px-5 py-5 space-y-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label="Kies een cartoon"
                onClick={() => setPickerOpen((o) => !o)}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-background"
              >
                <img
                  src={avatarSrc(profile.avatar)}
                  alt="Je cartoon"
                  width={512}
                  height={512}
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="min-w-0 flex-1">
                {editingName || !hasName ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Je naam"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      autoFocus={editingName}
                    />
                    <div className="flex gap-2">
                      {hasName ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" disabled={!draft.trim() || draft.trim() === profile.name}>
                              <Check className="mr-1 h-4 w-4" /> Opslaan
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Naam wijzigen?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Je vrienden zien voortaan “{draft.trim()}” in plaats van “{profile.name}”.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuleren</AlertDialogCancel>
                              <AlertDialogAction onClick={saveName}>Ja, wijzigen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button size="sm" disabled={!draft.trim()} onClick={saveName}>
                          <Check className="mr-1 h-4 w-4" /> Opslaan
                        </Button>
                      )}
                      {hasName && (
                        <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                          Annuleren
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="truncate text-xl font-semibold"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {profile.name}
                      </div>
                      <button
                        type="button"
                        aria-label="Naam wijzigen"
                        onClick={() => setEditingName(true)}
                        className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
                      >
                        <Pencil className="h-3.5 w-3.5 text-primary" />
                      </button>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{user?.email ?? "—"}</div>
                  </div>
                )}
              </div>
            </div>

            {pickerOpen && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="text-xs text-muted-foreground">Kies je cartoon</div>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_CHOICES.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      aria-label={a.label}
                      onClick={() => {
                        setProfile({ ...profile, avatar: a.id });
                        setPickerOpen(false);
                      }}
                      className={`h-12 w-12 overflow-hidden rounded-full border transition-colors ${
                        profile.avatar === a.id ? "border-primary" : "border-border hover:bg-accent"
                      }`}
                    >
                      <img src={a.src} alt={a.label} width={512} height={512} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Row to="/account/gegevens" icon={UserRound} label="Gegevens" hint="Gewicht, lengte, leeftijd" />
            <Row to="/account/doel" icon={Target} label="Doel" hint="Doeltype, sport, macro's" />
            <Row to="/account/privacy" icon={ShieldCheck} label="Privacy" hint="Wat zien vrienden van jou?" />
            <Row to="/account/vrienden" icon={Users} label="Vrienden" hint="Zoeken, verzoeken, high fives" badge={badge} last />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Ingelogd als</div>
              <div className="truncate text-sm">{user?.email ?? "—"}</div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <LogOut className="mr-1 h-4 w-4 text-primary" /> Uitloggen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Wil je uitloggen?</AlertDialogTitle>
                  <AlertDialogDescription>Weet je zeker dat je uit je account wilt uitloggen?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void signOut()}>Ja, uitloggen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <DeleteAccountCard />
      </main>
    </div>
  );
}

function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = useServerFn(deleteMyAccount);

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await remove();
      await signOut();
      window.location.href = "/";
    } catch {
      setError("Verwijderen is niet gelukt. Probeer het later opnieuw.");
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 px-5 py-4">
        <div>
          <div className="text-sm font-medium text-destructive">Account verwijderen</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Je profiel, gewichten, gerechten, ingrediënten, planning en vrienden worden permanent gewist. Dit kan niet
            ongedaan gemaakt worden. Je kunt later wel opnieuw een leeg account maken met hetzelfde e-mailadres.
          </p>
        </div>
        {!open ? (
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Account permanent verwijderen
          </Button>
        ) : (
          <div className="space-y-2">
            <label htmlFor="confirm-delete" className="block text-xs font-medium">
              Typ <span className="font-semibold">VERWIJDER</span> om te bevestigen
            </label>
            <Input
              id="confirm-delete"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="VERWIJDER"
              autoComplete="off"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setOpen(false); setConfirm(""); }}>
                Annuleren
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    disabled={confirm.trim().toUpperCase() !== "VERWIJDER" || busy}
                  >
                    {busy ? "Bezig…" : "Verwijderen"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Alles definitief verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Al je gegevens verdwijnen voorgoed: gewichten, doel, gerechten, ingrediënten, planning, vrienden
                      en je profiel. Dit kan echt niet meer teruggedraaid worden.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Nee, behouden</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleDelete()}>Ja, alles verwijderen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  to,
  icon: Icon,
  label,
  hint,
  badge,
  last,
}: {
  to: string;
  icon: typeof Users;
  label: string;
  hint: string;
  badge?: number;
  last?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-5 py-4 transition-colors hover:bg-accent ${last ? "" : "border-b border-border"}`}
    >
      <Icon className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="truncate text-xs text-muted-foreground">{hint}</div>
      </div>
      {badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {badge}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
