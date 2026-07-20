"use client";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT, LINE } from "@/lib/theme";

// Small, dependency-free SVG charts styled to the QSL brand.

export function StatTile({ label, value, sub, tone = "ink", icon }) {
  const color = { ink: INK, pass: PASS, fail: FAIL, wait: WAIT, gold: "#8a6d00" }[tone] || INK;
  const bg = { ink: "#fff", pass: "#eef6f0", fail: "#fdf1ef", wait: "#fbf5e6", gold: "#fdf6e3" }[tone] || "#fff";
  return (
    <div className="card" style={{ padding: 14, background: bg, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", color: MUTE }}>{label}</div>
        {icon ? <span style={{ fontSize: 16 }} aria-hidden>{icon}</span> : null}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: MUTE, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

// Donut chart. segments = [{ label, value, color }].
export function Donut({ segments, size = 150, thickness = 22, centerLabel, centerValue }) {
  const total = segments.reduce((a, s) => a + (s.value || 0), 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={LINE} strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const frac = (s.value || 0) / total;
            const len = frac * circ;
            const el = (
              <circle
                key={i}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cx})`}
                style={{ transition: "stroke-dasharray .5s ease" }}
              >
                <title>{s.label}: {s.value}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        <text x={cx} y={cx - 4} textAnchor="middle" style={{ fontSize: 26, fontWeight: 900, fill: INK }}>{centerValue ?? total}</text>
        <text x={cx} y={cx + 14} textAnchor="middle" style={{ fontSize: 10, fill: MUTE, textTransform: "uppercase" }}>{centerLabel || "total"}</text>
      </svg>
      <div style={{ display: "grid", gap: 6, minWidth: 120 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: INK, flex: 1 }}>{s.label}</span>
            <b style={{ color: INK }}>{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal bar list. items = [{ label, value, color? }].
export function BarList({ items, color = COAL }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0));
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.length === 0 && <div style={{ color: MUTE, fontSize: 13 }}>No data yet.</div>}
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
            <span style={{ color: INK }}>{it.label}</span>
            <b style={{ color: INK }}>{it.value}</b>
          </div>
          <div style={{ height: 8, background: "#efeadd", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${((it.value || 0) / max) * 100}%`, height: "100%", background: it.color || color, borderRadius: 6, transition: "width .5s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Area + line trend. points = [{ date, count }].
export function TrendArea({ points, height = 120, color = GOLD }) {
  const w = 560;
  const h = height;
  const pad = 6;
  const max = Math.max(1, ...points.map((p) => p.count));
  const n = points.length;
  const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
  const y = (v) => h - pad - (v / max) * (h - 2 * pad - 12);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.count).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(n - 1).toFixed(1)} ${h - pad} L ${x(0).toFixed(1)} ${h - pad} Z`;
  const total = points.reduce((a, p) => a + p.count, 0);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="qsl-trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#qsl-trend)" />
        <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.count)} r={p.count ? 2.6 : 0} fill={color}>
            <title>{p.date}: {p.count}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: MUTE, marginTop: 2 }}>
        <span>{points[0]?.date?.slice(5)}</span>
        <span>{total} in 14 days</span>
        <span>{points[points.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

// Semicircle gauge for a 0..max score (e.g. satisfaction /5).
export function Gauge({ value, max = 5, label }) {
  const w = 180;
  const h = 104;
  const r = 78;
  const cx = w / 2;
  const cy = 92;
  const frac = Math.max(0, Math.min(1, (value || 0) / max));
  const ang = Math.PI * (1 - frac);
  const ex = cx + r * Math.cos(ang);
  const ey = cy - r * Math.sin(ang);
  const color = frac >= 0.8 ? PASS : frac >= 0.5 ? WAIT : FAIL;
  const arc = (a0, a1) => {
    const x0 = cx + r * Math.cos(a0), y0 = cy - r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path d={arc(Math.PI, 0)} fill="none" stroke={LINE} strokeWidth={14} strokeLinecap="round" />
        <path d={arc(Math.PI, ang)} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" style={{ transition: "all .5s ease" }} />
        <circle cx={ex} cy={ey} r={6} fill={color} />
        <text x={cx} y={cy - 12} textAnchor="middle" style={{ fontSize: 30, fontWeight: 900, fill: INK }}>{value ? value.toFixed(1) : "—"}</text>
        <text x={cx} y={cy + 6} textAnchor="middle" style={{ fontSize: 10, fill: MUTE }}>of {max}</text>
      </svg>
      {label ? <div style={{ fontSize: 12, color: MUTE, marginTop: 2 }}>{label}</div> : null}
    </div>
  );
}
