import type { CSSProperties, ReactNode } from "react";

export const PHONE_FRAME = {
  width: 375,
  height: 812,
  borderWidth: 6,
  iosOuterRadius: 52,
  androidOuterRadius: 42,
  contentRadius: 46,
  notch: {
    top: 8,
    width: 100,
    height: 26,
  },
} as const;

type Platform = "ios" | "android";

function radiusFor(platform: Platform) {
  return platform === "ios" ? PHONE_FRAME.iosOuterRadius : PHONE_FRAME.androidOuterRadius;
}

export function PhoneNotch({ platform, overlay = false }: { platform: Platform; overlay?: boolean }) {
  if (platform !== "ios") return null;

  return (
    <div
      aria-hidden
      data-phone-notch
      {...(overlay ? { "data-overlay": true } : {})}
      style={{
        position: "absolute",
        top: PHONE_FRAME.notch.top,
        left: "50%",
        width: PHONE_FRAME.notch.width,
        height: PHONE_FRAME.notch.height,
        transform: "translateX(-50%)",
        borderRadius: 999,
        background: "var(--phone-shell)",
        pointerEvents: "none",
        zIndex: 30,
      }}
    />
  );
}

export function PhoneFrameOutline({ platform, overlay = false }: { platform: Platform; overlay?: boolean }) {
  return (
    <div
      aria-hidden
      data-phone-outline
      {...(overlay ? { "data-overlay": true } : {})}
      style={{
        position: "absolute",
        inset: -PHONE_FRAME.borderWidth,
        borderRadius: radiusFor(platform),
        border: `${PHONE_FRAME.borderWidth}px solid var(--phone-frame-border)`,
        background: "var(--phone-shell)",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

type PhoneShellProps = {
  platform: Platform;
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  contentClassName?: string;
  contentStyle?: CSSProperties;
};

export function PhoneShell({
  platform,
  children,
  selected,
  onClick,
  className = "",
  contentClassName = "",
  contentStyle,
}: PhoneShellProps) {
  const shell = (
    <div
      data-phone-shell
      className={`relative flex flex-col overflow-hidden ${className}`}
      style={{
        boxSizing: "content-box",
        width: PHONE_FRAME.width,
        height: PHONE_FRAME.height,
        border: `${PHONE_FRAME.borderWidth}px solid var(--phone-frame-border)`,
        borderRadius: radiusFor(platform),
        background: "var(--phone-shell)",
      }}
    >
      <PhoneNotch platform={platform} />
      <div
        data-phone-content
        className={`relative flex h-full w-full flex-col overflow-hidden ${contentClassName}`}
        style={contentStyle}
      >
        {children}
      </div>
    </div>
  );

  if (!onClick) return shell;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative rounded-[48px] transition-all ${
        selected
          ? "shadow-[0_0_0_2px_var(--brand),0_30px_60px_-15px_rgba(99,102,241,0.4)]"
          : "shadow-2xl hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]"
      }`}
      data-phone-frame-button
    >
      {shell}
    </button>
  );
}