import { HtmlScreen } from "@/components/HtmlScreen";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ensureIds } from "@/lib/pro/htmlUtils";
import { loadProject, saveProject } from "@/lib/project-store";
import type { Project } from "@/lib/screen-schema";
import { useEditorStore } from "@/store/editorStore";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  CreditCard,
  Download,
  Figma,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Megaphone,
  MonitorPlay,
  Moon,
  Plug,
  Redo2,
  Settings,
  Share2,
  Sparkle,
  Sparkles,
  Undo2,
  User as UserIcon,
  X,
  Zap,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// Pro-mode editor pieces (lazy — big bundle we only need on desktop).
const Canvas = lazy(() => import("@/components/editor/Canvas"));
const LayersPanel = lazy(() => import("@/components/editor/LayersPanel"));
const PropertiesPanel = lazy(() => import("@/components/editor/PropertiesPanel"));

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
  const [mode, setMode] = useState<"pro" | "lite">(() =>
    typeof window !== "undefined" && window.innerWidth >= 1024 ? "pro" : "lite",
  );
  const bootstrapped = useRef(false);

  // ---- editor store wiring -------------------------------------------------
  const editorHtml = useEditorStore((s: any) => s.html) as string;
  const reloadHtml = useEditorStore((s: any) => s.reloadHtml) as (html: string) => void;
  const undo = useEditorStore((s: any) => s.undo) as () => void;
  const redo = useEditorStore((s: any) => s.redo) as () => void;
  const canUndo = useEditorStore((s: any) => s.history.length > 0) as boolean;
  const canRedo = useEditorStore((s: any) => s.future.length > 0) as boolean;
  const editorResetForScreen = useCallback(
    (html: string) => {
      const withIds = html ? ensureIds(html) : "";
      reloadHtml(withIds);
    },
    [reloadHtml],
  );

  // Keep the Pro editor's shared design-system CSS in sync with the project so
  // Pro-mode canvas renders each screen with the same tokens/components as Lite.
  useEffect(() => {
    useEditorStore.setState({ project, designSystemCss: project?.designSystemCss || "" });
  }, [project]);

  // On screen switch, push that screen's HTML into the editor store.
  const lastLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!project || !selectedId) return;
    if (lastLoadedRef.current === selectedId) return;
    const s = project.screens.find((x) => x.id === selectedId);
    if (!s) return;
    lastLoadedRef.current = selectedId;
    editorResetForScreen(s.html || "");
  }, [project, selectedId, editorResetForScreen]);

  // Persist editor edits back into the active screen's html (debounced).
  useEffect(() => {
    if (!project || !selectedId) return;
    if (lastLoadedRef.current !== selectedId) return;
    const s = project.screens.find((x) => x.id === selectedId);
    if (!s || s.html === editorHtml) return;
    const t = setTimeout(() => {
      setProject((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          screens: prev.screens.map((x) => (x.id === selectedId ? { ...x, html: editorHtml } : x)),
        };
        saveProject(next);
        return next;
      });
    }, 200);
    return () => clearTimeout(t);
  }, [editorHtml, project, selectedId]);

  // ---- generation ----------------------------------------------------------
  const generate = useCallback(async (ideaText: string, plat: "ios" | "android") => {
    setStatus("generating");
    setChat([{ role: "assistant", text: `Generating a ${plat === "ios" ? "iOS" : "Android"} concept for: "${ideaText}"…` }]);
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
      lastLoadedRef.current = null;
      saveProject(p);
      setChat((c) => [
        ...c,
        { role: "assistant", text: `Generated ${p.screens.length} screens for "${p.name}". Tell me what to change — colors, layout, copy, or edit directly in Pro mode.` },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Generation failed: ${message}`);
      setChat((c) => [...c, { role: "assistant", text: `Generation failed: ${message}` }]);
    } finally {
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (share) {
      const p = decodeShare(share);
      if (p && p.screens?.[0]?.html) {
        setProject(p);
        setSelectedId(p.screens[0]?.id ?? null);
        saveProject(p);
        setChat([{ role: "assistant", text: `Loaded a shared project — "${p.name}".` }]);
        return;
      }
      toast.error("Shared link is invalid or from an older version.");
    }
    const saved = loadProject();
    if (idea) {
      generate(idea, platformParam ?? "ios");
    } else if (saved && saved.screens?.[0]?.html) {
      setProject(saved);
      setSelectedId(saved.screens[0]?.id ?? null);
    } else if (saved) {
      // Legacy block-based project — retire it silently.
      toast.message("Your previous project was on an older format", { description: "Start a new one to use the HTML editor." });
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
    if (!input.trim() || !project || status !== "idle" || !selectedId) return;
    const screen = project.screens.find((s) => s.id === selectedId);
    if (!screen) return;
    const instruction = input.trim();
    setInput("");
    setChat((c) => [...c, { role: "user", text: instruction }]);
    setStatus("refining");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "refine",
          instruction,
          screenHtml: screen.html,
          designSystemCss: project.designSystemCss,
          projectContext: { name: project.name, platform: project.platform },
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const { html } = (await res.json()) as { html: string };
      const withIds = ensureIds(html);
      // Same document — push through editor store so undo/redo history stays unified.
      reloadHtml(withIds);
      setProject((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          screens: prev.screens.map((x) => (x.id === selectedId ? { ...x, html: withIds } : x)),
        };
        saveProject(next);
        return next;
      });
      setChat((c) => [...c, { role: "assistant", text: `Updated "${screen.name}".` }]);
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

  // Keyboard: cmd/ctrl+Z undo, shift+cmd/ctrl+Z redo — global while in Pro mode.
  useEffect(() => {
    if (mode !== "pro") return;
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, undo, redo]);

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
          {/* Mode toggle */}
          <div className="flex items-center gap-1 rounded-full border border-border bg-panel/40 p-1">
            {(["lite", "pro"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  mode === m ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "pro" && <Zap className="h-3 w-3" />}
                {m === "pro" ? "Pro" : "Lite"}
              </button>
            ))}
          </div>

          {mode === "pro" && (
            <div className="ml-1 flex items-center gap-1 rounded-full border border-border bg-panel/40 p-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                title="Undo (⌘Z)"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                title="Redo (⇧⌘Z)"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

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
            {profileOpen && <ProfileDropdown onClose={() => setProfileOpen(false)} />}
          </div>
        </div>

        {exportOpen && <ExportDropdown project={project} onClose={() => setExportOpen(false)} />}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — chat + theme (both modes), plus Layers in Pro */}
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex items-center justify-between px-4 pt-4">
            <div className="flex items-center gap-1 rounded-full bg-panel/70 p-1">
              {(mode === "pro" ? (["chat", "theme"] as const) : (["chat", "theme"] as const)).map((t) => (
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
          </div>

          {tab === "chat" ? (
            <ChatPanel
              project={project}
              chat={chat}
              isBusy={isBusy}
              status={status}
              input={input}
              setInput={setInput}
              refine={refine}
              screens={project?.screens ?? []}
              selectedId={selectedId}
              onSelectScreen={setSelectedId}
            />
          ) : (
            <ThemePanel project={project} setPlatform={setPlatform} />
          )}

          {mode === "pro" && project && (
            <div className="max-h-[40%] shrink-0 overflow-y-auto border-t border-border">
              <Suspense fallback={<div className="p-3 text-xs text-muted-foreground">Loading layers…</div>}>
                <LayersPanel embedded />
              </Suspense>
            </div>
          )}
        </aside>

        {/* Canvas */}
        <main
          className="relative flex-1 overflow-hidden"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          {mode === "pro" ? (
            <ProCanvasHost project={project} isBusy={isBusy} />
          ) : (
            <LiteCanvas
              project={project}
              selectedId={selectedId}
              onSelectScreen={setSelectedId}
              isBusy={isBusy}
            />
          )}
        </main>

        {/* Right panel — Properties (Pro only) */}
        {mode === "pro" && project && (
          <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface">
            <Suspense fallback={<div className="p-3 text-xs text-muted-foreground">Loading properties…</div>}>
              <PropertiesPanel />
            </Suspense>
          </aside>
        )}
      </div>

      {previewOpen && project && (
        <PreviewModal project={project} onClose={() => setPreviewOpen(false)} initialId={selectedId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LiteCanvas({
  project,
  selectedId,
  onSelectScreen,
  isBusy,
}: {
  project: Project | null;
  selectedId: string | null;
  onSelectScreen: (id: string) => void;
  isBusy: boolean;
}) {
  return (
    <div className="h-full w-full overflow-auto">
      <div className="min-h-full p-14">
        {project ? (
          <div className="flex min-w-max items-start justify-center gap-10">
            {project.screens.map((s, i) => (
              <PhoneFrame
                key={s.id}
                platform={project.platform}
                label={s.name}
                index={i}
                selected={s.id === selectedId}
                onClick={() => onSelectScreen(s.id)}
              >
                <HtmlScreen html={s.html} css={project.designSystemCss} />
              </PhoneFrame>
            ))}
          </div>
        ) : (
          <EmptyState isBusy={isBusy} />
        )}
      </div>
    </div>
  );
}

function ProCanvasHost({ project, isBusy }: { project: Project | null; isBusy: boolean }) {
  return (
    <div className="relative h-full w-full">
      {project ? (
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading editor…</div>}>
          <Canvas />
        </Suspense>
      ) : (
        <div className="flex h-full items-center justify-center">
          <EmptyState isBusy={isBusy} />
        </div>
      )}
    </div>
  );
}

function EmptyState({ isBusy }: { isBusy: boolean }) {
  return (
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
          ? "Sleek is generating a shared design system and a set of high-fidelity screens."
          : "Describe an app in the chat panel to generate a set of screens."}
      </div>
    </div>
  );
}

function ChatPanel({
  project, chat, isBusy, status, input, setInput, refine, screens, selectedId, onSelectScreen,
}: {
  project: Project | null;
  chat: ChatMsg[];
  isBusy: boolean;
  status: "idle" | "generating" | "refining";
  input: string;
  setInput: (v: string) => void;
  refine: () => void | Promise<void>;
  screens: Project["screens"];
  selectedId: string | null;
  onSelectScreen: (id: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {project?.idea && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-panel/60 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15">
              <Sparkles className="h-4 w-4 text-brand" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project brief</div>
              <div className="truncate text-sm font-semibold">{project.name}</div>
            </div>
          </div>
        )}
        {chat.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-2xl bg-panel px-4 py-2 text-sm text-foreground/90">{m.text}</div>
          ) : (
            <div key={i} className="mr-auto max-w-[92%] rounded-2xl border border-border/60 bg-panel/40 px-4 py-2.5 text-sm text-foreground/90">{m.text}</div>
          ),
        )}
        {isBusy && (
          <div className="mr-auto flex max-w-[92%] items-center gap-2 rounded-2xl border border-border/60 bg-panel/40 px-4 py-2.5 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
            {status === "generating" ? "Composing screens…" : "Applying refinement…"}
          </div>
        )}
        {screens.length > 0 && !isBusy && (
          <div className="pt-2">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Screens</div>
            <div className="space-y-1">
              {screens.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => onSelectScreen(s.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                    selectedId === s.id ? "bg-brand/15 text-foreground" : "text-muted-foreground hover:bg-panel"
                  }`}
                >
                  <span className="w-5 font-mono text-[10px] text-brand">{String(i + 1).padStart(2, "0")}</span>
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
            placeholder={project ? "Change the selected screen…" : "What do you want to design?"}
            className="min-h-[64px] w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none disabled:opacity-50"
          />
          <div className="mt-1 flex items-center justify-between">
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground" aria-label="Attach">
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
  );
}

function ThemePanel({ project, setPlatform }: { project: Project | null; setPlatform: (p: "ios" | "android") => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      {project ? (
        <>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Palette</div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(project.designSystem.palette).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border p-2">
                <div className="h-10 w-full rounded-md" style={{ background: v }} />
                <div className="mt-1.5 text-[10px] font-medium capitalize">{k}</div>
                <div className="text-[9px] text-muted-foreground">{v}</div>
              </div>
            ))}
          </div>
          <div className="mb-3 mt-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Platform</div>
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
          <div className="mb-3 mt-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Typography</div>
          <div className="rounded-xl border border-border bg-panel/40 p-3 text-sm">{project.designSystem.font}</div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Theme appears once screens are generated.
        </div>
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
    <div data-profile-dropdown className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-panel/95 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-brand text-sm font-bold text-white">T</div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Guest Designer</div>
          <div className="truncate text-xs text-muted-foreground">Sign in to save projects</div>
        </div>
      </div>
      <div className="p-1">
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => { toast.message(it.label, { description: "Coming soon" }); onClose(); }}
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
          onClick={() => { toast.message("Sign in", { description: "Auth coming soon" }); onClose(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-brand hover:bg-brand/10"
        >
          <LogOut className="h-4 w-4" />
          Sign in
        </button>
      </div>
    </div>
  );
}

function PreviewModal({ project, onClose, initialId }: { project: Project; onClose: () => void; initialId: string | null }) {
  const [id, setId] = useState<string>(initialId ?? project.screens[0]?.id ?? "");
  const screen = project.screens.find((s) => s.id === id) ?? project.screens[0];
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <button onClick={onClose} className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-panel/80 text-muted-foreground transition-colors hover:text-foreground" aria-label="Close preview">
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
              <span className="w-5 font-mono text-[10px] text-brand">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 truncate">{s.name}</span>
            </button>
          ))}
        </div>
        <PhoneFrame platform={project.platform} label={screen?.name ?? ""} index={0} selected={false}>
          {screen && <HtmlScreen html={screen.html} css={project.designSystemCss} />}
        </PhoneFrame>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exports — all derived from HTML
