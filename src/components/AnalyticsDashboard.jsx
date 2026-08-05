"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, COAL, INK, MUTE, PASS } from "@/lib/theme";

const RANGES = [
  ["7", "7 days"],
  ["30", "30 days"],
  ["90", "90 days"],
  ["365", "Year"],
];
const BAR_COLORS = ["#161310", "#946B00", "#2E7D46", "#3B82C4", "#7A5CCB", "#0E7C86", "#C2711C", "#B03A2E"];

const fmtDay = (iso) => {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); } catch { return iso; }
};

export default function AnalyticsDashboard() {
  const [days, setDays] = useState("30");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`/api/track/summary?days=${days}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load analytics.");
      setData(d);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals;

  return (
    <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
      <section style={S.bar}>
        <div>
          <div style={S.eyebrow}>Analytics · Administrator</div>
          <h1 className="h1" style={{ marginTop: 2 }}>System usage</h1>
          <div style={{ fontSize: 12.5, color: MUTE, marginTop: 3 }}>Visits, visitors and clicks across the platform — last {days} days.</div>
        </div>
        <div style={S.segs}>
          {RANGES.map(([k, label]) => (
            <button key={k} onClick={() => setDays(k)} style={S.seg(days === k)}>{label}</button>
          ))}
          <button onClick={load} style={{ ...S.seg(false), marginLeft: 4 }} title="Refresh">⟳</button>
        </div>
      </section>

      {err && <div className="err">{err}</div>}
      {loading && !data ? <div className="muted">Loading analytics…</div> : data ? (
        <>
          <section style={S.kpis}>
            <Kpi label="Page views" value={t.views} sub={`${t.viewsToday} today`} />
            <Kpi label="Unique visitors" value={t.visitors} sub={`${t.visitorsToday} today`} color={PASS} />
            <Kpi label="Clicks tracked" value={t.clicks} sub={t.views ? `${(t.clicks / Math.max(1, t.views)).toFixed(1)} / view` : "—"} />
            <Kpi label="Signed-in users" value={t.signedInVisitors} sub="active in range" />
          </section>

          <Card title="Visits over time" note="page views · unique visitors">
            {data.trend?.length ? <Trend points={data.trend} /> : <Empty />}
          </Card>

          <div style={S.grid2}>
            <Card title="Top pages" note={`${data.topPages.length}`}>
              <Bars items={data.topPages.map((r, i) => ({ label: r.name, value: r.count, color: BAR_COLORS[i % BAR_COLORS.length] }))} />
            </Card>
            <Card title="Most-clicked" note={`${data.topClicks.length}`}>
              <Bars items={data.topClicks.map((r, i) => ({ label: r.name, value: r.count, color: BAR_COLORS[i % BAR_COLORS.length] }))} />
            </Card>
          </div>

          <div style={S.grid2}>
            <Card title="Devices" note="page views by device">
              <Bars items={data.devices.map((r, i) => ({ label: cap(r.name), value: r.count, color: BAR_COLORS[i % BAR_COLORS.length] }))} />
            </Card>
            <Card title="By role" note="signed-in views">
              {data.byRole?.length ? <Bars items={data.byRole.map((r, i) => ({ label: roleLabel(r.name), value: r.count, color: BAR_COLORS[i % BAR_COLORS.length] }))} /> : <Empty note="No signed-in activity yet." />}
            </Card>
          </div>

          {data.referrers?.length ? (
            <Card title="Referrers" note="where external visits came from">
              <Bars items={data.referrers.map((r, i) => ({ label: r.name, value: r.count, color: BAR_COLORS[i % BAR_COLORS.length] }))} />
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const roleLabel = (r) => String(r || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function Kpi({ label, value, sub, color }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLab}>{label}</div>
      <div style={{ ...S.kpiVal, color: color || INK }}>{value ?? 0}</div>
      {sub ? <div style={S.kpiSub}>{sub}</div> : null}
    </div>
  );
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

function Bars({ items }) {
  if (!items?.length) return <Empty />;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{it.label}</div>
            <div style={{ height: 7, background: "#F0EADD", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(3, (it.value / max) * 100)}%`, height: "100%", background: it.color, borderRadius: 5 }} />
            </div>
          </div>
          <b style={{ fontSize: 13, alignSelf: "center" }}>{it.value}</b>
        </div>
      ))}
    </div>
  );
}

function Trend({ points }) {
  const w = 720, h = 170, pad = 8;
  const max = Math.max(1, ...points.map((p) => Math.max(p.views, p.visitors)));
  const n = points.length;
  const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
  const y = (v) => h - pad - (v / max) * (h - 2 * pad - 12);
  const line = (key) => points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const area = `${line("views")} L ${x(n - 1).toFixed(1)} ${h - pad} L ${x(0).toFixed(1)} ${h - pad} Z`;
  const totalViews = points.reduce((a, p) => a + p.views, 0);
  return (
    <div>
      <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: MUTE, fontWeight: 700, marginBottom: 6 }}>
        <span><i style={{ display: "inline-block", width: 14, height: 3, borderRadius: 2, background: GOLD, verticalAlign: "middle", marginRight: 5 }} />Page views</span>
        <span><i style={{ display: "inline-block", width: 14, height: 3, borderRadius: 2, background: PASS, verticalAlign: "middle", marginRight: 5 }} />Unique visitors</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="qsl-an" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.28" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[40, 80, 120].map((gy) => <line key={gy} x1={pad} y1={gy} x2={w - pad} y2={gy} stroke="#F0EADD" strokeWidth="1" />)}
        <path d={area} fill="url(#qsl-an)" />
        <path d={line("views")} fill="none" stroke={GOLD} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        <path d={line("visitors")} fill="none" stroke={PASS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 3" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: MUTE, marginTop: 4, fontFamily: "var(--mono)" }}>
        <span>{fmtDay(points[0]?.date)}</span>
        <span>{totalViews} views in range</span>
        <span>{fmtDay(points[points.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function Empty({ note }) {
  return <div style={{ fontSize: 13, color: MUTE, fontStyle: "italic", padding: "8px 0" }}>{note || "No data in this period."}</div>;
}

const S = {
  bar: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 16 },
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: GOLD },
  segs: { display: "inline-flex", gap: 4, background: "#F3EFE6", padding: 4, borderRadius: 10, flexWrap: "wrap" },
  seg: (on) => ({ border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 11px", borderRadius: 7, background: on ? COAL : "transparent", color: on ? "#fff" : INK }),
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 },
  kpi: { background: COAL, borderRadius: 12, padding: "14px 16px" },
  kpiLab: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#b6ab93" },
  kpiVal: { fontSize: 28, fontWeight: 900, color: "#fff", marginTop: 4, lineHeight: 1 },
  kpiSub: { fontSize: 11.5, color: "#cdbd98", marginTop: 6 },
  card: { background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 16, boxShadow: "0 6px 18px rgba(90,80,60,.05)" },
  sec: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  secTtl: { display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 14, color: INK },
  secDot: { width: 10, height: 10, background: GOLD, borderRadius: 3 },
  secNote: { fontSize: 11.5, color: MUTE },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 },
};
