import { createFileRoute } from "@tanstack/react-router";

export type MacroSuggestion = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
};

const UNITS = ["g", "ml", "stuk", "portie"] as const;

export const Route = createFileRoute("/api/suggest-macros")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "AI is niet beschikbaar." }, { status: 500 });

        const body = (await request.json().catch(() => null)) as
          | { name?: unknown; baseUnit?: unknown }
          | null;
        const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
        const baseUnit = UNITS.includes(body?.baseUnit as (typeof UNITS)[number])
          ? (body?.baseUnit as (typeof UNITS)[number])
          : "portie";
        if (!name) return Response.json({ error: "Geef eerst een naam op." }, { status: 400 });

        const per = baseUnit === "g" || baseUnit === "ml" ? `per 100 ${baseUnit}` : `per 1 ${baseUnit}`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "google/gemini-3.8-flash",
            messages: [
              {
                role: "system",
                content:
                  "Je bent een voedingsdeskundige. Geef realistische gemiddelde voedingswaarden van Nederlandse/Belgische supermarktproducten. Antwoord uitsluitend met JSON.",
              },
              {
                role: "user",
                content: `Geef de gemiddelde voedingswaarden van "${name}" ${per}. Antwoord als JSON met de sleutels kcal, protein, carbs, fat (getallen, gram) en category (één van: "zuivel en eieren", "noten, zaden en peulvruchten", "groenten en fruit", "vleesvervangers", "granen en deegwaren", "kruiden en sauzen", "vetten en oliën", "bereide maaltijden", "voedselkast", "dranken", "koekjes en snoepjes").`,
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (res.status === 429)
          return Response.json({ error: "Even te druk. Probeer het zo opnieuw." }, { status: 429 });
        if (res.status === 402)
          return Response.json({ error: "Geen AI-tegoed meer beschikbaar." }, { status: 402 });
        if (!res.ok)
          return Response.json({ error: "De AI-schatting is niet gelukt." }, { status: 502 });

        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = json.choices?.[0]?.message?.content ?? "{}";
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(content) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "De AI-schatting is niet gelukt." }, { status: 502 });
        }
        const num = (v: unknown) => {
          const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
          return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : 0;
        };
        const suggestion: MacroSuggestion = {
          kcal: num(parsed["kcal"]),
          protein: num(parsed["protein"]),
          carbs: num(parsed["carbs"]),
          fat: num(parsed["fat"]),
          category: typeof parsed["category"] === "string" ? (parsed["category"] as string) : "voedselkast",
        };
        return Response.json(suggestion);
      },
    },
  },
});
