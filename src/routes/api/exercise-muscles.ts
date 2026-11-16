import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "@/lib/ai/run-id";
import { ANATOMY_VERSION, GENERAL_MUSCLE_IDS, MUSCLE_IDS, type MuscleId } from "@/lib/muscles";

const inputSchema = z.object({ name: z.string().trim().min(1).max(120) });
const detailedIds = MUSCLE_IDS.filter((id) => !GENERAL_MUSCLE_IDS.includes(id)) as [MuscleId, ...MuscleId[]];
const outputSchema = z.object({
  muscles: z.array(z.object({ id: z.enum(detailedIds), intensity: z.number() })),
  summary: z.string(),
});

export const Route = createFileRoute("/api/exercise-muscles")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "AI is niet beschikbaar." }, { status: 500 });
        const parsedInput = inputSchema.safeParse(await request.json().catch(() => null));
        if (!parsedInput.success) return Response.json({ error: "Geef een geldige oefening op." }, { status: 400 });

        try {
          const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
          const provider = createOpenAI({
            baseURL: "https://ai.gateway.lovable.dev/v1",
            apiKey: key,
            headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
            fetch: runIdFetch.fetch,
          });
          const result = streamText({
            model: provider.responses("openai/gpt-6-astra"),
            instructions: "Je bent een deskundige krachttrainer. Bepaal anatomisch zorgvuldig welke spieren deze oefening belast. Gebruik de specifieke spier-ID's in plaats van hun algemene groepen: borst_boven/borst_onder; schouders_voor/schouders_zij/schouders_achter; quadriceps_binnen/quadriceps_buiten/quadriceps_midden; adductoren voor de binnenkant van het bovenbeen; abductoren voor heupabductie; hamstrings_binnen/hamstrings_buiten; gluteus_maximus voor heupextensie, gluteus_medius en de dieper gelegen gluteus_minimus voor abductie en bekkenstabilisatie; gastrocnemius/soleus voor de kuiten; buik_schuin voor schuine buikspieren. Belastingen verschillen per oefening en uitvoering: geef niet automatisch alle onderdelen dezelfde intensiteit. Geef uitsluitend de gevraagde gestructureerde spieranalyse. Gebruik 3 voor de hoofdspieren, 2 voor duidelijke hulpspieren, 1 voor lichte stabilisatie en negeer niet-belaste spieren. Voeg geen algemene groep toe wanneer specifieke onderdelen aanwezig zijn. De korte Nederlandse samenvatting benoemt de hoofdspieren.",
            messages: [{ role: "user", content: `Analyseer de krachtoefening: ${parsedInput.data.name}. Beoordeel ieder anatomisch onderdeel onafhankelijk. Gluteus maximus, medius en minimus mogen nooit als één groep worden behandeld. Ze kunnen bij dezelfde oefening samenwerken, maar geef alleen dezelfde belasting wanneer dat biomechanisch klopt. Onderscheid dynamische hoofdbeweging van lichte stabilisatie. Geef geen kunstmatige verschillen als de belasting werkelijk gelijk is. Bij een onduidelijke naam gebruik je de meest gebruikelijke uitvoering; verzin geen precieze activatiepercentages.` }],
            output: Output.object({ schema: outputSchema }),
            abortSignal: request.signal,
            providerOptions: {
              openai: {
                forceReasoning: true,
                reasoningEffort: "low",
                reasoningSummary: "auto",
                store: false,
                include: ["reasoning.encrypted_content"],
              },
            },
          });
          const output = await result.output;
          return Response.json({
            anatomyVersion: ANATOMY_VERSION,
            muscles: output.muscles.map((m) => ({ ...m, intensity: Math.max(0, Math.min(3, Math.round(m.intensity))) })),
            summary: output.summary.slice(0, 160),
          });
        } catch (error) {
          if (NoObjectGeneratedError.isInstance(error)) {
            return Response.json({ error: "De spieranalyse was onduidelijk. Probeer het opnieuw." }, { status: 502 });
          }
          const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 502;
          const message = status === 402 ? "Geen AI-tegoed meer beschikbaar." : status === 429 ? "Even te druk. Probeer het later opnieuw." : "De spieranalyse is nu niet beschikbaar.";
          return Response.json({ error: message }, { status: [400, 401, 402, 403, 404, 429].includes(status) ? status : 502 });
        }
      },
    },
  },
});
