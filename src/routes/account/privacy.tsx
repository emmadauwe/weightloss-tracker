import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useMyProfile, type Privacy } from "@/lib/social";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/account/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy | Lichter" },
      { name: "description", content: "Bepaal zelf wat je vrienden van jou kunnen zien." },
      { property: "og:title", content: "Privacy | Lichter" },
      { property: "og:description", content: "Bepaal zelf wat je vrienden van jou kunnen zien." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const OPTIONS: { key: keyof Privacy; label: string; hint: string }[] = [
  { key: "share_weight", label: "Huidig gewicht", hint: "Wat je vandaag weegt." },
  { key: "share_goal", label: "Doelgewicht", hint: "Het gewicht dat je wil bereiken." },
  {
    key: "share_progress",
    label: "Voortgangsmeter",
    hint: "Alleen het percentage richting je doel — zonder gewichten.",
  },
  { key: "share_dishes", label: "Recepten", hint: "Vrienden mogen je gerechten bekijken en overnemen." },
];

function PrivacyPage() {
  const { profile, loaded, update } = useMyProfile();

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Privacy" subtitle="Wat zien vrienden van jou?" back />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        <Card>
          <CardContent className="px-5 py-4">
            <p className="text-xs text-muted-foreground">
              Alleen vrienden die je hebt geaccepteerd kunnen iets zien. Alles wat hieronder uitstaat blijft
              volledig privé.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            {OPTIONS.map((o, i) => (
              <div
                key={o.key}
                className={`flex items-center gap-3 px-5 py-4 ${i === OPTIONS.length - 1 ? "" : "border-b border-border"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground">{o.hint}</div>
                </div>
                <Switch
                  checked={profile ? profile[o.key] : true}
                  disabled={!loaded || !profile}
                  onCheckedChange={(v) => void update({ [o.key]: v } as Partial<Privacy>)}
                  aria-label={o.label}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
