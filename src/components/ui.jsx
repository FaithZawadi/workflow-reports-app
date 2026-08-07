"use client";
import { STATUS, GOLD, INK } from "@/lib/theme";

export function Stripe() {
  return <div className="stripe" />;
}

export function Brand({ small, onDark }) {
  // The official logo lockup (icon + wordmark), used as-is. Its wordmark is dark,
  // so on dark surfaces it sits on a white pill; on light surfaces it stands alone.
  const height = small ? 24 : 34;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logo.svg" alt="Qalibrated Systems" style={{ display: "block", height, width: "auto" }} />
  );
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        ...(onDark
          ? { background: "#fff", borderRadius: 8, padding: small ? "5px 9px" : "8px 12px" }
          : {}),
      }}
    >
      {img}
    </span>
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
