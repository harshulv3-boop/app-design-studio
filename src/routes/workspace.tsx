import { PhoneFrame } from "@/components/PhoneFrame";
import { ScreenRenderer } from "@/components/ScreenRenderer";
import { loadProject, saveProject } from "@/lib/project-store";
import type { Project } from "@/lib/screen-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUp,
  Code2,
  Copy,
  Download,
  Figma,
  Loader2,
  Sparkle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Search = { idea?: string; platform?: "ios" | "android" };

export const Route = createFileRoute("/workspace")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    idea: typeof s.idea === "string" ? s.idea : undefined,
    platform: s.platform === "android" ? "android" : s.platform === "ios" ? "ios" : undefined,
  }),
  component: Workspace,
});

type ChatMsg = { role: "user" | "assistant"; text: string };

function Workspace() {
  const { idea, platform: platformParam } = Route.useSearch();
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "refining">("idle");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const bootstrapped = useRef(false);

  const generate = useCallback(
    async (ideaText: string, plat: "ios" | "android") => {
      setStatus("generating");
      setChat([{ role: "assistant", text: `Generating a ${plat === "ios" ? "iOS" : "Android"} concept for: "${ideaText}"...` }]);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "generate", idea: ideaText, platform: plat }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `HTTP ${res.status}`);
        }
        const { project: p } = (await res.json()) as { project: Project };
        setProject(p);
        setSelectedId(p.screens[0]?.id ?? null);
        saveProject(p);
        setChat((c) => [
          ...c,
          { role: "assistant", text: `Generated ${p.screens.length} screens using the "${p.name}" design system. Tell me what to change — colors, layout, copy, new screens.` },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Generation failed: ${message}`);
        setChat((c) => [...c, { role: "assistant", text: `Generation failed: ${message}` }]);
      } finally {
        setStatus("idle");
      }
    },
    [],
  );

  // Bootstrap once
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const saved = loadProject();
    if (idea) {
      generate(idea, platformParam ?? "ios");
    } else if (saved) {
      setProject(saved);
      setSelectedId(saved.screens[0]?.id ?? null);
    }
  }, [idea, platformParam, generate]);

  async function refine() {
    if (!input.trim() || !project || status !== "idle") return;
    const instruction = input.trim();
    setInput("");
    setChat((c) => [...c, { role: "user", text: instruction }]);
    setStatus("refining");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "refine", instruction, project }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const { project: p } = (await res.json()) as { project: Project };
      setProject(p);
      saveProject(p);
      setChat((c) => [...c, { role: "assistant", text: `Updated. ${p.screens.length} screens ready.` }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Refine failed: ${message}`);
      setChat((c) => [...c, { role: "assistant", text: `Refine failed: ${message}` }]);
    } finally {
      setStatus("idle");
    }
  }

  function setPlatform(p: "ios" | "android") {
    if (!project) return;
    const next = { ...project, platform: p };
    setProject(next);
    saveProject(next);
  }

  const selected = project?.screens.find((s) => s.id === selectedId) ?? null;
  const isBusy = status !== "idle";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface text-foreground">
      {/* Sidebar */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-panel/50 backdrop-blur-xl">
        <div className="border-b border-border p-5">
          <Link to="/" className="mb-6 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <div className="h-3 w-3 rounded-full bg-white" />
            </div>
            <span className="font-semibold tracking-tight">Nova Design AI</span>
          </Link>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Project
          </div>
          <div className="mt-1 truncate text-sm font-semibold">
            {project?.name ?? (isBusy ? "Generating…" : "Untitled")}
          </div>
          {project?.idea && (
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{project.idea}</div>
          )}
        </div>

        {/* Screen list */}
        <div className="border-b border-border p-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Screens
          </div>
          <div className="space-y-1">
            {project?.screens.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                  selectedId === s.id ? "bg-brand/15 text-foreground" : "text-muted-foreground hover:bg-panel"
                }`}
              >
                <span className="w-5 text-[10px] font-mono text-brand">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 truncate">{s.name}</span>
              </button>
            ))}
            {!project && !isBusy && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No screens yet. Describe an app to start.
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {chat.map((m, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 text-xs leading-relaxed ${
                m.role === "user"
                  ? "ml-4 border-brand/25 bg-brand/10"
                  : "border-border/50 bg-surface/50"
              }`}
            >
              <div
                className={`mb-1 text-[10px] font-bold uppercase tracking-widest ${
                  m.role === "user" ? "text-brand" : "text-muted-foreground"
                }`}
              >
                {m.role === "user" ? "You" : "Nova"}
              </div>
              <div className="text-foreground/90">{m.text}</div>
            </div>
          ))}
          {isBusy && (
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface/50 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
              {status === "generating" ? "Composing screens…" : "Applying refinement…"}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-4">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void refine();
                }
              }}
              disabled={!project || isBusy}
              placeholder={project ? "Make the buttons blue…" : "Generate screens first"}
              className="min-h-[72px] w-full resize-none rounded-xl border border-border bg-surface p-3 pr-11 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => void refine()}
              disabled={!project || isBusy || !input.trim()}
              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white transition-opacity disabled:opacity-40"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-panel/30 px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Platform</span>
              <div className="flex items-center gap-1 rounded-full bg-surface p-1">
                {(["ios", "android"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      (project?.platform ?? "ios") === p
                        ? "bg-zinc-800 text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {p === "ios" ? "iOS" : "Android"}
                  </button>
                ))}
              </div>
            </div>
            {project && (
              <>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Theme</span>
                  <div className="flex items-center gap-1.5 rounded bg-surface px-2 py-1 text-[11px] font-medium text-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: project.designSystem.palette.accent }}
                    />
                    {project.designSystem.font}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="relative flex items-center gap-3">
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={!project}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            {exportOpen && project && (
              <div className="absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-xl border border-border bg-panel shadow-xl">
                {[
                  { icon: Figma, label: "Figma (editable)", note: "Coming soon" },
                  { icon: Code2, label: "React + Tailwind", note: "" },
                  { icon: Code2, label: "React Native", note: "" },
                  { icon: Code2, label: "SwiftUI", note: "Coming soon" },
                  { icon: Copy, label: "Copy project JSON", note: "" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (item.label === "Copy project JSON") {
                        navigator.clipboard.writeText(JSON.stringify(project, null, 2));
                        toast.success("Project JSON copied");
                      } else {
                        toast.message(`${item.label}`, {
                          description: item.note || "Exporting…",
                        });
                      }
                      setExportOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs hover:bg-surface"
                  >
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1">{item.label}</span>
                    {item.note && (
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        {item.note}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Canvas */}
        <div
          className="flex-1 overflow-auto p-12"
          style={{
            backgroundImage: "radial-gradient(#27272a 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          {project ? (
            <div className="flex min-w-max items-start justify-center gap-10">
              {project.screens.map((s, i) => (
                <PhoneFrame
                  key={s.id}
                  platform={project.platform}
                  label={s.name}
                  index={i}
                  selected={s.id === selectedId}
                  onClick={() => setSelectedId(s.id)}
                >
                  <ScreenRenderer screen={s} ds={project.designSystem} platform={project.platform} />
                </PhoneFrame>
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15">
                {isBusy ? (
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                ) : (
                  <Sparkle className="h-6 w-6 text-brand" />
                )}
              </div>
              <div className="text-lg font-semibold">
                {isBusy ? "Composing your app…" : "Nothing on the canvas yet"}
              </div>
              <div className="mt-1 max-w-sm text-sm text-muted-foreground">
                {isBusy
                  ? "Nova is generating a connected set of high-fidelity screens."
                  : "Head back home and describe your app idea to generate a set of screens."}
              </div>
            </div>
          )}
        </div>

        {/* Inspector */}
        {selected && project && (
          <div className="absolute right-6 top-20 z-30 w-64 rounded-xl border border-border bg-panel/95 p-4 shadow-2xl backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Selection
              </div>
              <div className="h-1.5 w-1.5 rounded-full bg-brand" />
            </div>
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: project.designSystem.palette.accent }}
              />
              <span className="truncate">{selected.name}</span>
            </div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Quick tweaks
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Make it blue",
                "Rounder corners",
                "Add settings screen",
                "Lighten theme",
                "Bigger typography",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-medium text-muted-foreground hover:border-brand/50 hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}