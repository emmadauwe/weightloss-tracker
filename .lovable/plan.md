## Doel

De bestaande gewichtstracker uitbreiden met een volwaardige calorie- en macrotracker, en beide functies slim met elkaar verweven. Daarnaast een kleine visuele fix voor halftransparante icoontjes.

---

## 1. Icoontjes fix (kleine visuele aanpassing)

- Doorlopen van alle Lucide-icoontjes in de app (header, FAB, stats-cards, bottom-nav, dialogs).
- `text-muted-foreground` op icoontjes vervangen door `text-primary` (de sage groen `#97b185`) waar ze nu vaag/grijs ogen.
- Zorgen dat `stroke-width` consistent is (2) en geen `opacity-*` of `/50`/`/70` classes meer op svg's staan.
- Bottom-nav inactieve tab krijgt een iets donkerdere muted variant in plaats van transparant.

---

## 2. Nieuwe navigatiestructuur

Onderaan de app komt één tab-bar met alle hoofdsecties:

```text
[ Gewicht ] [ Vandaag ] [ Gerechten ] [ Ingrediënten ] [ Doel ]
```

- **Gewicht** — huidige dashboard (hero, stats, grafiek, geschiedenis) blijft staan.
- **Vandaag** — dagplanning met ontbijt / lunch / diner / snack en macro-overzicht.
- **Gerechten** — gerechtenbibliotheek met ingrediëntsamenstelling, bereiding, link naar recept.
- **Ingrediënten** — database met macro's per 100 g / 100 ml / stuk.
- **Doel** — algemeen doel (afvallen / op gewicht blijven / bijkomen / spiermassa), persoonsdata, berekende kcal & macro's, met gezondheidschecks.

Routes worden TanStack file-based:
- `src/routes/index.tsx` (gewicht — bestaand)
- `src/routes/vandaag.tsx`
- `src/routes/gerechten.tsx`
- `src/routes/ingredienten.tsx`
- `src/routes/doel.tsx`

Een gedeelde `BottomNav` en `AppShell` worden uit `index.tsx` getrokken naar `src/components/`.

---

## 3. Datamodel (localStorage)

Nieuwe stores naast de bestaande weight/settings store:

```text
Ingredient {
  id, name, unit: "g" | "ml" | "stuk" | "portie",
  per: 100 | 1,            // 100 voor g/ml, 1 voor stuk/portie
  kcal, protein, carbs, fat
}

Dish {
  id, name, servings, recipeUrl?, steps?,
  items: [{ ingredientId, amount, unit }]
}

MealEntry {
  id, date (YYYY-MM-DD),
  meal: "ontbijt" | "lunch" | "diner" | "snack",
  kind: "dish" | "ingredient",
  refId, amount, unit
}

Goal {
  type: "afvallen" | "behouden" | "bijkomen" | "spiermassa",
  age, sex: "v" | "m",
  activity: "laag" | "matig" | "hoog",
  // afgeleid:
  kcalTarget, proteinTarget, carbsTarget, fatTarget,
  overrideKcal?, overrideProtein?, overrideCarbs?, overrideFat?
}
```

Lengte, begin/eindgewicht en begin/einddatum komen uit de bestaande `Settings`.

Een kleine seed-set van veelvoorkomende ingrediënten (ei, kipfilet, rijst, havermout, banaan, olijfolie, brood, melk, …) wordt bij eerste start ingeladen zodat de app meteen bruikbaar is.

---

## 4. Berekeningen

**BMR** (Mifflin-St Jeor) → **TDEE** (BMR × activiteitsfactor).

Per doeltype een dagelijks kcal-doel:
- afvallen: TDEE − (kg te verliezen × 7700 / dagen tot deadline)
- bijkomen: TDEE + (kg bij te krijgen × 7700 / dagen tot deadline)
- behouden: TDEE
- spiermassa: TDEE + ~300 kcal, hogere eiwitratio

Macro-verdeling:
- eiwit: 1.8 g/kg lichaamsgewicht (2.0 bij spiermassa)
- vet: 25–30% van kcal
- koolhydraten: rest

