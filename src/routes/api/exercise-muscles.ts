import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "@/lib/ai/run-id";
import { MUSCLE_IDS } from "@/lib/muscles";

const inputSchema = z.object({ name: z.string().trim().min(1).max(120) });
const outputSchema = z.object({
  muscles: z.array(z.object({ id: z.enum(MUSCLE_IDS), intensity: z.number() })),
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
            instructions: "Je bent een deskundige krachttrainer. Bepaal welke spieren een oefening belast. Geef uitsluitend de gevraagde gestructureerde spieranalyse. Gebruik 3 voor de hoofdspieren, 2 voor duidelijke hulpspieren, 1 voor lichte stabilisatie en negeer niet-belaste spieren. De korte Nederlandse samenvatting benoemt de hoofdspieren.",
            messages: [{ role: "user", content: `Analyseer de krachtoefening: ${parsedInput.data.name}` }],
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
