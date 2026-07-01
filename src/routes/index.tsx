import { TEMPLATES } from "@/lib/templates";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkle, Wand2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [idea, setIdea] = useState("");
  const [platform, setPlatform] = useState<"ios" | "android">("ios");

  function launch(withIdea: string) {
    if (!withIdea.trim()) return;
    const params = new URLSearchParams({ idea: withIdea, platform });
    navigate({ to: "/workspace", search: () => Object.fromEntries(params) });
  }

  return (
    <div className="min-h-screen bg-surface text-foreground">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
            <div className="h-3 w-3 rounded-full bg-white" />
          </div>
          <span className="font-semibold tracking-tight">Nova Design AI</span>
        </div>
        <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#templates" className="hover:text-foreground">Templates</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <button
            onClick={() => launch("A modern productivity app with focus timer, tasks, and calendar")}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-200"
          >
            Open workspace
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px circle at 50% 0%, rgba(99,102,241,0.25), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-panel/50 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <Sparkle className="h-3 w-3 text-brand" />
            AI mobile app designer
          </div>
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Ship investor-ready<br /> mobile screens in seconds.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-muted-foreground">
            Describe your app. Get a connected set of high-fidelity iOS or Android screens.
            Refine with chat. Export to Figma or code.
          </p>

          {/* Prompt */}
          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-border bg-panel/60 p-2 backdrop-blur">
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="A calm meditation app with breathing exercises, sleep stories, and a streak tracker..."
              className="min-h-[120px] w-full resize-none rounded-xl bg-transparent p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3 p-2">
              <div className="flex items-center gap-1 rounded-full bg-surface p-1">
                {(["ios", "android"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                      platform === p ? "bg-panel text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {p === "ios" ? "iOS" : "Android"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => launch(idea)}
                disabled={!idea.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition-all hover:brightness-110 disabled:opacity-40"
              >
                <Wand2 className="h-4 w-4" />
                Generate screens
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand">Templates</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Start from a proven category</h2>
          </div>
          <div className="hidden text-xs text-muted-foreground md:block">Free tier includes 1 project</div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => launch(t.idea)}
              className="group flex flex-col items-start rounded-2xl border border-border bg-panel/50 p-5 text-left transition-all hover:border-brand/50 hover:bg-panel"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t.category}
              </div>
              <div className="mt-2 text-base font-semibold">{t.name}</div>
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</div>
              <div className="mt-6 inline-flex items-center gap-1 text-[11px] font-semibold text-brand opacity-0 transition-opacity group-hover:opacity-100">
                Generate <ArrowRight className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-4xl px-6 pb-24">
        <div className="mb-8 text-center">
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand">Pricing</div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Start free. Scale when your team does.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { name: "Free", price: "$0", perks: ["1 project", "50 AI credits / month", "Export to code"] },
            { name: "Pro", price: "$24", perks: ["Unlimited projects", "2,000 credits / month", "Figma export"], featured: true },
            { name: "Team", price: "$79", perks: ["Everything in Pro", "Team collaboration", "Priority generation"] },
          ].map((t) => (
            <div
              key={t.name}
              className={`rounded-2xl border p-6 ${
                t.featured ? "border-brand bg-brand/5" : "border-border bg-panel/50"
              }`}
            >
              <div className="text-sm font-semibold">{t.name}</div>
              <div className="mt-3 text-3xl font-bold">
                {t.price}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/mo</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                {t.perks.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-brand" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Nova Design AI · Turn ideas into mobile screens
      </footer>
    </div>
  );
}
