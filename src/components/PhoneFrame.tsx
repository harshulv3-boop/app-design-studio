import type { ReactNode } from "react";

type Props = {
  platform: "ios" | "android";
  children: ReactNode;
  label?: string;
  index?: number;
  selected?: boolean;
  onClick?: () => void;
};

export function PhoneFrame({ platform, children, label, index, selected, onClick }: Props) {
  const ios = platform === "ios";
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <div className="ml-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {index !== undefined && <span className="text-brand">{String(index + 1).padStart(2, "0")}</span>}
        <span>{label}</span>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={`group relative rounded-[48px] transition-all ${
          selected
            ? "shadow-[0_0_0_2px_var(--brand),0_30px_60px_-15px_rgba(99,102,241,0.4)]"
            : "shadow-2xl hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]"
        }`}
      >
        <div
          className={`relative flex h-[640px] w-[320px] flex-col overflow-hidden bg-black ${
            ios ? "rounded-[44px] border-[6px] border-zinc-800" : "rounded-[36px] border-[6px] border-zinc-800"
          }`}
        >
          {ios && (
            <div className="pointer-events-none absolute left-1/2 top-2 z-30 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
          )}
          <div className="relative flex h-full w-full flex-col overflow-hidden">{children}</div>
        </div>
      </button>
    </div>
  );
}