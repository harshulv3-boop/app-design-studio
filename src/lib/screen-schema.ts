import { z } from "zod";

/**
 * A mobile app screen is a stack of blocks. Each block is a high-level UI
 * element that the renderer knows how to draw as production-quality mobile UI.
 * This is intentionally opinionated so the AI outputs consistent, renderable
 * layouts rather than freeform HTML.
 */

export const BlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status_bar"),
    time: z.string().default("9:41"),
  }),
  z.object({
    type: z.literal("nav_bar"),
    title: z.string(),
    leading: z.string().nullable().optional(),
    trailing: z.string().nullable().optional(),
    large: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("hero"),
    eyebrow: z.string().nullable().optional(),
    title: z.string(),
    subtitle: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal("hero_image"),
    title: z.string(),
    subtitle: z.string().nullable().optional(),
    accent: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal("stat_grid"),
    stats: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        unit: z.string().nullable().optional(),
        tone: z.enum(["default", "brand", "positive", "warning"]).default("default"),
      }),
    ).min(2).max(4),
  }),
  z.object({
    type: z.literal("feature_card"),
    eyebrow: z.string().nullable().optional(),
    title: z.string(),
    subtitle: z.string().nullable().optional(),
    ctaLabel: z.string().nullable().optional(),
    filled: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("list"),
    heading: z.string().nullable().optional(),
    items: z.array(
      z.object({
        title: z.string(),
        subtitle: z.string().nullable().optional(),
        trailing: z.string().nullable().optional(),
      }),
    ).min(1).max(6),
  }),
  z.object({
    type: z.literal("card_grid"),
    heading: z.string().nullable().optional(),
    columns: z.union([z.literal(2), z.literal(3)]).default(2),
    items: z.array(
      z.object({
        title: z.string(),
        subtitle: z.string().nullable().optional(),
      }),
    ).min(2).max(6),
  }),
  z.object({
    type: z.literal("chips"),
    items: z.array(z.string()).min(2).max(6),
  }),
  z.object({
    type: z.literal("primary_button"),
    label: z.string(),
  }),
  z.object({
    type: z.literal("secondary_button"),
    label: z.string(),
  }),
  z.object({
    type: z.literal("form_field"),
    label: z.string(),
    placeholder: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal("profile_header"),
    name: z.string(),
    subtitle: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal("tab_bar"),
    items: z.array(z.string()).min(3).max(5),
    activeIndex: z.number().default(0),
  }),
  z.object({
    type: z.literal("spacer"),
    size: z.enum(["sm", "md", "lg"]).default("md"),
  }),
]);

export type Block = z.infer<typeof BlockSchema>;

export const ScreenSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  blocks: z.array(BlockSchema).min(2).max(10),
});
export type Screen = z.infer<typeof ScreenSchema>;

export const DesignSystemSchema = z.object({
  palette: z.object({
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    muted: z.string(),
    accent: z.string(),
    accentText: z.string(),
  }),
  radius: z.enum(["sm", "md", "lg", "xl"]).default("lg"),
  font: z.enum(["Inter", "SF Pro", "Roboto", "Space Grotesk"]).default("Inter"),
});
export type DesignSystem = z.infer<typeof DesignSystemSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  idea: z.string(),
  platform: z.enum(["ios", "android"]).default("ios"),
  designSystem: DesignSystemSchema,
  screens: z.array(ScreenSchema).min(1).max(8),
});
export type Project = z.infer<typeof ProjectSchema>;