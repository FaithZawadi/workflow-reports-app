"use client";
import { STATUS, GOLD, COAL, INK, MUTE } from "@/lib/theme";

export function Stripe() {
  return <div className="stripe" />;
}

export function Brand({ small }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          transform: "rotate(45deg)",
          backgroundImage: `repeating-linear-gradient(45deg, ${GOLD} 0 5px, ${COAL} 5px 10px)`,
          display: "inline-block",
          borderRadius: 2,
        }}
      />
      <span style={{ fontWeight: 900, letterSpacing: "-.01em", fontSize: small ? 15 : 18 }}>
        QALIBRATED <span style={{ color: GOLD }}>SYSTEMS</span>
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
      <textarea className="input" rows={rows} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
