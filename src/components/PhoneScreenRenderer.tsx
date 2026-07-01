import { useLayoutEffect, useRef, type CSSProperties, type MouseEventHandler, type ReactNode, type Ref } from "react";
import DOMPurify from "dompurify";
import { PHONE_FRAME, PhoneFrameOutline, PhoneNotch } from "@/components/PhoneShell";

type Platform = "ios" | "android";

export const PHONE_SCREEN_PAGE_CLASS = "phone-screen-page";

export function sanitizePhoneScreenHtml(html: string): string {
  return DOMPurify.sanitize(html || "", {
    FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta", "base", "form"],
    FORBID_ATTR: ["srcdoc", "formaction", "ping"],
    ALLOW_DATA_ATTR: true,
    ADD_TAGS: ["style"],
    FORCE_BODY: true,
  });
}

function adaptCssForScopedPhoneScreen(css: string): string {
  return (css || "").replace(/(^|[\s,{}])(:root)\b/g, "$1:scope, .screen");
}

export function scopedPhoneScreenCss(css: string): string {
  const normalized = `
:scope {
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-size: 16px;
  color: var(--text, inherit);
  background: var(--bg, #000);
}
:scope, :scope * { box-sizing: border-box; }
`;

  return `@scope (.${PHONE_SCREEN_PAGE_CLASS}) to (.phone-screen-page-boundary) {\n${normalized}\n${adaptCssForScopedPhoneScreen(css)}\n}`;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else ref.current = value;
}

type PhoneScreenRendererProps = {
  platform: Platform;
  html: string;
  css: string;
  htmlVersion?: number;
  isWebsite?: boolean;
  frameWidth?: number | null;
  pageRef?: Ref<HTMLDivElement>;
  rootRef?: Ref<HTMLDivElement>;
  className?: string;
  pageClassName?: string;
  pageStyle?: CSSProperties;
  rootStyle?: CSSProperties;
  onClickCapture?: MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
  afterHtmlRender?: (page: HTMLDivElement) => void;
  children?: ReactNode;
};

/**
 * The one canonical phone-screen renderer used by both Lite and Pro.
 * It owns the fixed phone dimensions, chrome/notch, CSS scoping, and HTML
 * placement. Lite passes read-only HTML; Pro passes the same HTML and layers
 * editing overlays/interactions around this same rendered page.
 */
export function PhoneScreenRenderer({
  platform,
  html,
  css,
  htmlVersion,
  isWebsite = false,
  frameWidth = null,
  pageRef,
  rootRef,
  className = "",
  pageClassName = "",
  pageStyle,
  rootStyle,
  onClickCapture,
  onDoubleClick,
  afterHtmlRender,
  children,
}: PhoneScreenRendererProps) {
  const localPageRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const page = localPageRef.current;
    if (!page) return;
    const safeHtml = sanitizePhoneScreenHtml(html);
    if (page.innerHTML !== safeHtml) {
      page.innerHTML = safeHtml;
    }
    afterHtmlRender?.(page);
    // htmlVersion intentionally lets Pro force a re-render even if html string
    // returns to a previous value via undo/redo.
  }, [html, htmlVersion, afterHtmlRender]);

  const resolvedWidth = isWebsite && frameWidth ? frameWidth : PHONE_FRAME.width;

  return (
    <div
      ref={(node) => assignRef(rootRef, node)}
      className={`relative ${className}`}
      style={{
        width: resolvedWidth,
        height: isWebsite ? "auto" : PHONE_FRAME.height,
        ...rootStyle,
      }}
      onClickCapture={onClickCapture}
    >
      {!isWebsite && <PhoneFrameOutline platform={platform} overlay />}
      {!isWebsite && <PhoneNotch platform={platform} overlay />}
      <div
        ref={(node) => {
          localPageRef.current = node;
          assignRef(pageRef, node);
        }}
        onDoubleClick={onDoubleClick}
        className={`${PHONE_SCREEN_PAGE_CLASS} shadow-2xl ${pageClassName}`}
        style={{
          position: "relative",
          zIndex: 1,
          display: "block",
          overflow: "hidden",
          background: "#000",
          borderRadius: isWebsite ? 0 : PHONE_FRAME.contentRadius,
          fontSize: "16px",
          width: resolvedWidth,
          height: isWebsite ? "auto" : PHONE_FRAME.height,
          ...pageStyle,
        }}
        data-testid="canvas-page"
        data-phone-screen-page
      />
      {css && (
        <style
          data-phone-screen-css
          // Not part of the editable HTML — sibling of the page container,
          // so Pro commits only the screen document, not the renderer CSS.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: scopedPhoneScreenCss(css) }}
        />
      )}
      {children}
    </div>
  );
}