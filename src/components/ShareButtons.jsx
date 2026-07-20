"use client";
import { useState } from "react";
import { INK } from "@/lib/theme";

// Email + WhatsApp share buttons (plus copy link). `url` is appended to the
// message. Uses mailto: and wa.me so it works from any browser / phone.
export default function ShareButtons({ subject, message, url, size = "sm" }) {
  const [copied, setCopied] = useState(false);
  const body = `${message || ""}${url ? `\n\n${url}` : ""}`.trim();
  const mailto = `mailto:?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(body)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url || body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const fs = size === "sm" ? 12 : 13;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: fs,
    fontWeight: 700,
    padding: "8px 12px",
    borderRadius: 6,
    textDecoration: "none",
    border: "1px solid",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a href={mailto} style={{ ...base, background: "#fff", color: INK, borderColor: "#cfc8ba" }}>
        <span aria-hidden>✉</span> Email
      </a>
      <a href={whatsapp} target="_blank" rel="noreferrer" style={{ ...base, background: "#25D366", color: "#fff", borderColor: "#25D366" }}>
        <span aria-hidden>🟢</span> WhatsApp
      </a>
      <button onClick={copy} style={{ ...base, background: "#fff", color: INK, borderColor: "#cfc8ba" }}>
        <span aria-hidden>🔗</span> {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