Gezondheidsregels:
- Verlies > 1.0 kg/week → waarschuwing "te ambitieus".
- Aanrader 0,5 kg/week (bestaand) blijft leidend.
- kcal-doel onder 1500 (v) / 1800 (m) → waarschuwing.
- Eiwit < 0,8 g/kg → waarschuwing.

Waarschuwingen tonen we als zachte rode card (`#C88177`), positieve bevestiging in sage.

---

## 5. Slimme combinatie gewicht ↔ calorieën

Hier zit de meerwaarde t.o.v. twee losse apps:

1. **Energie-balans van vandaag** op het Gewicht-dashboard: een extra mini-kaart "Vandaag: 1740 / 2000 kcal — op koers" gevoed door de meals van vandaag.
2. **Voorspelling**: op basis van gemiddelde kcal-inname van laatste 7 dagen vs. TDEE rekenen we voorspeld gewichtsverloop en projecteren een tweede (gestippelde) lijn in de gewichtsgrafiek. Zo zie je of je huidige eetpatroon je naar je doelgewicht brengt.
3. **Adaptief kcal-doel**: als de gewichtsgrafiek aangeeft dat je sneller of trager afvalt dan voorspeld, stelt de Doel-pagina een bijgestelde kcal-suggestie voor (zonder automatisch te overschrijven).
4. **Wegen-reminder** op Vandaag als er die dag nog geen gewicht is ingevoerd: kleine sage chip "Nog niet gewogen vandaag" met snelle invoer.
5. **Eén gedeelde hero** boven Vandaag: huidig gewicht + resterende kcal vandaag, zodat beide werelden in één blik samenkomen.

---

## 6. UI per pagina (mobiel-first)

**Vandaag**
- Datumkiezer (vandaag, vorige/volgende dag-pijltjes).
- Macro-ring of -balken bovenaan: kcal, eiwit, kh, vet vs. doel.
- Vier secties (Ontbijt / Lunch / Diner / Snack), elk een lijst met items + totaalkcal en een "+ toevoegen" knop die een sheet opent.
- In de sheet: zoeken in gerechten + ingrediënten, hoeveelheid + eenheid kiezen.

**Gerechten**
- Lijst met gerechten, zoekbalk, FAB voor nieuw gerecht.
- Detail: naam, porties, ingrediënten (zoek + hoeveelheid), bereidingsstappen (textarea per stap), recept-URL, automatisch berekende macro's per portie.

**Ingrediënten**
- Lijst met zoekbalk en filter op eenheid.
- FAB voor nieuw ingrediënt: naam, basis-eenheid (g/ml/stuk/portie), macro's per 100 g/ml of per stuk.
- Bewerken en verwijderen (verwijderen geblokkeerd als ingrediënt nog in een gerecht of meal voorkomt — vervangen of forceren via dialog).

**Doel**
- Doeltype-keuze (4 chips).
- Persoonsdata (leeftijd, geslacht, activiteit) — lengte en gewichten worden hergebruikt uit settings.
- Berekende kcal & macro's met live update.
- Overschrijfbare velden (kcal, eiwit, kh, vet) met "reset naar berekend".
- Waarschuwingsbanner bij ongezonde keuzes.

---

## 7. Technische aanpak

- Alle nieuwe stores als hooks in `src/lib/` (`nutrition-store.ts`, `goal-store.ts`), zelfde patroon als bestaande `weight-store.ts`.
- Berekeningen pure functies in `src/lib/nutrition-math.ts` (BMR, TDEE, macro-split, gezondheidschecks).
- Bestaande styling, sage-palet, Inter/Fraunces blijven ongewijzigd.
- Bottom-nav herbruikbaar als `src/components/bottom-nav.tsx`.
- Geen backend nodig — alles localStorage. (Cloud sync kan later als de gebruiker dat wil.)

---

## 8. Niet in deze plan

- Cloud sync / login (kan later via Lovable Cloud).
- Barcode-scanner of externe voedingsdatabase (kan later).
- Wateropname, stappen, sport-tracking.

Akkoord met deze opzet, of wil je iets toevoegen / weglaten (bv. een ander vertrekpunt voor de ingrediëntendatabase, of toch week- in plaats van dagplanning)?
