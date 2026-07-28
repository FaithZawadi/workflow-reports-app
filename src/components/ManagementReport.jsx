"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const STATUS_LABEL = {
  PENDING_SUPERVISOR: "Supervisor review",
  PENDING_MANAGER: "Manager approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
const STATUS_COLOR = { APPROVED: PASS, PENDING_SUPERVISOR: "#C79A2B", PENDING_MANAGER: WAIT, REJECTED: FAIL };
const BAR_COLORS = ["#161310", "#946B00", "#2E7D46", "#3B82C4", "#7A5CCB", "#0E7C86", "#C2711C", "#B03A2E"];

const isoOf = (d) => d.toISOString().slice(0, 10);

function presetRange(key) {
  const now = new Date();
  const to = isoOf(now);
  const start = new Date(now);
  if (key === "week") start.setDate(now.getDate() - 7);
  else if (key === "month") start.setMonth(now.getMonth() - 1);
  else if (key === "quarter") start.setMonth(now.getMonth() - 3);
  else if (key === "year") start.setFullYear(now.getFullYear() - 1);
  else if (key === "all") return { from: "", to: "" };
  return { from: isoOf(start), to };
}

const PRESETS = [
  ["week", "7 days"],
  ["month", "30 days"],
  ["quarter", "Quarter"],
  ["year", "Year"],
  ["all", "All time"],
];

const fmtDay = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
};

