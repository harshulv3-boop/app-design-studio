import { PhoneFrame } from "@/components/PhoneFrame";
import { ScreenRenderer } from "@/components/ScreenRenderer";
import { loadProject, saveProject } from "@/lib/project-store";
import type { Project } from "@/lib/screen-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Figma,
  Hand,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Megaphone,
  Minus,
  MonitorPlay,
  MousePointer2,
  Moon,
  Plug,
  Plus,
  Share2,
  Sparkle,
  Sparkles,
  X,
  LogOut,
  Settings,
  User as UserIcon,
  CreditCard,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Search = { idea?: string; platform?: "ios" | "android"; share?: string };

export const Route = createFileRoute("/workspace")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    idea: typeof s.idea === "string" ? s.idea : undefined,
    platform: s.platform === "android" ? "android" : s.platform === "ios" ? "ios" : undefined,
    share: typeof s.share === "string" ? s.share : undefined,
  }),
  component: Workspace,
});

type ChatMsg = { role: "user" | "assistant"; text: string };

function encodeShare(p: Project): string {
  const json = JSON.stringify(p);
  // UTF-8 safe base64 (URL-safe)
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeShare(s: string): Project | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = decodeURIComponent(escape(atob(b64 + pad)));
    return JSON.parse(json) as Project;
  } catch {
    return null;
  }
}

