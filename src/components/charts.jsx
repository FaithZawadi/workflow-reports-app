"use client";
import Link from "next/link";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT, LINE } from "@/lib/theme";

// Small, dependency-free SVG charts styled to the QSL brand. Many elements accept
// an `href` so clicking them drills into a filtered list (interactive search).

// Wrap children in a Link when href is given, else a plain span.
function Maybe({ href, children, style }) {
  if (href) return <Link href={href} style={{ textDecoration: "none", color: "inherit", ...style }}>{children}</Link>;
  return <div style={style}>{children}</div>;
}

export function StatTile({ label, value, sub, tone = "ink", icon, href }) {
  const color = { ink: INK, pass: PASS, fail: FAIL, wait: WAIT, gold: "#8a6d00" }[tone] || INK;
  const bg = { ink: "#fff", pass: "#eef6f0", fail: "#fdf1ef", wait: "#fbf5e6", gold: "#fdf6e3" }[tone] || "#fff";
  return (
    <Maybe href={href}>
      <div className="card" style={{ padding: 14, background: bg, minWidth: 0, cursor: href ? "pointer" : "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", color: MUTE }}>{label}</div>
          {icon ? <span style={{ fontSize: 16 }} aria-hidden>{icon}</span> : null}
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
        {sub ? <div style={{ fontSize: 12, color: MUTE, marginTop: 2 }}>{sub}</div> : null}
      </div>
    </Maybe>
  );
}

// Donut chart. segments = [{ label, value, color }].
export function Donut({ segments, size = 156, thickness = 20, centerLabel, centerValue }) {
  const total = segments.reduce((a, s) => a + (s.value || 0), 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const gap = segments.length > 1 ? 2.2 : 0; // small gap between arcs for a cleaner look
  let offset = 0;
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={LINE} strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const frac = (s.value || 0) / total;
            const len = Math.max(0, frac * circ - gap);
            const el = (
              <circle
                key={i}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cx})`}
                style={{ transition: "stroke-dasharray .5s ease" }}
              >
                <title>{s.label}: {s.value}</title>
              </circle>
            );
            offset += frac * circ;
            return el;
          })}
        <text x={cx} y={cx - 3} textAnchor="middle" style={{ fontSize: 30, fontWeight: 900, fill: INK }}>{centerValue ?? total}</text>
        <text x={cx} y={cx + 15} textAnchor="middle" style={{ fontSize: 9.5, fill: MUTE, textTransform: "uppercase", letterSpacing: ".08em" }}>{centerLabel || "total"}</text>
      </svg>
      <div style={{ display: "grid", gap: 7, minWidth: 130, flex: 1 }}>
        {segments.map((s, i) => (
          <Maybe key={i} href={s.href} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, padding: "3px 4px", borderRadius: 6, cursor: s.href ? "pointer" : "default" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: INK, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
            <b style={{ color: INK }}>{s.value}</b>
            <span style={{ color: MUTE, fontSize: 11, width: 34, textAlign: "right" }}>{total ? Math.round(((s.value || 0) / total) * 100) : 0}%</span>
          </Maybe>
        ))}
      </div>
    </div>
  );
}

// Horizontal bar list. items = [{ label, value, color? }].
export function BarList({ items, color = COAL }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0));
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.length === 0 && <div style={{ color: MUTE, fontSize: 13 }}>No data yet.</div>}
      {items.map((it, i) => (
        <Maybe key={i} href={it.href} style={{ display: "block", cursor: it.href ? "pointer" : "default" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
            <span style={{ color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 8 }}>{it.label}</span>
            <b style={{ color: INK, flexShrink: 0 }}>{it.value}</b>
          </div>
          <div style={{ height: 9, background: "#efeadd", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${((it.value || 0) / max) * 100}%`, height: "100%", background: it.color || color, borderRadius: 6, transition: "width .5s ease" }} />
          </div>
        </Maybe>
      ))}
    </div>
  );
}

// Smooth area + line trend. points = [{ date, count }].
export function TrendArea({ points = [], height = 150, color = GOLD, rangeLabel }) {
  const w = 560;
  const h = height;
  const padX = 6;
  const padTop = 12;
  const padBot = 18;
  const max = Math.max(1, ...points.map((p) => p.count));
  const n = points.length;
  const x = (i) => padX + (i * (w - 2 * padX)) / Math.max(1, n - 1);
  const y = (v) => h - padBot - (v / max) * (h - padTop - padBot);
  // Smooth the line with a monotone-ish cubic through the points.
  const pts = points.map((p, i) => [x(i), y(p.count)]);
  let line = "";
  pts.forEach(([px, py], i) => {
    if (i === 0) { line += `M ${px.toFixed(1)} ${py.toFixed(1)}`; return; }
    const [x0, y0] = pts[i - 1];
    const cx = (x0 + px) / 2;
    line += ` C ${cx.toFixed(1)} ${y0.toFixed(1)} ${cx.toFixed(1)} ${py.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`;
  });
  const area = n ? `${line} L ${x(n - 1).toFixed(1)} ${h - padBot} L ${x(0).toFixed(1)} ${h - padBot} Z` : "";
  const total = points.reduce((a, p) => a + p.count, 0);
  const gridYs = [0.25, 0.5, 0.75, 1].map((f) => h - padBot - f * (h - padTop - padBot));
  const gid = `qsl-trend-${color.replace("#", "")}`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridYs.map((gy, i) => (
          <line key={i} x1={padX} y1={gy} x2={w - padX} y2={gy} stroke={LINE} strokeWidth="1" strokeDasharray="2 4" />
        ))}
        {area ? <path d={area} fill={`url(#${gid})`} /> : null}
        {line ? <path d={line} fill="none" stroke={color} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.count)} r={p.count ? 2.6 : 0} fill="#fff" stroke={color} strokeWidth={1.6}>
            <title>{p.date}: {p.count}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: MUTE, marginTop: 2, fontFamily: "var(--mono)" }}>
        <span>{points[0]?.date?.slice(5)}</span>
        <span>{total} {rangeLabel || "in 14 days"}</span>
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
