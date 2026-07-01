import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";

// Sanitizer configured identically to the Pro-mode canvas — same allowlist
// so a screen renders the same way in Lite (read-only) as in Pro (editable).
function sanitize(html: string): string {
  return DOMPurify.sanitize(html || "", {
    FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta", "base", "form"],
    FORBID_ATTR: ["srcdoc", "formaction", "ping"],
    ALLOW_DATA_ATTR: true,
    ADD_TAGS: ["style"],
    FORCE_BODY: true,
  });
}

// Shadow roots have no `:root` — selectors like `:root { --text: … }` from the
// AI-generated design system silently match nothing, so every `var(--text)`
// falls back to inherited/default and text renders faded. Rewrite `:root` to
// selectors that DO match inside a shadow tree so tokens cascade correctly.
function adaptCssForShadow(css: string): string {
  return (css || "").replace(/(^|[\s,{}])(:root)\b/g, "$1:host, .screen, .pro-canvas-page");
}

type Props = {
  html: string;
  css: string;
  className?: string;
};

/**
 * Renders a screen's HTML inside a Shadow DOM so its <style> tags and any
 * inline styles never leak into the host app. The shared design-system CSS
 * is prepended so every screen inherits the same tokens.
 */
export function HtmlScreen({ html, css, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${adaptCssForShadow(css)}\n:host{display:block;width:100%;height:100%;box-sizing:border-box;font-size:16px;color:var(--text,inherit);background:var(--bg,transparent);}</style>${sanitize(html)}`;
  }, [html, css]);

  return <div ref={hostRef} className={className} style={{ width: "100%", height: "100%" }} />;
}