// ---------------------------------------------------------------------------

function tsxWrap(project: Project): string {
  const header = `// ${project.name}\n// Generated by sleek.design\n// Idea: ${project.idea}\n\n`;
  const cssConst = `const DESIGN_SYSTEM_CSS = ${JSON.stringify(project.designSystemCss)};\n\n`;
  const screens = project.screens.map((s) => {
    const compName = (s.name.replace(/[^A-Za-z0-9]/g, "") || "Screen") + "Screen";
    return `export function ${compName}() {
  return (
    <div className="mobile-screen">
      <style>{DESIGN_SYSTEM_CSS}</style>
      <div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(s.html)} }} />
    </div>
  );
}\n`;
  }).join("\n");
  return header + cssConst + screens;
}

function figmaJson(project: Project) {
  return {
    name: project.name,
    designSystem: project.designSystem,
    designSystemCss: project.designSystemCss,
    frames: project.screens.map((s) => ({ name: s.name, id: s.id, width: 375, height: 812, role: s.role, html: s.html })),
    note: "Import via a Figma HTML-to-Figma plugin (e.g. html.to.design) for full fidelity.",
  };
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function ExportDropdown({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const disabled = !project;
  return (
    <div className="absolute right-24 top-[52px] z-50 w-[420px] overflow-hidden rounded-2xl border border-border bg-panel/95 p-5 shadow-2xl backdrop-blur">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Build with AI</div>
      <p className="mt-1 text-xs text-muted-foreground">Copy an AI prompt for your coding tool of choice.</p>
      <div className="mt-3 space-y-2">
        <button
          disabled={disabled}
          onClick={() => {
            if (!project) return;
            const prompt = `Design brief: ${project.name}\n\nIdea: ${project.idea}\n\nShared CSS:\n${project.designSystemCss}\n\nScreens:\n${project.screens.map((s, i) => `${i + 1}. ${s.name} (${s.role})\n${s.html}`).join("\n\n---\n\n")}`;
            navigator.clipboard.writeText(prompt);
            toast.success("AI prompt copied");
            onClose();
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-brand/40 bg-gradient-to-b from-brand/5 to-transparent p-3 text-left transition-colors hover:border-brand/70 disabled:opacity-40"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-panel"><Code2 className="h-4 w-4" /></div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Copy AI Prompt</div>
            <div className="text-xs text-muted-foreground">Paste into Claude Code, Codex, Cursor to implement designs</div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-panel"><Copy className="h-3.5 w-3.5" /></div>
        </button>
        <button disabled className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface/60 p-3 text-left opacity-70">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-panel"><Plug className="h-4 w-4" /></div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Use Agent Skill</div>
            <div className="text-xs text-muted-foreground">Coming soon</div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="my-5 h-px bg-border" />
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Manual Export</div>
      <div className="mt-2 space-y-1">
        {[
          { icon: Code2, label: "Export React (TSX)", action: "code" },
          { icon: Download, label: "Export raw HTML", action: "html" },
          { icon: Figma, label: "Export Figma-ready JSON", action: "figma" },
          { icon: Download, label: "Download Project JSON", action: "json" },
        ].map((item) => (
          <button
            key={item.action}
            disabled={disabled}
            onClick={() => {
              if (!project) return;
              const name = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
              if (item.action === "code") {
                downloadFile(`${name}.tsx`, tsxWrap(project), "text/plain");
                toast.success("React TSX downloaded");
              } else if (item.action === "html") {
                const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${project.name}</title><style>${project.designSystemCss}</style></head><body>${project.screens.map((s) => s.html).join("\n<hr/>\n")}</body></html>`;
                downloadFile(`${name}.html`, doc, "text/html");
                toast.success("HTML downloaded");
              } else if (item.action === "figma") {
                downloadFile(`${name}.figma.json`, JSON.stringify(figmaJson(project), null, 2), "application/json");
                toast.success("Figma-ready JSON downloaded");
              } else if (item.action === "json") {
                downloadFile(`${name}.json`, JSON.stringify(project, null, 2), "application/json");
                toast.success("Project JSON downloaded");
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