function Workspace() {
  const { idea, platform: platformParam, share } = Route.useSearch();
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "refining">("idle");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "theme">("chat");
  const [zoom, setZoom] = useState(100);
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
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
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

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (share) {
      const p = decodeShare(share);
      if (p) {
        setProject(p);
        setSelectedId(p.screens[0]?.id ?? null);
        saveProject(p);
        setChat([{ role: "assistant", text: `Loaded a shared project — "${p.name}".` }]);
        return;
      }
      toast.error("Shared link is invalid or corrupted.");
    }
    const saved = loadProject();
    if (idea) {
      generate(idea, platformParam ?? "ios");
    } else if (saved) {
      setProject(saved);
      setSelectedId(saved.screens[0]?.id ?? null);
    }
  }, [idea, platformParam, share, generate]);

  function handleShare() {
    if (!project) return;
    const link = `${window.location.origin}/workspace?share=${encodeShare(project)}`;
    navigator.clipboard.writeText(link).then(
      () => toast.success("Share link copied to clipboard"),
      () => toast.error("Couldn't copy — clipboard blocked"),
    );
  }

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
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
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
    <div className="flex h-screen w-full flex-col overflow-hidden bg-surface text-foreground">
      {/* Top bar */}
      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-brand shadow-[0_0_20px_-2px_var(--brand)]">
            <span className="font-serif text-base font-bold italic leading-none text-white">S</span>
          </div>
          <span className="font-semibold tracking-tight">
            sleek<span className="text-muted-foreground">.design</span>
          </span>
        </Link>

        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 text-sm text-foreground/85">
          <span className="text-muted-foreground">Dashboard</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">
            {project?.name ?? (isBusy ? "Generating…" : "Untitled Project")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {[Moon, HelpCircle, Megaphone].map((Icon, i) => (
            <button
              key={i}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-panel/40 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <div className="ml-1 flex items-center gap-1 rounded-full border border-border bg-panel/40 p-1">
            <button
              onClick={() => project && setPreviewOpen(true)}
              disabled={!project}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground/90 hover:bg-panel disabled:opacity-40"
            >
              <MonitorPlay className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              onClick={handleShare}
              disabled={!project}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground/90 hover:bg-panel disabled:opacity-40"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={!project}
              className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-40"
            >
              Export
            </button>
          </div>
          <button className="flex items-center gap-1.5 rounded-full border border-border bg-panel/40 px-3 py-1.5 text-xs font-medium text-foreground/90 hover:bg-panel">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            Upgrade
          </button>
          <div className="relative ml-1">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-brand text-xs font-bold text-white ring-offset-surface transition-all hover:ring-2 hover:ring-brand/50 hover:ring-offset-2"
              aria-label="Profile menu"
            >
              T
            </button>
            {profileOpen && (
              <ProfileDropdown onClose={() => setProfileOpen(false)} />
            )}
          </div>
        </div>

        {exportOpen && (
          <ExportDropdown project={project} onClose={() => setExportOpen(false)} />
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <aside className="flex w-[340px] shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex items-center justify-between px-4 pt-4">
            <div className="flex items-center gap-1 rounded-full bg-panel/70 p-1">
              {(["chat", "theme"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                    tab === t ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="9" y1="4" x2="9" y2="20" />
              </svg>
            </button>
          </div>

          {tab === "chat" ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {project?.idea && (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-panel/60 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15">
                      <Sparkles className="h-4 w-4 text-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Project brief
                      </div>
                      <div className="truncate text-sm font-semibold">{project.name}</div>
                    </div>
                  </div>
                )}

                {chat.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="ml-auto max-w-[85%] rounded-2xl bg-panel px-4 py-2 text-sm text-foreground/90">
                      {m.text}
                    </div>
                  ) : (
                    <div key={i} className="mr-auto max-w-[92%] rounded-2xl border border-border/60 bg-panel/40 px-4 py-2.5 text-sm text-foreground/90">
                      {m.text}
                    </div>
                  ),
                )}

                {isBusy && (
                  <div className="mr-auto flex max-w-[92%] items-center gap-2 rounded-2xl border border-border/60 bg-panel/40 px-4 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                    {status === "generating" ? "Composing screens…" : "Applying refinement…"}
                  </div>
                )}

                {project && project.screens.length > 0 && !isBusy && (
                  <div className="pt-2">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Screens
                    </div>
                    <div className="space-y-1">
                      {project.screens.map((s, i) => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedId(s.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                            selectedId === s.id ? "bg-brand/15 text-foreground" : "text-muted-foreground hover:bg-panel"
                          }`}
                        >
                          <span className="w-5 font-mono text-[10px] text-brand">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="flex-1 truncate">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4">
                <div className="rounded-2xl border border-border bg-panel/60 p-3">
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
                    placeholder={project ? "What do you want to change?" : "What do you want to design?"}
                    className="min-h-[64px] w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none disabled:opacity-50"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                      aria-label="Attach"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void refine()}
                      disabled={!project || isBusy || !input.trim()}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_20px_-6px_rgba(255,120,40,0.9)] transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                      aria-label="Send"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              {project ? (
                <>
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Palette
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(project.designSystem.palette).map(([k, v]) => (
                      <div key={k} className="rounded-xl border border-border p-2">
                        <div className="h-10 w-full rounded-md" style={{ background: v }} />
                        <div className="mt-1.5 text-[10px] font-medium capitalize">{k}</div>
                        <div className="text-[9px] text-muted-foreground">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mb-3 mt-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Platform
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-panel/70 p-1">
                    {(["ios", "android"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPlatform(p)}
                        className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          (project.platform ?? "ios") === p ? "bg-brand text-white" : "text-muted-foreground"
                        }`}
                      >
                        {p === "ios" ? "iOS" : "Android"}
                      </button>
                    ))}
                  </div>
                  <div className="mb-3 mt-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Typography
                  </div>
                  <div className="rounded-xl border border-border bg-panel/40 p-3 text-sm">
                    {project.designSystem.font}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Theme appears once screens are generated.
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Canvas */}
        <main
          className="relative flex-1 overflow-auto"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          <div className="min-h-full p-14">
            {project ? (
              <div
                className="flex min-w-max items-start justify-center gap-10 transition-transform"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
              >
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
              <div className="flex h-[70vh] flex-col items-center justify-center text-center">
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
                    ? "Sleek is generating a connected set of high-fidelity screens."
                    : "Describe an app in the chat panel to generate a set of screens."}
                </div>
              </div>
            )}
          </div>

          {/* Zoom toolbar */}
          <div className="pointer-events-auto sticky bottom-4 z-20 ml-auto mr-4 flex w-fit items-center gap-1 rounded-full border border-border bg-panel/90 p-1 shadow-xl backdrop-blur">
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/80 hover:bg-panel">
              <MousePointer2 className="h-3.5 w-3.5" />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-panel">
              <Hand className="h-3.5 w-3.5" />
            </button>
            <div className="mx-1 h-4 w-px bg-border" />
            <button
              onClick={() => setZoom((z) => Math.max(25, z - 10))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-panel"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[42px] text-center text-xs font-medium tabular-nums">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-panel"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-panel"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {selected && project && (
            <div className="pointer-events-auto absolute bottom-20 right-4 z-20 w-64 rounded-2xl border border-border bg-panel/95 p-4 shadow-2xl backdrop-blur">
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
                {["Make it blue", "Rounder corners", "Add settings screen", "Lighten theme", "Bigger typography"].map((q) => (
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

      {previewOpen && project && (
        <PreviewModal project={project} onClose={() => setPreviewOpen(false)} initialId={selectedId} />
      )}
    </div>
  );
}

function ProfileDropdown({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-profile-dropdown]")) onClose();
    }
    setTimeout(() => document.addEventListener("click", onDoc), 0);
    return () => document.removeEventListener("click", onDoc);
  }, [onClose]);

  const items = [
    { icon: UserIcon, label: "Account", hint: "Guest" },
    { icon: Settings, label: "Settings" },
    { icon: CreditCard, label: "Billing" },
    { icon: HelpCircle, label: "Help & Support" },
  ];
  return (
    <div
      data-profile-dropdown
      className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-panel/95 shadow-2xl backdrop-blur"
    >
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-brand text-sm font-bold text-white">
          T
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Guest Designer</div>
          <div className="truncate text-xs text-muted-foreground">Sign in to save projects</div>
        </div>
      </div>
      <div className="p-1">
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => {
              toast.message(it.label, { description: "Coming soon" });
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface"
          >
            <it.icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{it.label}</span>
            {it.hint && <span className="text-[10px] text-muted-foreground">{it.hint}</span>}
          </button>
        ))}
      </div>
      <div className="border-t border-border p-1">
        <button
          onClick={() => {
            toast.message("Sign in", { description: "Auth coming soon" });
            onClose();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-brand hover:bg-brand/10"
        >
          <LogOut className="h-4 w-4" />
          Sign in
        </button>
      </div>
    </div>
  );
}

function PreviewModal({
  project,
  onClose,
  initialId,
}: {
  project: Project;
  onClose: () => void;
  initialId: string | null;
}) {
  const [id, setId] = useState<string>(initialId ?? project.screens[0]?.id ?? "");
  const screen = project.screens.find((s) => s.id === id) ?? project.screens[0];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-panel/80 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Close preview"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="absolute left-5 top-5 flex items-center gap-2 text-sm">
        <Sparkle className="h-4 w-4 text-brand" />
        <span className="font-medium">Preview — {project.name}</span>
      </div>

      <div className="flex items-center gap-10">
        <div className="pointer-events-auto flex max-h-[80vh] w-64 flex-col gap-1 overflow-y-auto rounded-2xl border border-border bg-panel/60 p-2">
          {project.screens.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setId(s.id)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                s.id === id ? "bg-brand/20 text-foreground" : "text-muted-foreground hover:bg-surface"
              }`}
            >
              <span className="w-5 font-mono text-[10px] text-brand">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 truncate">{s.name}</span>
            </button>
          ))}
        </div>

        <PhoneFrame platform={project.platform} label={screen?.name ?? ""} index={0} selected={false}>
          {screen && (
            <ScreenRenderer screen={screen} ds={project.designSystem} platform={project.platform} />
          )}
        </PhoneFrame>
      </div>
    </div>
  );
}

function generateProjectCode(project: Project): string {
  const header = `// ${project.name}\n// Auto-generated from sleek.design\n// Idea: ${project.idea}\n\n`;
  const ds = `export const designSystem = ${JSON.stringify(project.designSystem, null, 2)} as const;\n\n`;
  const screens = project.screens
    .map((s) => {
      const compName = s.name.replace(/[^A-Za-z0-9]/g, "") || "Screen";
      return `export function ${compName}Screen() {
  // Role: ${s.role}
  return (
    <div style={{ background: designSystem.palette.background, color: designSystem.palette.text }}>
      ${s.blocks
        .map(
          (b) =>
            `{/* ${b.type} */}\n      <Block type=${JSON.stringify(b.type)} data={${JSON.stringify(b)}} />`,
        )
        .join("\n      ")}
    </div>
  );
}\n`;
    })
    .join("\n");
  return header + ds + screens;
}

function ExportDropdown({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const disabled = !project;
  return (
    <div className="absolute right-24 top-[52px] z-50 w-[420px] overflow-hidden rounded-2xl border border-border bg-panel/95 p-5 shadow-2xl backdrop-blur">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Build with AI
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Build your app with Claude Code, Codex, Cursor or more.
      </p>
      <div className="mt-3 space-y-2">
        <button
          disabled={disabled}
          onClick={() => {
            if (!project) return;
            const prompt = `Design brief: ${project.name}\n\n${project.idea}\n\nScreens:\n${project.screens
              .map((s, i) => `${i + 1}. ${s.name}`)
              .join("\n")}\n\nDesign system: ${JSON.stringify(project.designSystem)}`;
            navigator.clipboard.writeText(prompt);
            toast.success("AI prompt copied");
            onClose();
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-brand/40 bg-gradient-to-b from-brand/5 to-transparent p-3 text-left transition-colors hover:border-brand/70 disabled:opacity-40"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-panel">
            <Code2 className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Copy AI Prompt</div>
            <div className="text-xs text-muted-foreground">
              Paste prompt into your AI coding tool to implement designs
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-panel">
            <Copy className="h-3.5 w-3.5" />
          </div>
        </button>

        <button
          disabled
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface/60 p-3 text-left opacity-70"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-panel">
            <Plug className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Use Agent Skill</div>
            <div className="text-xs text-muted-foreground">
              Your coding agent can access your Sleek projects directly to implement designs
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="my-5 h-px bg-border" />

      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        External Builders
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {["Anything", "a0.dev"].map((name) => (
          <button
            key={name}
            onClick={() => {
              toast.message(name, { description: "Coming soon" });
              onClose();
            }}
            className="flex items-center justify-between rounded-full border border-border bg-surface/60 px-4 py-2 text-sm hover:border-brand/50"
          >
            <span className={name === "Anything" ? "font-serif italic" : ""}>{name}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>

      <div className="my-5 h-px bg-border" />

      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Manual Export
      </div>
      <div className="mt-2 space-y-1">
        {[
          { icon: Code2, label: "Export Code", action: "code", enabled: true },
          { icon: Figma, label: "Copy to Figma", action: "figma", enabled: false },
          { icon: Download, label: "Download Screenshots", action: "shots", enabled: false },
        ].map((item) => (
          <button
            key={item.action}
            disabled={disabled || !item.enabled}
            onClick={() => {
              if (item.action === "code" && project) {
                navigator.clipboard.writeText(JSON.stringify(project, null, 2));
                toast.success("Project JSON copied to clipboard");
              } else {
                toast.message(item.label, { description: "Coming soon" });
              }
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface disabled:opacity-40"
          >
            <item.icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{item.label}</span>
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}