"use client";
import { STATUS, GOLD, COAL, INK, MUTE } from "@/lib/theme";

export function Stripe() {
  return <div className="stripe" />;
}

export function Brand({ small, onDark }) {
  const tile = small ? 34 : 44;
  const mark = small ? 26 : 34;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* The mark is black-on-light, so on dark surfaces it sits on a white tile. */}
      <span
        aria-hidden
        style={{
          width: tile,
          height: tile,
          borderRadius: 6,
          background: "#fff",
          border: onDark ? "none" : "1px solid var(--line)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.svg" alt="" width={mark} height={mark} style={{ display: "block" }} />
      </span>
      <span style={{ fontWeight: 900, letterSpacing: "-.01em", fontSize: small ? 15 : 18, lineHeight: 1.05 }}>
        QALIBRATED{" "}
        <span style={{ color: GOLD, display: small ? "inline" : "block", letterSpacing: ".08em" }}>SYSTEMS</span>
      </span>
    </div>
  );
}

export function Pill({ status }) {
  const s = STATUS[status] || { label: status, color: INK };
  return (
    <span className="pill" style={{ background: s.color }}>
      {s.label}
    </span>
  );
}

export function SectionBar({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 8px" }}>
      <span style={{ background: GOLD, width: 10, height: 10 }} />
      <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: ".03em", textTransform: "uppercase", color: INK }}>
        {children}
      </span>
    </div>
  );
}

export function PaperCard({ children }) {
  return (
    <div className="card">
      <Stripe />
      <div className="paper" style={{ padding: 20 }}>
        {children}
      </div>
      <Stripe />
    </div>
  );
}

export function Field({ label, value, onChange, type = "text", placeholder, suggestions, listId }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input
        className="input"
        type={type}
        value={value || ""}
        placeholder={placeholder || ""}
        list={suggestions && suggestions.length ? listId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {suggestions && suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </label>
  );
}

export function Textarea({ label, value, onChange, rows = 3 }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <textarea className="input" rows={rows} value={value || ""} onChange={(e) => onChange(e.target.value)} spellCheck autoCapitalize="sentences" />
    </label>
  );
}
