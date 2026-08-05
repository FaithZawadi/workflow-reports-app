"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// First-party, privacy-light analytics: records a page view on every route change
// and a click event for meaningful interactions (links, buttons, or anything
// tagged data-track). No cookies, no third parties — just an anonymous per-browser
// session id in localStorage so we can count unique visitors. Best-effort: any
// failure is swallowed so it never affects the app.

const SID_KEY = "qsl_sid";

function sessionId() {
  try {
    let id = localStorage.getItem(SID_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(SID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

function send(payload) {
  try {
    const body = JSON.stringify({ ...payload, sessionId: sessionId() });
    // keepalive lets the request finish even as the page navigates away.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* never throw */
  }
}

// A short human label for a clicked element.
function labelFor(el) {
  const t = el.closest("[data-track]");
  if (t?.getAttribute("data-track")) return t.getAttribute("data-track").slice(0, 80);
  const a = el.closest("a,button");
  if (!a) return null;
  const text = (a.getAttribute("aria-label") || a.textContent || "").trim().replace(/\s+/g, " ");
  if (text) return text.slice(0, 80);
  const href = a.getAttribute("href");
  return href ? `link ${href}`.slice(0, 80) : (a.tagName === "BUTTON" ? "button" : null);
}

export default function Analytics() {
  const pathname = usePathname();
  const lastPath = useRef(null);

  // Page views — one per distinct path.
  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;
    const ref = document.referrer || "";
    send({ type: "pageview", path: pathname, ref });
  }, [pathname]);

  // Clicks — delegated, throttled to meaningful targets.
  useEffect(() => {
    let last = 0;
    const onClick = (e) => {
      const el = e.target;
      if (!el || !el.closest) return;
      if (!el.closest("a,button,[data-track]")) return;
      const now = Date.now();
      if (now - last < 250) return; // debounce double-fires
      last = now;
      const label = labelFor(el);
      if (label) send({ type: "click", path: window.location.pathname, label });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