export default function ManagementReport() {
  const [preset, setPreset] = useState("month");
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState(presetRange("month").from);
  const [to, setTo] = useState(presetRange("month").to);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [from, to]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    fetch(`/api/reports/summary?${qs}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return;
        if (!ok) throw new Error(d.error || "Could not load the report.");
        setData(d);
      })
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [qs]);

  const choose = (key) => {
    setPreset(key);
    setCustom(false);
    const r = presetRange(key);
    setFrom(r.from);
    setTo(r.to);
  };

  const rangeLabel = from || to ? `${fmtDay(from) || "start"} – ${fmtDay(to) || "today"}` : "All time";

  return (
    <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
      {/* Title + filter bar */}
      <section style={S.bar}>
        <div>
          <div style={S.eyebrow}>Analytics{data?.generatedByRole ? ` · ${data.generatedByRole}` : ""}</div>
          <h1 className="h1" style={{ marginTop: 2 }}>Maintenance Management Report</h1>
          <div style={{ fontSize: 12.5, color: MUTE, marginTop: 3 }}>
            {data ? `${data.total} report${data.total === 1 ? "" : "s"} · ` : ""}
            <b>{rangeLabel}</b>
            {data?.compareRange ? " · compared to previous period" : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <div style={S.segs}>
            {PRESETS.map(([key, label]) => (
              <button key={key} onClick={() => choose(key)} style={S.seg(!custom && preset === key)}>{label}</button>
            ))}
            <button onClick={() => setCustom(true)} style={S.seg(custom)}>Custom</button>
          </div>
          {custom && (
            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, color: MUTE }}>
              <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={{ padding: "6px 8px", fontSize: 12, width: "auto" }} />
              <span>to</span>
              <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={{ padding: "6px 8px", fontSize: 12, width: "auto" }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn" href={`/api/reports/summary/excel?${qs}`} style={{ ...S.btn, pointerEvents: loading ? "none" : "auto", opacity: loading ? 0.6 : 1 }}>⬇ Excel</a>
            <a className="btn" href={`/api/reports/summary/pdf?${qs}`} target="_blank" rel="noreferrer" style={{ ...S.btn, ...S.btnDark, pointerEvents: loading ? "none" : "auto", opacity: loading ? 0.6 : 1 }}>⬇ PDF report</a>
          </div>
        </div>
      </section>

      {err && <div className="err">{err}</div>}

      {loading && !data ? (
        <div className="muted">Building analytics…</div>
      ) : data ? (
        <Analytics data={data} loading={loading} />
      ) : null}
    </div>
  );
}

function Analytics({ data, loading }) {
  const d = data;
  const statusSegments = ["APPROVED", "PENDING_SUPERVISOR", "PENDING_MANAGER", "REJECTED"]
    .map((k) => ({ key: k, label: STATUS_LABEL[k], value: d.byStatus?.[k] || 0, color: STATUS_COLOR[k] }))
    .filter((s) => s.value > 0);

  const rank = (arr, key = "count", labelKey = "label") =>
    arr.slice(0, 6).map((r, i) => ({ label: r[labelKey] ?? r.name ?? r.id, value: r[key], color: BAR_COLORS[i % BAR_COLORS.length] }));

  return (
    <div style={{ display: "grid", gap: 16, opacity: loading ? 0.55 : 1, transition: "opacity .2s" }}>
      {/* Executive summary */}
      <section style={S.exec}>
        <div style={S.execGlow} aria-hidden />
        <div style={S.execTop}>
          <span style={S.execT}>Executive summary</span>
          <span style={S.execP}>Generated {fmtDay(d.generatedAt)}{d.generatedByName ? ` · ${d.generatedByName}` : ""}</span>
        </div>
        <div style={S.kpis}>
          <Kpi label="Reports filed" value={d.total} delta={d.deltas?.total} />
          <Kpi label="Approval rate" value={`${d.approvalRate}%`} valColor="#7fdca0" delta={d.deltas?.approvalRate} ctx={`${d.approved} approved`} />
          <Kpi label="Open findings" value={d.findingsCount} valColor="#f0a79c" delta={d.deltas?.findingsCount} ctx={`${d.findingsRate} / report`} />
          <Kpi label="Avg. approval time" value={d.avgTurnaroundHours != null ? `${d.avgTurnaroundHours}h` : "—"} delta={d.deltas?.avgTurnaroundHours} ctx="submit → sign-off" />
        </div>
      </section>

      {/* Insights */}
      {d.insights?.length ? (
        <section style={S.insights}>
          {d.insights.map((it, i) => (
            <div key={i} style={S.ins(it.kind)}>
              <div style={S.insH}>{it.kind === "good" ? "✓ " : it.kind === "bad" ? "⚠ " : "◆ "}{it.title}</div>
              <div style={S.insB}>{it.body}</div>
            </div>
          ))}
        </section>
      ) : null}

      {/* Status + trend */}
      <div style={S.grid2}>
        <Card title="Status distribution">
          {statusSegments.length ? <Donut segments={statusSegments} total={d.total} /> : <Empty />}
        </Card>
        <Card title="Submissions over time" note={d.compareRange ? "this period vs previous" : "daily"}>
          {d.trend?.length ? <TrendCompare points={d.trend} hasPrev={!!d.compareRange} /> : <Empty />}
        </Card>
      </div>

      {/* Breakdowns */}
      <div style={S.grid2b}>
        <Card title="By weighbridge" note={`top ${Math.min(6, d.byWeighbridge.length)} of ${d.byWeighbridge.length}`}>
          <Leaderboard items={rank(d.byWeighbridge)} total={d.total} />
        </Card>
        <Card title="By client & site" note={`${d.byClient.length} site${d.byClient.length === 1 ? "" : "s"}`}>
          <Leaderboard items={rank(d.byClient, "count", "name")} total={d.total} />
        </Card>
        <Card title="By report type" note={`${d.byTemplate.length} template${d.byTemplate.length === 1 ? "" : "s"}`}>
          <Leaderboard items={rank(d.byTemplate, "count", "name")} total={d.total} />
        </Card>
        <Card title="Filed by · top people" note={`${d.byAuthor.length} ${d.byAuthor.length === 1 ? "person" : "people"}`}>
          <Leaderboard items={rank(d.byAuthor, "count", "name")} total={d.total} />
        </Card>
      </div>

      {/* Health + common findings */}
      <div style={S.grid2}>
        <Card title="Equipment health">
          <HealthGauge passRate={d.passRate} passed={d.checklistPassed} total={d.checklistTotal} findings={d.findingsCount} />
        </Card>
        <Card title="Most common findings">
          {d.topFindings?.length ? (
            <Leaderboard items={d.topFindings.map((r, i) => ({ label: r.item, value: r.count, color: i < 2 ? FAIL : i < 4 ? "#C2711C" : WAIT }))} noShare />
          ) : (
            <div style={{ fontSize: 13, color: MUTE, fontStyle: "italic" }}>No items needed attention in this period. 🎉</div>
          )}
        </Card>
      </div>

      {/* Findings table */}
      <Card title="Flagged findings — needs attention" note={`${d.findingsCount} item${d.findingsCount === 1 ? "" : "s"} · newest first`}>
        {d.findings?.length ? (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 680, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ ...S.trow, ...S.thead }}>
                <span style={S.thcell}>Serial</span>
                <span style={S.thcell}>Item</span>
                <span style={S.thcell}>Result</span>
                <span style={S.thcell}>Remark</span>
                <span style={S.thcell}>WB / date</span>
              </div>
              {d.findings.slice(0, 40).map((f, i) => (
                <div key={i} style={{ ...S.trow, background: i % 2 ? "#FBF9F4" : "#fff", borderTop: "1px solid #EFEAdd" }}>
                  <Link href={`/reports/${f.serial}`} style={{ ...S.tcell, fontFamily: "var(--mono)", fontSize: 11, color: "#8a6d00", fontWeight: 700, textDecoration: "none" }}>{f.serial}</Link>
                  <span style={{ ...S.tcell, color: INK }}>{f.item}</span>
                  <span style={S.tcell}><span style={S.flag}>{(f.result || "NEEDS ATTENTION").toUpperCase()}</span></span>
                  <span style={{ ...S.tcell, color: INK }}>{f.remark || "—"}</span>
                  <span style={{ ...S.tcell, fontSize: 11, color: MUTE, fontFamily: "var(--mono)", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                    <span>{f.weighbridgeId || "—"}</span>
                    <span>{fmtDay(f.createdAt)}</span>
                  </span>
                </div>
              ))}
            </div>
            {d.findings.length > 40 ? <div style={{ fontSize: 12, color: MUTE, marginTop: 8 }}>Showing 40 of {d.findings.length} — the full list is in the PDF and Excel exports.</div> : null}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: MUTE, fontStyle: "italic" }}>No items needed attention in this period.</div>
        )}
      </Card>
    </div>
  );
}

/* ---------- presentational pieces ---------- */

function Kpi({ label, value, valColor, delta, ctx }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLab}>{label}</div>
      <div style={{ ...S.kpiVal, color: valColor || "#fff" }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, minHeight: 20, flexWrap: "wrap" }}>
        {delta ? <DeltaChip delta={delta} /> : null}
        {ctx ? <span style={S.kpiCtx}>{ctx}</span> : null}
      </div>
    </div>
  );
}

function DeltaChip({ delta }) {
  const t = delta.trend; // good | bad | flat
  const arrow = delta.diff > 0 ? "▲" : delta.diff < 0 ? "▼" : "■";
  const bg = t === "good" ? "rgba(46,125,70,.22)" : t === "bad" ? "rgba(176,58,46,.22)" : "rgba(255,255,255,.1)";
  const fg = t === "good" ? "#7fdca0" : t === "bad" ? "#f0a79c" : "#cdbd98";
  const txt = delta.diff === 0 ? "no change" : `${arrow} ${delta.abs}${delta.unit ? ` ${delta.unit}` : ""}`;
  return <span style={{ ...S.delta, background: bg, color: fg }}>{txt}</span>;
}

function Card({ title, note, children }) {
  return (
    <section style={S.card}>
      <div style={S.sec}>
        <span style={S.secTtl}><span style={S.secDot} />{title}</span>
        {note ? <span style={S.secNote}>{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Donut({ segments, total }) {
  const size = 150, thickness = 22, r = (size - thickness) / 2, cx = size / 2, circ = 2 * Math.PI * r;
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  let offset = 0;
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#F0EADD" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / sum) * circ;
          const el = (
            <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cx})`}>
              <title>{s.label}: {s.value}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x={cx} y={cx - 2} textAnchor="middle" style={{ fontSize: 28, fontWeight: 900, fill: INK }}>{total}</text>
        <text x={cx} y={cx + 15} textAnchor="middle" style={{ fontSize: 9, fill: MUTE, letterSpacing: ".08em" }}>REPORTS</text>
      </svg>
      <div style={{ display: "grid", gap: 9, flex: 1, minWidth: 130 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: INK }}>{s.label}</span>
            <b>{s.value}</b>
            <span style={{ color: MUTE, fontSize: 11.5, width: 38, textAlign: "right" }}>{Math.round((s.value / sum) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendCompare({ points, hasPrev }) {
  const w = 560, h = 150, pad = 6;
  const max = Math.max(1, ...points.map((p) => Math.max(p.count, p.prev || 0)));
  const n = points.length;
  const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
  const y = (v) => h - pad - (v / max) * (h - 2 * pad - 12);
  const path = (key) => points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p[key] || 0).toFixed(1)}`).join(" ");
  const line = path("count");
  const area = `${line} L ${x(n - 1).toFixed(1)} ${h - pad} L ${x(0).toFixed(1)} ${h - pad} Z`;
  const total = points.reduce((a, p) => a + p.count, 0);
  let peak = points[0] || { count: 0, date: "" };
  for (const p of points) if (p.count > peak.count) peak = p;
  return (
    <div>
      {hasPrev ? (
        <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: MUTE, fontWeight: 700, marginBottom: 6 }}>
          <span><i style={{ display: "inline-block", width: 14, height: 3, borderRadius: 2, background: GOLD, verticalAlign: "middle", marginRight: 5 }} />This period</span>
          <span><i style={{ display: "inline-block", width: 14, height: 3, borderRadius: 2, background: "#C9BFA8", verticalAlign: "middle", marginRight: 5 }} />Previous</span>
        </div>
      ) : null}
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="qsl-tr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.32" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[40, 80, 120].map((gy) => <line key={gy} x1={pad} y1={gy} x2={w - pad} y2={gy} stroke="#F0EADD" strokeWidth="1" />)}
        {hasPrev ? <path d={path("prev")} fill="none" stroke="#C9BFA8" strokeWidth={2} strokeDasharray="4 4" strokeLinejoin="round" /> : null}
        <path d={area} fill="url(#qsl-tr)" />
        <path d={line} fill="none" stroke={GOLD} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.count)} r={p.count ? 2.4 : 0} fill={GOLD}><title>{p.date}: {p.count}</title></circle>)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: MUTE, marginTop: 4, fontFamily: "var(--mono)" }}>
        <span>{fmtDay(points[0]?.date)}</span>
        <span>{total} submissions · peak {peak.count} on {fmtDay(peak.date)}</span>
        <span>{fmtDay(points[points.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function Leaderboard({ items, total, noShare }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0));
  if (!items.length) return <Empty />;
  return (
    <div style={{ display: "grid", gap: 11 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#b6ab93", fontFamily: "var(--mono)", textAlign: "center" }}>{i + 1}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, marginBottom: 4 }}>
              <span style={{ color: INK, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
              <b style={{ flexShrink: 0 }}>{it.value}</b>
            </div>
            <div style={{ height: 7, background: "#F0EADD", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(3, (it.value / max) * 100)}%`, height: "100%", background: it.color, borderRadius: 5 }} />
            </div>
          </div>
          {!noShare && total ? (
            <span style={{ fontSize: 11, color: MUTE, fontWeight: 700, width: 34, textAlign: "right" }}>{Math.round((it.value / total) * 100)}%</span>
          ) : (
            <span style={{ width: noShare ? 0 : 34 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function HealthGauge({ passRate, passed, total, findings }) {
  if (passRate == null) return <div style={{ fontSize: 13, color: MUTE, fontStyle: "italic" }}>No checklist items recorded in this period.</div>;
  const frac = Math.max(0, Math.min(1, passRate / 100));
  const R = 82, cx = 100, cy = 100;
  const a0 = Math.PI, a1 = Math.PI * (1 - frac);
  const pt = (a) => `${(cx + R * Math.cos(a)).toFixed(1)} ${(cy - R * Math.sin(a)).toFixed(1)}`;
  const color = frac >= 0.9 ? PASS : frac >= 0.75 ? "#5C8A2E" : frac >= 0.5 ? WAIT : FAIL;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 4 }}>
      <svg width={200} height={116} viewBox="0 0 200 116">
        <path d={`M ${pt(Math.PI)} A ${R} ${R} 0 0 1 ${pt(0)}`} fill="none" stroke="#F0EADD" strokeWidth={15} strokeLinecap="round" />
        <path d={`M ${pt(a0)} A ${R} ${R} 0 0 1 ${pt(a1)}`} fill="none" stroke={color} strokeWidth={15} strokeLinecap="round" />
        <text x={cx} y={90} textAnchor="middle" style={{ fontSize: 36, fontWeight: 900, fill: INK }}>{passRate}%</text>
        <text x={cx} y={108} textAnchor="middle" style={{ fontSize: 10, fill: MUTE }}>checks passed</text>
      </svg>
      <div style={{ fontSize: 12, color: MUTE, maxWidth: 220 }}>
        {passed.toLocaleString()} of {total.toLocaleString()} checklist items passed. <b>{findings}</b> flagged across the period.
      </div>
    </div>
  );
}

function Empty() {
  return <div style={{ fontSize: 13, color: MUTE, fontStyle: "italic", padding: "10px 0" }}>No data in this period.</div>;
}

/* ---------- styles ---------- */
const S = {
  bar: { background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px", display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8a6d00" },
  segs: { display: "flex", gap: 4, background: "#F3EFE6", border: "1px solid var(--line)", borderRadius: 10, padding: 4, flexWrap: "wrap" },
  seg: (on) => ({ fontSize: 12, fontWeight: 800, color: on ? GOLD : MUTE, padding: "6px 12px", borderRadius: 7, border: "none", background: on ? COAL : "transparent" }),
  btn: { border: "1px solid var(--line)", background: "#fff", color: INK, fontWeight: 800, padding: "9px 14px", borderRadius: 9, fontSize: 12.5, textDecoration: "none" },
  btnDark: { background: COAL, color: GOLD, borderColor: COAL },

  exec: { background: "linear-gradient(135deg,#1c1813 0%,#161310 60%,#221c12 100%)", borderRadius: 16, padding: "22px 22px 20px", color: "#fff", position: "relative", overflow: "hidden" },
  execGlow: { position: "absolute", right: -40, top: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,168,0,.16),transparent 70%)", pointerEvents: "none" },
  execTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, position: "relative", flexWrap: "wrap", gap: 6 },
  execT: { fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#cdbd98" },
  execP: { fontSize: 12, color: "#9b9280", fontFamily: "var(--mono)" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, position: "relative" },
  kpi: { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 12, padding: "15px 16px" },
  kpiLab: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#a89e88" },
  kpiVal: { fontSize: 34, fontWeight: 900, lineHeight: 1.05, marginTop: 7, letterSpacing: "-.02em" },
  kpiCtx: { fontSize: 11, color: "#8f8672" },
  delta: { fontSize: 11.5, fontWeight: 900, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" },

  insights: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 },
  ins: (k) => ({ background: "#fff", border: "1px solid var(--line)", borderLeft: `4px solid ${k === "good" ? PASS : k === "bad" ? FAIL : GOLD}`, borderRadius: 12, padding: "13px 15px" }),
  insH: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: MUTE },
  insB: { fontSize: 13.5, marginTop: 6, lineHeight: 1.4, color: INK },

  card: { background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 18 },
  sec: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8, flexWrap: "wrap" },
  secTtl: { fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".04em", display: "flex", gap: 9, alignItems: "center", color: INK },
  secDot: { width: 10, height: 10, background: GOLD, borderRadius: 3, flexShrink: 0 },
  secNote: { fontSize: 11, color: MUTE, fontWeight: 700 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 },
  grid2b: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 },

  trow: { display: "grid", gridTemplateColumns: "120px 1.5fr 130px 1.3fr 100px" },
  thead: { background: COAL, color: "#fff" },
  thcell: { padding: "9px 12px", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em", display: "flex", alignItems: "center" },
  tcell: { padding: "9px 12px", display: "flex", alignItems: "center", fontSize: 12.5 },
  flag: { fontSize: 10.5, fontWeight: 900, color: "#fff", background: FAIL, padding: "3px 8px", borderRadius: 5, letterSpacing: ".03em" },
};
