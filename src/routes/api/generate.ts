import { createGeminiProvider, createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { ProjectSchema } from "@/lib/screen-schema";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";

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

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch { /* fall through */ }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch { /* fall through */ }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("No JSON found in model response");
}

// Coerce values that came back as objects/arrays into strings so the strict
// schema doesn't reject a good structure over a bad primitive.
function toStr(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}

function normalizeBlock(b: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof b?.type !== "string") return null;
  const out: Record<string, unknown> = { ...b };
  const stringFields = [
    "time", "title", "subtitle", "eyebrow", "leading", "trailing",
    "label", "placeholder", "heading", "name", "accent", "ctaLabel",
  ];
  for (const k of stringFields) if (k in out) out[k] = toStr(out[k]) || null;
  if (Array.isArray(out.stats)) {
    out.stats = (out.stats as Array<Record<string, unknown>>).map((s) => ({
      label: toStr(s.label, "Stat"),
      value: toStr(s.value, "0"),
      unit: s.unit == null ? null : toStr(s.unit),
      tone: typeof s.tone === "string" ? s.tone : "default",
    }));
  }
  if (Array.isArray(out.items)) {
    out.items = (out.items as unknown[]).map((it) => {
      if (typeof it === "string") return it;
      const r = it as Record<string, unknown>;
      return {
        title: toStr(r.title, ""),
        subtitle: r.subtitle == null ? null : toStr(r.subtitle),
        trailing: r.trailing == null ? null : toStr(r.trailing),
      };
    });
    // chips/tab_bar want string arrays
    if (out.type === "chips" || out.type === "tab_bar") {
      out.items = (out.items as unknown[]).map((it) =>
        typeof it === "string" ? it : toStr((it as Record<string, unknown>).title, ""),
      );
    }
  }
  return out;
}

function systemPrompt() {
  return `You are a senior mobile product designer. You generate high-fidelity, investor-ready mobile app screen specifications as JSON.

Output ONLY a single valid JSON object (no prose, no code fences) matching this TypeScript shape:
{
  "name": string,                     // short product name
  "platform": "ios" | "android",
  "designSystem": {
    "palette": { "background": "#hex", "surface": "#hex", "text": "#hex", "muted": "#hex", "accent": "#hex", "accentText": "#hex" },
    "radius": "sm" | "md" | "lg" | "xl",
    "font": "Inter" | "SF Pro" | "Roboto" | "Space Grotesk"
  },
  "screens": [
    { "id": "kebab-case", "name": "Screen Name", "role": "purpose",
      "blocks": [ { "type": "one-of-catalog", ...fields } ]  // 2–10 blocks
    }
  ]  // 4 or 5 screens
}

Rules:
- Return 4 or 5 screens that form a coherent, connected flow (e.g. onboarding → home → detail → profile).
- Screens MUST share one design system (palette, radius, font). Colors are hex strings.
- iOS: SF Pro or Inter, larger radii, generous whitespace. Android: Roboto, Material tokens.
- Copy must be real and specific to the app idea — no "Lorem ipsum", no "Placeholder".
- Use tab_bar consistently on the main screens with the SAME items array.
- Prefer clean, restrained layouts. Never invent new block types or new field names.

${BlockCatalog}`;
}

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const geminiKey = process.env.GEMINI_API_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey && !geminiKey) {
          return new Response("Missing GEMINI_API_KEY or LOVABLE_API_KEY", { status: 500 });
        }

        const body = (await request.json()) as {
          mode: "generate" | "refine";
          idea?: string;
          platform?: "ios" | "android";
          instruction?: string;
          project?: unknown;
        };

        // Prefer Lovable Gateway (more reliable). Fall back to direct Gemini key if only that is set.
        const model = lovableKey
          ? createLovableAiGatewayProvider(lovableKey)("google/gemini-3-flash-preview")
          : createGeminiProvider(geminiKey!)("gemini-2.5-flash-lite");

        const userPrompt =
          body.mode === "refine"
            ? `Refine the following mobile app design based on the user's instruction. Return the FULL updated project JSON (all screens, not a diff). Preserve screen ids where possible.\n\nInstruction:\n${body.instruction}\n\nCurrent project:\n${JSON.stringify(body.project, null, 2)}`
            : `Generate a mobile app design for the following idea. Target platform: ${body.platform ?? "ios"}.\n\nIdea:\n${body.idea}`;

        // Retry a few times on transient upstream failures (Gemini "Service Unavailable").
        let text = "";
        let lastErr: unknown = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const r = await generateText({ model, system: systemPrompt(), prompt: userPrompt });
            text = r.text;
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            const msg = err instanceof Error ? err.message : String(err);
            // Only retry transient upstream failures.
            if (!/unavailable|429|5\d\d|timeout|overload/i.test(msg)) break;
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }
        if (lastErr) {
          const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
          return Response.json(
            { error: `The AI service is temporarily unavailable. Please try again in a moment. (${message})` },
            { status: 503 },
          );
        }

        try {
          const raw = extractJson(text) as Record<string, unknown>;

          // Normalize + validate against strict ProjectSchema
          const withIds = {
            id:
              (body.mode === "refine" && (body.project as { id?: string } | null)?.id) ||
              crypto.randomUUID(),
            idea: body.idea ?? (body.project as { idea?: string } | null)?.idea ?? "",
            ...raw,
            screens: (raw.screens as Array<Record<string, unknown>> | undefined ?? []).map(
              (s, i) => ({
                ...s,
                id: toStr(s.id, `screen-${i}`),
                name: toStr(s.name, `Screen ${i + 1}`),
                role: toStr(s.role, "screen"),
                blocks: ((s.blocks as Array<Record<string, unknown>>) || [])
                  .map(normalizeBlock)
                  .filter((b): b is Record<string, unknown> => b !== null),
              }),
            ),
          };

          const parsed = ProjectSchema.safeParse(withIds);
          if (!parsed.success) {
            console.error("Project validation failed", parsed.error.flatten());
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