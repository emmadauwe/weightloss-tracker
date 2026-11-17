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
            instructions: "Je bent een deskundige krachttrainer. Schat per anatomische spier de trainingsprikkel van deze oefening TEN OPZICHTE VAN effectieve oefeningen voor DIEZELFDE spier, bij vergelijkbare inspanning en gebruikelijke goede uitvoering. Dit is geen rangschikking van spieren binnen één oefening. De belangrijkste spier van een oefening krijgt NIET automatisch 3; een oefening mag geen enkele 3 hebben. Gebruik een consistente schaal tussen oefeningen: 3 = sterke directe prikkel, vergelijkbaar met goed onderbouwde effectieve oefeningen voor deze specifieke spier; 2 = zinvolle maar duidelijk minder sterke prikkel dan zulke oefeningen; 1 = beperkte prikkel of hoofdzakelijk stabilisatie; 0 = geen relevante prikkel, weglaten. Stel intern per spier passende referentieoefeningen vast en vergelijk bewegingsuitslag, spierfunctie, belasting en dynamische contractie versus stabilisatie. Activatie is geen bewezen spiergroei: wees voorzichtig bij beperkt bewijs, verzin geen percentages of absolute beste oefening. Gebruik specifieke IDs: borst_boven/borst_onder; schouders_voor/schouders_zij/schouders_achter; quadriceps_binnen/quadriceps_buiten/quadriceps_midden; adductoren; abductoren; hamstrings_binnen/hamstrings_buiten; gluteus_maximus voor heupextensie, gluteus_medius en de diepere gluteus_minimus voor abductie en bekkenstabilisatie; gastrocnemius/soleus; buik_schuin. Beoordeel alle onderdelen onafhankelijk; geen groepskleur, geen automatische gelijke intensiteit, maar ook geen verzonnen verschillen. Voeg geen algemene groep toe. Geef uitsluitend de gevraagde gestructureerde analyse met een korte Nederlandse samenvatting.",
            messages: [{ role: "user", content: `Analyseer de krachtoefening: ${parsedInput.data.name}. Vergelijk de geschatte prikkel voor elk getarget spieronderdeel met effectieve alternatieve oefeningen voor datzelfde onderdeel, niet met andere spieren binnen deze oefening. Maak gluteus maximus, medius en minimus en de beenonderdelen onafhankelijk. Bij een onduidelijke naam neem je de gebruikelijke uitvoering. Geef niet automatisch de hoogste kleur aan de hoofdspier.` }],
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
