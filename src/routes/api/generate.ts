import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { ProjectSchema } from "@/lib/screen-schema";
import { createFileRoute } from "@tanstack/react-router";
import { generateText, Output } from "ai";
import { z } from "zod";

const BlockUnionSchema = z.object({
  type: z.string(),
  time: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  eyebrow: z.string().nullable().optional(),
  leading: z.string().nullable().optional(),
  trailing: z.string().nullable().optional(),
  large: z.boolean().nullable().optional(),
  accent: z.string().nullable().optional(),
  ctaLabel: z.string().nullable().optional(),
  filled: z.boolean().nullable().optional(),
  heading: z.string().nullable().optional(),
  columns: z.number().nullable().optional(),
  activeIndex: z.number().nullable().optional(),
  size: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  stats: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        unit: z.string().nullable().optional(),
        tone: z.string().nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
  items: z.array(z.any()).nullable().optional(),
});

const GenSchema = z.object({
  name: z.string(),
  platform: z.enum(["ios", "android"]),
  designSystem: z.object({
    palette: z.object({
      background: z.string(),
      surface: z.string(),
      text: z.string(),
      muted: z.string(),
      accent: z.string(),
      accentText: z.string(),
    }),
    radius: z.enum(["sm", "md", "lg", "xl"]),
    font: z.enum(["Inter", "SF Pro", "Roboto", "Space Grotesk"]),
  }),
  screens: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        blocks: z.array(BlockUnionSchema).min(2).max(10),
      }),
    )
    .min(3)
    .max(6),
});

const BlockCatalog = `Available block \`type\`s (use only these; use only the fields listed):
- status_bar { time }
- nav_bar { title, leading?, trailing?, large? }
- hero { eyebrow?, title, subtitle? }
- hero_image { title, subtitle?, accent? }   // full-bleed colored hero
- stat_grid { stats: [{ label, value, unit?, tone: "default"|"brand"|"positive"|"warning" }] } (2–4)
- feature_card { eyebrow?, title, subtitle?, ctaLabel?, filled? }
- list { heading?, items: [{ title, subtitle?, trailing? }] } (1–6)
- card_grid { heading?, columns: 2|3, items: [{ title, subtitle? }] } (2–6)
- chips { items: [string] } (2–6)
- primary_button { label }
- secondary_button { label }
- form_field { label, placeholder? }
- profile_header { name, subtitle? }
- tab_bar { items: [string], activeIndex } (3–5)
- spacer { size: "sm"|"md"|"lg" }

Every screen SHOULD start with status_bar and (unless intentionally full-bleed) a nav_bar. Screens with bottom navigation SHOULD end with a tab_bar and share the same tab_bar items across the app.`;

function systemPrompt() {
  return `You are a senior mobile product designer. You generate high-fidelity, investor-ready mobile app screen specifications as JSON. Output MUST match the schema exactly.

Rules:
- Return 4 or 5 screens that form a coherent, connected flow (e.g. onboarding → home → detail → profile).
- Screens MUST share one design system (palette, radius, font). Colors are hex strings.
- iOS: SF Pro or Inter, larger radii, generous whitespace. Android: Roboto, Material tokens.
- Copy must be real and specific to the app idea — no "Lorem ipsum", no "Placeholder".
- Use tab_bar consistently on the main screens with the SAME items array.
- Prefer clean, restrained layouts. Never invent new block types.

${BlockCatalog}`;
}

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as {
          mode: "generate" | "refine";
          idea?: string;
          platform?: "ios" | "android";
          instruction?: string;
          project?: unknown;
        };

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const userPrompt =
          body.mode === "refine"
            ? `Refine the following mobile app design based on the user's instruction. Return the FULL updated project JSON (all screens, not a diff). Preserve screen ids where possible.\n\nInstruction:\n${body.instruction}\n\nCurrent project:\n${JSON.stringify(body.project, null, 2)}`
            : `Generate a mobile app design for the following idea. Target platform: ${body.platform ?? "ios"}.\n\nIdea:\n${body.idea}`;

        try {
          const { experimental_output: output } = await generateText({
            model,
            system: systemPrompt(),
            prompt: userPrompt,
            experimental_output: Output.object({ schema: GenSchema }),
          });

          // Normalize + validate against strict ProjectSchema
          const withIds = {
            id:
              (body.mode === "refine" && (body.project as { id?: string } | null)?.id) ||
              crypto.randomUUID(),
            idea: body.idea ?? (body.project as { idea?: string } | null)?.idea ?? "",
            ...output,
            screens: output.screens.map((s, i) => ({
              ...s,
              id: s.id || `screen-${i}`,
              blocks: s.blocks.filter((b) => typeof b.type === "string"),
            })),
          };

          const parsed = ProjectSchema.safeParse(withIds);
          if (!parsed.success) {
            return Response.json(
              { error: "Model output failed validation", details: parsed.error.flatten() },
              { status: 502 },
            );
          }
          return Response.json({ project: parsed.data });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});