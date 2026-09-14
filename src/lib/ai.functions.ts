import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  name: z.string().min(1).max(120),
  baseUnit: z.enum(["g", "ml", "stuk", "portie"]),
});

export type MacroSuggestion = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
};

export const suggestMacros = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<MacroSuggestion> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is niet beschikbaar.");

    const per =
      data.baseUnit === "g" || data.baseUnit === "ml"
        ? `per 100 ${data.baseUnit}`
        : `per 1 ${data.baseUnit}`;

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
            content: `Geef de gemiddelde voedingswaarden van "${data.name}" ${per}. Antwoord als JSON met de sleutels kcal, protein, carbs, fat (getallen, gram) en category (één van: "zuivel en eieren", "noten, zaden en peulvruchten", "groenten en fruit", "vleesvervangers", "granen en deegwaren", "kruiden en sauzen", "vetten en oliën", "bereide maaltijden", "voedselkast", "dranken", "koekjes en snoepjes").`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Even te druk. Probeer het zo opnieuw.");
    if (res.status === 402) throw new Error("Geen AI-tegoed meer beschikbaar.");
    if (!res.ok) throw new Error("De AI-schatting is niet gelukt.");

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const num = (v: unknown) => {
      const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
      return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : 0;
    };
    return {
      kcal: num(parsed["kcal"]),
      protein: num(parsed["protein"]),
      carbs: num(parsed["carbs"]),
      fat: num(parsed["fat"]),
      category: typeof parsed["category"] === "string" ? (parsed["category"] as string) : "voedselkast",
    };
  });
