export type MacroSuggestion = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
};

/** Vraagt een AI-schatting van de macro's voor een etenswaar. */
export async function suggestMacros({
  data,
}: {
  data: { name: string; baseUnit: "g" | "ml" | "stuk" | "portie" };
}): Promise<MacroSuggestion> {
  const res = await fetch("/api/suggest-macros", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = (await res.json().catch(() => null)) as
    | (Partial<MacroSuggestion> & { error?: string })
    | null;
  if (!res.ok || !json) throw new Error(json?.error ?? "De AI-schatting is niet gelukt.");
  return {
    kcal: json.kcal ?? 0,
    protein: json.protein ?? 0,
    carbs: json.carbs ?? 0,
    fat: json.fat ?? 0,
    category: json.category ?? "voedselkast",
  };
}
