import type { ReactNode } from "react";
import { PhoneShell } from "@/components/PhoneShell";

type Props = {
  platform: "ios" | "android";
  children: ReactNode;
  label?: string;
  index?: number;
  selected?: boolean;
  onClick?: () => void;
};

export function PhoneFrame({ platform, children, label, index, selected, onClick }: Props) {
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <div className="ml-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {index !== undefined && <span className="text-brand">{String(index + 1).padStart(2, "0")}</span>}
        <span>{label}</span>
      </div>
      <PhoneShell platform={platform} selected={selected} onClick={onClick}>
        {children}
      </PhoneShell>
    </div>
  );
}