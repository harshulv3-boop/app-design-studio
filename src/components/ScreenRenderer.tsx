import type { Block, DesignSystem, Screen } from "@/lib/screen-schema";
import { ChevronRight, Signal, Wifi, BatteryFull } from "lucide-react";

function radiusClass(r: DesignSystem["radius"]) {
  return { sm: "rounded-lg", md: "rounded-xl", lg: "rounded-2xl", xl: "rounded-3xl" }[r];
}

function toneStyle(tone: string | null | undefined, ds: DesignSystem) {
  switch (tone) {
    case "brand":
      return { color: ds.palette.accent };
    case "positive":
      return { color: "#10b981" };
    case "warning":
      return { color: "#f59e0b" };
    default:
      return { color: ds.palette.text };
  }
}

function BlockView({ block, ds, platform }: { block: Block; ds: DesignSystem; platform: "ios" | "android" }) {
  const rc = radiusClass(ds.radius);
  const surface = ds.palette.surface;
  const text = ds.palette.text;
  const muted = ds.palette.muted;
  const accent = ds.palette.accent;
  const accentText = ds.palette.accentText;

  switch (block.type) {
    case "status_bar":
      return (
        <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-semibold" style={{ color: text }}>
          <span>{block.time || "9:41"}</span>
          <div className="flex items-center gap-1 opacity-80">
            <Signal className="h-3 w-3" />
            <Wifi className="h-3 w-3" />
            <BatteryFull className="h-3.5 w-3.5" />
          </div>
        </div>
      );
    case "nav_bar":
      return (
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <span className="w-8 truncate text-[13px]" style={{ color: muted }}>
            {block.leading || ""}
          </span>
          <span
            className={`truncate ${block.large ? "text-[22px] font-bold" : "text-[15px] font-semibold"}`}
            style={{ color: text }}
          >
            {block.title}
          </span>
          <span className="w-8 truncate text-right text-[13px]" style={{ color: muted }}>
            {block.trailing || ""}
          </span>
        </div>
      );
    case "hero":
      return (
        <div className="px-5 pb-4 pt-2">
          {block.eyebrow && (
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
              {block.eyebrow}
            </div>
          )}
          <div className="text-[26px] font-bold leading-tight tracking-tight" style={{ color: text }}>
            {block.title}
          </div>
          {block.subtitle && (
            <div className="mt-2 text-[13px] leading-snug" style={{ color: muted }}>
              {block.subtitle}
            </div>
          )}
        </div>
      );
    case "hero_image":
      return (
        <div className="mx-5 my-3 overflow-hidden">
          <div
            className={`${rc} relative flex aspect-[4/3] w-full flex-col justify-end p-5`}
            style={{
              background: `linear-gradient(135deg, ${block.accent || accent}, ${surface})`,
            }}
          >
            <div className="text-[20px] font-bold leading-tight" style={{ color: accentText }}>
              {block.title}
            </div>
            {block.subtitle && (
              <div className="mt-1 text-[12px] opacity-80" style={{ color: accentText }}>
                {block.subtitle}
              </div>
            )}
          </div>
        </div>
      );
    case "stat_grid":
      return (
        <div className={`mx-5 my-2 grid gap-3`} style={{ gridTemplateColumns: `repeat(${block.stats.length}, 1fr)` }}>
          {block.stats.map((s, i) => (
            <div key={i} className={`${rc} p-3`} style={{ background: surface }}>
              <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: muted }}>
                {s.label}
              </div>
              <div className="mt-1 text-[18px] font-bold" style={toneStyle(s.tone, ds)}>
                {s.value}
                {s.unit && (
                  <span className="ml-1 text-[10px] font-normal" style={{ color: muted }}>
                    {s.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    case "feature_card":
      return (
        <div className="mx-5 my-2">
          <div
            className={`${rc} p-5`}
            style={{
              background: block.filled ? accent : surface,
              color: block.filled ? accentText : text,
            }}
          >
            {block.eyebrow && (
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">{block.eyebrow}</div>
            )}
            <div className="mt-1 text-[16px] font-semibold">{block.title}</div>
            {block.subtitle && <div className="mt-1 text-[12px] opacity-80">{block.subtitle}</div>}
            {block.ctaLabel && (
              <div className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold">
                {block.ctaLabel} <ChevronRight className="h-3 w-3" />
              </div>
            )}
          </div>
        </div>
      );
    case "list":
      return (
        <div className="mx-5 my-2">
          {block.heading && (
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[13px] font-semibold" style={{ color: text }}>
                {block.heading}
              </div>
              <div className="text-[11px]" style={{ color: muted }}>
                See all
              </div>
            </div>
          )}
          <div className={`${rc} overflow-hidden`} style={{ background: surface }}>
            {block.items.map((it, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? `1px solid ${muted}22` : undefined }}
              >
                <div className="h-8 w-8 shrink-0 rounded-lg" style={{ background: `${accent}33` }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium" style={{ color: text }}>
                    {it.title}
                  </div>
                  {it.subtitle && (
                    <div className="truncate text-[11px]" style={{ color: muted }}>
                      {it.subtitle}
                    </div>
                  )}
                </div>
                {it.trailing && (
                  <div className="text-[12px] font-semibold" style={{ color: muted }}>
                    {it.trailing}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    case "card_grid":
      return (
        <div className="mx-5 my-2">
          {block.heading && (
            <div className="mb-2 text-[13px] font-semibold" style={{ color: text }}>
              {block.heading}
            </div>
          )}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${block.columns}, 1fr)` }}>
            {block.items.map((it, i) => (
              <div key={i} className={`${rc} p-3`} style={{ background: surface }}>
                <div className={`${rc} mb-2 aspect-square w-full`} style={{ background: `${accent}22` }} />
                <div className="truncate text-[12px] font-semibold" style={{ color: text }}>
                  {it.title}
                </div>
                {it.subtitle && (
                  <div className="truncate text-[10px]" style={{ color: muted }}>
                    {it.subtitle}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    case "chips":
      return (
        <div className="mx-5 my-2 flex flex-wrap gap-2">
          {block.items.map((c, i) => (
            <div
              key={i}
              className="rounded-full px-3 py-1.5 text-[11px] font-medium"
              style={{
                background: i === 0 ? accent : surface,
                color: i === 0 ? accentText : text,
              }}
            >
              {c}
            </div>
          ))}
        </div>
      );
    case "primary_button":
      return (
        <div className="mx-5 my-3">
          <div
            className={`${rc} py-3.5 text-center text-[14px] font-semibold`}
            style={{ background: accent, color: accentText }}
          >
            {block.label}
          </div>
        </div>
      );
    case "secondary_button":
      return (
        <div className="mx-5 my-2">
          <div
            className={`${rc} py-3.5 text-center text-[14px] font-semibold`}
            style={{ background: surface, color: text }}
          >
            {block.label}
          </div>
        </div>
      );
    case "form_field":
      return (
        <div className="mx-5 my-2">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: muted }}>
            {block.label}
          </div>
          <div
            className={`${rc} px-4 py-3 text-[13px]`}
            style={{ background: surface, color: muted, border: `1px solid ${muted}22` }}
          >
            {block.placeholder || `Enter ${block.label.toLowerCase()}`}
          </div>
        </div>
      );
    case "profile_header":
      return (
        <div className="flex flex-col items-center px-5 py-4">
          <div
            className="mb-3 h-20 w-20 rounded-full"
            style={{ background: `linear-gradient(135deg, ${accent}, ${surface})` }}
          />
          <div className="text-[18px] font-bold" style={{ color: text }}>
            {block.name}
          </div>
          {block.subtitle && (
            <div className="mt-0.5 text-[12px]" style={{ color: muted }}>
              {block.subtitle}
            </div>
          )}
        </div>
      );
    case "tab_bar":
      return (
        <div
          className="mt-auto flex items-center justify-around px-4 pb-6 pt-3"
          style={{
            background: platform === "ios" ? `${surface}dd` : surface,
            borderTop: `1px solid ${muted}22`,
          }}
        >
          {block.items.map((it, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className="h-4 w-4 rounded"
                style={{ background: i === block.activeIndex ? accent : `${muted}55` }}
              />
              <div
                className="text-[9px] font-medium"
                style={{ color: i === block.activeIndex ? accent : muted }}
              >
                {it}
              </div>
            </div>
          ))}
        </div>
      );
    case "spacer":
      return <div style={{ height: { sm: 8, md: 16, lg: 32 }[block.size] }} />;
    default:
      return null;
  }
}

export function ScreenRenderer({
  screen,
  ds,
  platform,
}: {
  screen: Screen;
  ds: DesignSystem;
  platform: "ios" | "android";
}) {
  const hasTabBar = screen.blocks.some((b) => b.type === "tab_bar");
  return (
    <div className="flex h-full w-full flex-col" style={{ background: ds.palette.background }}>
      <div className={`flex-1 overflow-hidden ${hasTabBar ? "" : "pb-4"}`}>
        {screen.blocks
          .filter((b) => b.type !== "tab_bar")
          .map((b, i) => (
            <BlockView key={i} block={b} ds={ds} platform={platform} />
          ))}
      </div>
      {screen.blocks
        .filter((b) => b.type === "tab_bar")
        .map((b, i) => (
          <BlockView key={`tb-${i}`} block={b} ds={ds} platform={platform} />
        ))}
    </div>
  );
}