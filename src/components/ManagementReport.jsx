"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";
import { itemizeReport } from "@/lib/reportItemize";

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

const relTime = (ts) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
};

// Deep-link into the report registry (which lives at /dashboard and reads
// ?status=, ?template= and ?q=) so every chart drills through to its rows.
const registryHref = ({ status, template, q } = {}) => {
  const p = new URLSearchParams();
  if (status) p.set("status", status);
  if (template) p.set("template", template);
  if (q) p.set("q", q);
  const s = p.toString();
  return `/dashboard${s ? `?${s}` : ""}`;
};

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
  const [client, setClient] = useState("");
  const [site, setSite] = useState("");
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [err, setErr] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (client) p.set("client", client);
    if (client && site) p.set("site", site);
    return p.toString();
  }, [from, to, client, site]);

  // Load the report. `silent` keeps the current view on screen while a background
  // refresh runs, so the dashboard autopopulates without flashing or scrolling.
  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setErr("");
      try {
        const r = await fetch(`/api/reports/summary?${qs}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load the report.");
        setData(d);
        setUpdatedAt(Date.now());
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [qs]
  );

  // Initial + on filter change.
  useEffect(() => {
    load(false);
  }, [load]);

  // Live: poll every 60s, and refresh the moment the tab regains focus, so new
  // reports, approvals and findings appear on their own.
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && load(true);
    const id = setInterval(tick, 60000);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

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
      <style>{`@keyframes qslPulse{0%{box-shadow:0 0 0 0 rgba(46,125,70,.5)}70%{box-shadow:0 0 0 6px rgba(46,125,70,0)}100%{box-shadow:0 0 0 0 rgba(46,125,70,0)}}.qsl-lb-row{transition:background .12s}.qsl-lb-row:hover{background:#FAF7EE!important}`}</style>
      {/* Title + filter bar */}
      <section style={S.bar}>
        <div>
          <div style={S.eyebrow}>Analytics{data?.generatedByRole ? ` · ${data.generatedByRole}` : ""}</div>
          <h1 className="h1" style={{ marginTop: 2 }}>Maintenance Management Report</h1>
          <div style={{ fontSize: 12.5, color: MUTE, marginTop: 3 }}>
            {data ? `${data.total} report${data.total === 1 ? "" : "s"} · ` : ""}
            <b>{rangeLabel}</b>
            {data?.clientLabel ? <> · <b style={{ color: "#8a6d00" }}>{data.clientLabel}{data?.siteLabel ? ` — ${data.siteLabel}` : ""}</b></> : ""}
            {data?.compareRange ? " · compared to previous period" : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {data?.clientOptions?.length ? (
              <select className="input" value={client} onChange={(e) => { setClient(e.target.value); setSite(""); }} style={{ padding: "7px 10px", fontSize: 12.5, fontWeight: 700, width: "auto", maxWidth: 220 }}>
                <option value="">All clients</option>
                {data.clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : null}
            {client && data?.siteOptions?.length ? (
              <select className="input" value={site} onChange={(e) => setSite(e.target.value)} title="Filter to one branch / site" style={{ padding: "7px 10px", fontSize: 12.5, fontWeight: 700, width: "auto", maxWidth: 200 }}>
                <option value="">All branches</option>
                {data.siteOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : null}
            <div style={S.segs}>
              {PRESETS.map(([key, label]) => (
                <button key={key} onClick={() => choose(key)} style={S.seg(!custom && preset === key)}>{label}</button>
              ))}
              <button onClick={() => setCustom(true)} style={S.seg(custom)}>Custom</button>
            </div>
          </div>
          {custom && (
            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, color: MUTE }}>
              <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={{ padding: "6px 8px", fontSize: 12, width: "auto" }} />
              <span>to</span>
              <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={{ padding: "6px 8px", fontSize: 12, width: "auto" }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={() => load(true)} title="Refresh now" style={S.live} disabled={refreshing}>
              <span style={{ ...S.liveDot, animation: refreshing ? "none" : undefined, background: refreshing ? WAIT : PASS }} />
              {refreshing ? "Updating…" : updatedAt ? `Live · ${relTime(updatedAt)}` : "Live"}
              <span style={{ marginLeft: 2, fontSize: 13 }}>⟳</span>
            </button>
            <a className="btn" href={`/api/reports/summary/excel?${qs}`} style={{ ...S.btn, pointerEvents: loading ? "none" : "auto", opacity: loading ? 0.6 : 1 }}>⬇ Excel</a>
            <a className="btn" href={`/api/reports/summary/pdf?${qs}`} target="_blank" rel="noreferrer" style={{ ...S.btn, ...S.btnDark, pointerEvents: loading ? "none" : "auto", opacity: loading ? 0.6 : 1 }}>⬇ PDF report</a>
          </div>
        </div>
      </section>

      {/* Report tabs */}
      {data ? (
        <div style={S.tabs}>
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={S.tab(tab === key)}>{label}</button>
          ))}
        </div>
      ) : null}

      {err && <div className="err">{err}</div>}

      {loading && !data ? (
        <div className="muted">Building analytics…</div>
      ) : data ? (
        <div style={{ opacity: loading && tab !== "overview" ? 0.55 : 1, transition: "opacity .2s" }}>
          {tab === "overview" && <Analytics data={data} loading={loading} />}
          {tab === "staff" && <StaffReport data={data} />}
          {tab === "weighbridges" && <WeighbridgeReport data={data} />}
          {tab === "clients" && <ClientReport data={data} qs={qs} />}
          {tab === "compliance" && <ComplianceReport data={data} />}
        </div>
      ) : null}
    </div>
  );
}

const TABS = [
  ["overview", "Overview"],
  ["staff", "Staff productivity"],
  ["weighbridges", "Weighbridge history"],
  ["clients", "Client statements"],
  ["compliance", "Compliance"],
];

function Analytics({ data, loading }) {
  const d = data;
  const statusSegments = ["APPROVED", "PENDING_SUPERVISOR", "PENDING_MANAGER", "REJECTED"]
    .map((k) => ({ key: k, label: STATUS_LABEL[k], value: d.byStatus?.[k] || 0, color: STATUS_COLOR[k] }))
    .filter((s) => s.value > 0);

  const rank = (arr, key = "count", labelKey = "label", hrefFor) =>
    arr.slice(0, 6).map((r, i) => ({ label: r[labelKey] ?? r.name ?? r.id, value: r[key], color: BAR_COLORS[i % BAR_COLORS.length], href: hrefFor ? hrefFor(r) : undefined }));

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

      {/* Operations pulse — system-wide secondary KPIs */}
      {d.operations ? <OpsPulse ops={d.operations} /> : null}

      {/* Platform usage — everything the app captured this period */}
      {d.usage ? <UsageStrip usage={d.usage} /> : null}

      {/* Status + trend */}
      <div style={S.grid2}>
        <Card title="Status distribution">
          {statusSegments.length ? <Donut segments={statusSegments} total={d.total} /> : <Empty />}
        </Card>
        <Card title="Submissions over time" note={d.compareRange ? "this period vs previous" : "daily"}>
          {d.trend?.length ? <TrendCompare points={d.trend} hasPrev={!!d.compareRange} /> : <Empty />}
        </Card>
      </div>

      {/* Breakdowns — every row drills through to its filtered reports */}
      <div style={S.grid2b}>
        <Card title="By weighbridge" note={`top ${Math.min(6, d.byWeighbridge.length)} of ${d.byWeighbridge.length}`}>
          <Leaderboard items={rank(d.byWeighbridge, "count", "label", (r) => registryHref({ q: r.label }))} total={d.total} />
        </Card>
        <Card title="By client & site" note={`${d.byClient.length} site${d.byClient.length === 1 ? "" : "s"}`}>
          <Leaderboard items={rank(d.byClient, "count", "name", (r) => registryHref({ q: String(r.name).split(" — ")[0] }))} total={d.total} />
        </Card>
        <Card title="By report type" note={`${d.byTemplate.length} template${d.byTemplate.length === 1 ? "" : "s"}`}>
          <Leaderboard items={rank(d.byTemplate, "count", "name", (r) => registryHref({ template: r.code }))} total={d.total} />
        </Card>
        <Card title="Filed by · top people" note={`${d.byAuthor.length} ${d.byAuthor.length === 1 ? "person" : "people"}`}>
          <Leaderboard items={rank(d.byAuthor, "count", "name", (r) => registryHref({ q: r.name }))} total={d.total} />
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

      {/* Service register — the detailed, itemised log of every report filed */}
      {d.register?.length ? <ServiceRegister rows={d.register} /> : null}

      {/* Across the business — the wider operational picture */}
      {d.operations ? <OperationsRegion ops={d.operations} /> : null}

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
                <span style={S.thcell}>Client · WB · date</span>
              </div>
              {d.findings.slice(0, 40).map((f, i) => (
                <div key={i} style={{ ...S.trow, background: i % 2 ? "#FBF9F4" : "#fff", borderTop: "1px solid #EFEAdd" }}>
                  <Link href={`/reports/${f.serial}`} style={{ ...S.tcell, fontFamily: "var(--mono)", fontSize: 11, color: "#8a6d00", fontWeight: 700, textDecoration: "none" }}>{f.serial}</Link>
                  <span style={{ ...S.tcell, color: INK }}>{f.item}</span>
                  <span style={S.tcell}><span style={S.flag}>{(f.result || "NO").toUpperCase()}</span></span>
                  <span style={{ ...S.tcell, color: INK }}>{f.remark || "—"}</span>
                  <span style={{ ...S.tcell, fontSize: 11, color: MUTE, fontFamily: "var(--mono)", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                    <span style={{ color: INK, fontFamily: "inherit", fontWeight: 600 }}>{f.clientName || "—"}{f.site ? ` · ${f.site}` : ""}</span>
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
        {segments.map((s, i) => {
          const href = s.key ? registryHref({ status: s.key }) : null;
          const Row = href ? Link : "div";
          const rp = href ? { href, title: `View ${s.label} reports`, className: "qsl-lb-row" } : {};
          return (
            <Row key={i} {...rp} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, textDecoration: "none", color: "inherit", borderRadius: 6 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, color: INK }}>{s.label}{href ? <span style={{ color: "#c3b58f", marginLeft: 5 }}>›</span> : null}</span>
              <b>{s.value}</b>
              <span style={{ color: MUTE, fontSize: 11.5, width: 38, textAlign: "right" }}>{Math.round((s.value / sum) * 100)}%</span>
            </Row>
          );
        })}
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
      {items.map((it, i) => {
        const Row = it.href ? Link : "div";
        const rowProps = it.href ? { href: it.href, title: `View ${it.label} reports`, className: "qsl-lb-row" } : {};
        return (
          <Row key={i} {...rowProps} style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center", textDecoration: "none", color: "inherit", borderRadius: 6, padding: "1px 0" }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: "#b6ab93", fontFamily: "var(--mono)", textAlign: "center" }}>{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ color: INK, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}{it.href ? <span style={{ color: "#c3b58f", marginLeft: 5 }}>›</span> : null}</span>
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
          </Row>
        );
      })}
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

/* ---------- report tabs (staff / weighbridge / client / compliance) ---------- */

function Table({ cols, rows }) {
  const grid = cols.map((c) => (c.w ? `${c.w}px` : "minmax(120px,1fr)")).join(" ");
  const min = cols.reduce((a, c) => a + (c.w || 140), 0);
  const just = (a) => (a === "center" ? "center" : a === "right" ? "flex-end" : "flex-start");
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: min, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: grid, background: COAL, color: "#fff" }}>
          {cols.map((c, i) => <span key={i} style={{ ...S.thcell, justifyContent: just(c.align) }}>{c.label}</span>)}
        </div>
        {rows.map((r, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: grid, background: ri % 2 ? "#FBF9F4" : "#fff", borderTop: "1px solid #EFEAdd" }}>
            {cols.map((c, ci) => (
              <span key={ci} style={{ ...S.rcell, justifyContent: just(c.align), color: INK, ...(c.cellStyle ? c.cellStyle(r) : {}) }}>
                {c.render ? c.render(r) : r[c.key]}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatLine({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 13, borderBottom: "1px dashed var(--line)", paddingBottom: 7 }}>
      <span style={{ color: MUTE }}>{label}</span>
      <b style={{ fontSize: 15 }}>{value}</b>
    </div>
  );
}

function StaffReport({ data }) {
  const rows = data.staff || [];
  return (
    <Card title="Staff productivity" note={`${rows.length} ${rows.length === 1 ? "person" : "people"} · reports filed & approvals given`}>
      {rows.length ? (
        <Table
          rows={rows}
          cols={[
            { label: "Person", render: (r) => <Link href={registryHref({ q: r.name })} style={{ color: INK, fontWeight: 600, textDecoration: "none" }}>{r.name}</Link> },
            { label: "Filed", w: 70, align: "center", cellStyle: () => ({ fontWeight: 800 }), key: "filed" },
            { label: "Approvals", w: 92, align: "center", key: "approvals" },
            { label: "Rejections", w: 92, align: "center", key: "rejections" },
            { label: "Findings", w: 82, align: "center", render: (r) => r.findings || "—", cellStyle: (r) => ({ color: r.findings ? FAIL : MUTE }) },
            { label: "Photos", w: 72, align: "center", key: "photos" },
            { label: "Avg approval", w: 104, align: "center", render: (r) => (r.avgTurnaround != null ? `${r.avgTurnaround}h` : "—") },
          ]}
        />
      ) : <Empty />}
    </Card>
  );
}

function WeighbridgeReport({ data }) {
  const rows = data.weighbridgeHistory || [];
  return (
    <Card title="Weighbridge history" note={`${rows.length} weighbridge${rows.length === 1 ? "" : "s"} serviced · click one for its reports`}>
      {rows.length ? (
        <Table
          rows={rows}
          cols={[
            { label: "Weighbridge", w: 122, render: (r) => <Link href={registryHref({ q: r.id })} style={{ color: "#8a6d00", fontWeight: 700, fontFamily: "var(--mono)", fontSize: 11, textDecoration: "none" }}>{r.id}</Link> },
            { label: "Client / site", render: (r) => (r.site ? `${r.clientName} — ${r.site}` : r.clientName) },
            { label: "Reports", w: 76, align: "center", cellStyle: () => ({ fontWeight: 800 }), key: "reports" },
            { label: "Approved", w: 84, align: "center", key: "approved" },
            { label: "Pending", w: 76, align: "center", key: "pending" },
            { label: "Findings", w: 82, align: "center", render: (r) => r.findings || "—", cellStyle: (r) => ({ color: r.findings ? FAIL : MUTE, fontWeight: r.findings ? 800 : 400 }) },
            { label: "Last service", w: 100, align: "center", render: (r) => fmtDay(r.lastDate) },
            { label: "Top service", render: (r) => r.services[0]?.name || "—" },
          ]}
        />
      ) : <Empty />}
    </Card>
  );
}

function SiteBreakdown({ register, total }) {
  const map = new Map();
  for (const r of register || []) {
    const key = r.site || "(no site)";
    const e = map.get(key) || { site: key, count: 0, findings: 0 };
    e.count += 1;
    e.findings += r.findings || 0;
    map.set(key, e);
  }
  const rows = [...map.values()].sort((a, b) => b.count - a.count);
  if (!rows.length) return <Empty />;
  const items = rows.map((r, i) => ({ label: r.findings ? `${r.site} · ${r.findings} finding${r.findings === 1 ? "" : "s"}` : r.site, value: r.count, color: BAR_COLORS[i % BAR_COLORS.length] }));
  return <Leaderboard items={items} total={total} />;
}

function ClientReport({ data, qs }) {
  const rows = data.clients || [];
  const detail = data.clientLabel ? rows[0] : null;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Month-end statement call-to-action */}
      <div style={S.stmtBar}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14, color: INK }}>Monthly service statement</div>
          <div style={{ fontSize: 12.5, color: MUTE, marginTop: 2 }}>
            {data.clientLabel
              ? <>A client-facing statement of everything delivered for <b style={{ color: "#8a6d00" }}>{data.clientLabel}{data.siteLabel ? ` — ${data.siteLabel}` : ""}</b> this period — for month-end usage invoicing.{data.siteLabel ? "" : " Choose a branch above for a per-branch statement."}</>
              : "Pick a client above (and a month range), then generate their branded statement to hand over at month-end."}
          </div>
        </div>
        <a
          className="btn"
          href={data.clientLabel ? `/api/reports/statement/pdf?${qs}` : undefined}
          target="_blank"
          rel="noreferrer"
          style={{ ...S.btn, ...S.btnDark, whiteSpace: "nowrap", pointerEvents: data.clientLabel ? "auto" : "none", opacity: data.clientLabel ? 1 : 0.5 }}
        >
          ⬇ Download statement (PDF)
        </a>
      </div>

      <Card
        title={data.clientLabel ? `Account statement · ${data.clientLabel}` : "Client account statements"}
        note={data.clientLabel ? "showing one client — choose 'All clients' above to compare" : `${rows.length} client${rows.length === 1 ? "" : "s"} · pick one above for its full statement`}
      >
        {rows.length ? (
          <Table
            rows={rows}
            cols={[
              { label: "Client", render: (r) => <Link href={registryHref({ q: r.name })} style={{ color: INK, fontWeight: 600, textDecoration: "none" }}>{r.name}</Link> },
              { label: "Reports", w: 76, align: "center", cellStyle: () => ({ fontWeight: 800 }), key: "reports" },
              { label: "Services", w: 82, align: "center", render: (r) => r.services.length },
              { label: "Sites", w: 62, align: "center", key: "sites" },
              { label: "WBs", w: 60, align: "center", key: "weighbridges" },
              { label: "Findings", w: 82, align: "center", render: (r) => r.findings || "—", cellStyle: (r) => ({ color: r.findings ? FAIL : MUTE }) },
              { label: "Approved", w: 84, align: "center", key: "approved" },
              { label: "Pending", w: 76, align: "center", key: "pending" },
              { label: "Last activity", w: 104, align: "center", render: (r) => fmtDay(r.lastDate) },
            ]}
          />
        ) : <Empty />}
      </Card>

      {detail ? (
        <div style={S.grid2}>
          <Card title="By site" note="reports per location">
            <SiteBreakdown register={data.register} total={data.total} />
          </Card>
          <Card title="Services delivered">
            {data.servicesDelivered?.length ? (
              <Leaderboard items={data.servicesDelivered.map((s, i) => ({ label: s.name, value: s.count, color: BAR_COLORS[i % BAR_COLORS.length] }))} total={data.total} />
            ) : <Empty />}
          </Card>
          <Card title="Account activity">
            <div style={{ display: "grid", gap: 9 }}>
              <StatLine label="Reports delivered" value={data.total} />
              <StatLine label="Findings raised" value={data.findingsCount} />
              <StatLine label="Checklist items completed" value={(data.usage?.checklistItems || 0).toLocaleString()} />
              <StatLine label="Photos captured" value={(data.usage?.photos || 0).toLocaleString()} />
              <StatLine label="Calibration requests" value={data.operations?.crf?.total ?? "—"} />
              <StatLine label="Quotations" value={data.operations?.quotes?.total ?? "—"} />
              <StatLine label="Weighbridges serviced" value={detail.weighbridges} />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function ComplianceReport({ data }) {
  const c = data.compliance || {};
  const tone = (v, good = 90, ok = 75) => (v == null ? INK : v >= good ? PASS : v >= ok ? "#5C8A2E" : v >= 50 ? WAIT : FAIL);
  const tiles = [
    { label: "Checklist pass rate", value: c.checklistPassRate != null ? `${c.checklistPassRate}%` : "—", color: tone(c.checklistPassRate) },
    { label: "Schedule adherence", value: c.scheduleAdherence != null ? `${c.scheduleAdherence}%` : "—", color: tone(c.scheduleAdherence) },
    { label: "Approval rate", value: `${c.approvalRate}%`, color: tone(c.approvalRate, 70, 50) },
    { label: "Avg approval time", value: c.avgTurnaroundHours != null ? `${c.avgTurnaroundHours}h` : "—", color: INK },
    { label: "Overdue maintenance", value: c.schedulesOverdue ?? "—", color: c.schedulesOverdue ? FAIL : PASS },
    { label: "Contracts overdue", value: c.contractsOverdue ?? "—", color: c.contractsOverdue ? FAIL : PASS },
  ];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={S.pulse}>
        {tiles.map((t, i) => (
          <div key={i} style={S.pulseTile}>
            <div style={S.pulseLab}>{t.label}</div>
            <div style={{ ...S.pulseVal, color: t.color }}>{t.value}</div>
          </div>
        ))}
      </section>
      <div style={S.grid2}>
        <Card title="Overdue maintenance" note={`${c.schedulesOverdue || 0} overdue · ${c.schedulesDueSoon || 0} due this week`}>
          {c.scheduleOverdueList?.length ? <DueList items={c.scheduleOverdueList} allOverdue /> : <div style={okStyle}>No overdue maintenance. 🎉</div>}
        </Card>
        <Card title="Service contracts — upcoming" note={`${c.contractsOverdue || 0} overdue · ${c.contractsDueSoon || 0} within 30 days`}>
          {c.contractUpcomingList?.length ? <DueList items={c.contractUpcomingList} /> : <div style={okStyle}>No services due soon.</div>}
        </Card>
      </div>
      <Card title="Report outcomes & quality" note="this period">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          <div style={{ display: "grid", gap: 9 }}>
            <StatLine label="Approved" value={c.reportsApproved} />
            <StatLine label="Pending" value={c.reportsPending} />
            <StatLine label="Rejected / returned" value={c.reportsRejected} />
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            <StatLine label="Checklist items passed" value={`${(c.checklistPassed || 0).toLocaleString()} / ${(c.checklistItems || 0).toLocaleString()}`} />
            <StatLine label="Open findings" value={c.findingsOpen} />
            <StatLine label="Rejection rate" value={`${c.rejectionRate || 0}%`} />
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---------- operations (system-wide) ---------- */

const okStyle = { fontSize: 13, color: MUTE, fontStyle: "italic" };
const CRF_COLOR = { SUBMITTED: WAIT, ACCEPTED: PASS, REJECTED: FAIL };

function OpsPulse({ ops }) {
  const tiles = [];
  if (ops.crf) tiles.push({ label: "Calibration requests", value: ops.crf.total, sub: `${ops.crf.submitted} pending · ${ops.crf.accepted} accepted`, color: "#8a6d00" });
  if (ops.satisfaction && ops.satisfaction.avg != null) tiles.push({ label: "Customer satisfaction", value: `${ops.satisfaction.avg}/5`, sub: ops.satisfaction.recommendRate != null ? `${ops.satisfaction.recommendRate}% recommend` : `${ops.satisfaction.count} responses`, color: WAIT });
  if (ops.tasks) tiles.push({ label: "Open tasks", value: ops.tasks.open, sub: `${ops.tasks.overdue} overdue`, color: ops.tasks.overdue ? FAIL : INK });
  if (ops.schedules) tiles.push({ label: "Overdue maintenance", value: ops.schedules.overdue, sub: `${ops.schedules.dueSoon} due this week`, color: ops.schedules.overdue ? FAIL : PASS });
  if (typeof ops.fleet === "number") tiles.push({ label: "Active weighbridges", value: ops.fleet, sub: "in service", color: INK });
  if (!tiles.length) return null;
  return (
    <section style={S.pulse}>
      {tiles.map((t, i) => (
        <div key={i} style={S.pulseTile}>
          <div style={S.pulseLab}>{t.label}</div>
          <div style={{ ...S.pulseVal, color: t.color }}>{t.value}</div>
          <div style={S.pulseSub}>{t.sub}</div>
        </div>
      ))}
    </section>
  );
}

function UsageStrip({ usage }) {
  const items = [
    { label: "Services delivered", value: usage.servicesDelivered },
    { label: "Checklist items completed", value: usage.checklistItems.toLocaleString() },
    { label: "Photos captured", value: usage.photos.toLocaleString() },
    { label: "Weighbridges serviced", value: usage.weighbridgesServiced },
    { label: "Sites covered", value: usage.sitesServiced },
    { label: "Staff active", value: usage.staffActive },
    { label: "Findings raised", value: usage.findingsRaised },
    usage.calibrationRequests != null ? { label: "Calibration requests", value: usage.calibrationRequests } : null,
    usage.quotations != null ? { label: "Quotations", value: usage.quotations } : null,
    usage.tasksHandled != null ? { label: "Tasks handled", value: usage.tasksHandled } : null,
  ].filter(Boolean);
  return (
    <section style={S.card}>
      <div style={S.sec}>
        <span style={S.secTtl}><span style={S.secDot} />Platform activity this period</span>
        <span style={S.secNote}>everything the app captured</span>
      </div>
      <div style={S.usageGrid}>
        {items.map((it, i) => (
          <div key={i} style={S.usageCell}>
            <div style={S.usageVal}>{it.value}</div>
            <div style={S.usageLab}>{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const REG_STATUS = {
  APPROVED: { label: "Approved", color: PASS },
  PENDING_SUPERVISOR: { label: "In review", color: "#C79A2B" },
  PENDING_MANAGER: { label: "Awaiting approval", color: WAIT },
  REJECTED: { label: "Returned", color: FAIL },
};

function ServiceRegister({ rows }) {
  const [limit, setLimit] = useState(60);
  const [open, setOpen] = useState(null); // expanded serial
  const shown = rows.slice(0, limit);
  return (
    <section style={S.card}>
      <div style={S.sec}>
        <span style={S.secTtl}><span style={S.secDot} />Service register — every report filed</span>
        <span style={S.secNote}>{rows.length} record{rows.length === 1 ? "" : "s"} · click a row for full detail</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 880, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ ...S.regRow, ...S.thead, gridTemplateColumns: `24px ${S.regRow.gridTemplateColumns}` }}>
            <span style={S.thcell}> </span>
            <span style={S.thcell}>Date</span>
            <span style={S.thcell}>Serial</span>
            <span style={S.thcell}>Service</span>
            <span style={S.thcell}>Weighbridge</span>
            <span style={S.thcell}>Client / branch</span>
            <span style={S.thcell}>Filed by</span>
            <span style={{ ...S.thcell, justifyContent: "center" }}>Photos</span>
            <span style={{ ...S.thcell, justifyContent: "center" }}>Findings</span>
            <span style={S.thcell}>Status</span>
          </div>
          {shown.map((r, i) => (
            <RegisterRow key={r.serial || i} r={r} zebra={i % 2 === 1} open={open === r.serial} onToggle={() => setOpen(open === r.serial ? null : r.serial)} />
          ))}
        </div>
      </div>
      {rows.length > limit ? (
        <button onClick={() => setLimit((n) => n + 100)} style={{ ...S.btn, marginTop: 10 }}>
          Show more ({rows.length - limit} more) · full list in PDF & Excel
        </button>
      ) : rows.length > 60 ? (
        <div style={{ fontSize: 12, color: MUTE, marginTop: 8 }}>Showing all {rows.length}. The full register is also in the PDF and Excel exports.</div>
      ) : null}
    </section>
  );
}

// One register row that lazy-loads and expands the report's full captured detail
// when clicked. The single-report GET returns everything, so we itemise client
// side with the same helper the PDFs use.
function RegisterRow({ r, zebra, open, onToggle }) {
  const st = REG_STATUS[r.status] || { label: r.status, color: MUTE };
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || detail || loading) return;
    setLoading(true);
    setErr("");
    fetch(`/api/reports/${r.serial}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load report detail."))))
      .then((d) => setDetail(itemizeReport(d.report || d)))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [open, detail, loading, r.serial]);

  const gridStyle = { ...S.regRow, gridTemplateColumns: `24px ${S.regRow.gridTemplateColumns}`, background: zebra ? "#FBF9F4" : "#fff", borderTop: "1px solid #EFEAdd", cursor: "pointer" };

  return (
    <div>
      <div style={gridStyle} onClick={onToggle} title="Show full detail">
        <span style={{ ...S.rcell, color: "#b6ab93", justifyContent: "center", fontSize: 12, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▸</span>
        <span style={{ ...S.rcell, fontFamily: "var(--mono)", fontSize: 11, color: MUTE }}>{fmtDay(r.createdAt)}</span>
        <Link href={`/reports/${r.serial}`} onClick={(e) => e.stopPropagation()} style={{ ...S.rcell, fontFamily: "var(--mono)", fontSize: 11, color: "#8a6d00", fontWeight: 700, textDecoration: "none" }}>{r.serial}</Link>
        <span style={{ ...S.rcell, color: INK }}>{r.templateName}</span>
        <span style={{ ...S.rcell, fontFamily: "var(--mono)", fontSize: 11, color: INK }}>{r.weighbridgeId || "—"}</span>
        <span style={{ ...S.rcell, flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
          <span style={{ color: INK, fontWeight: 600 }}>{r.clientName || "—"}</span>
          {r.site ? <span style={{ fontSize: 11, color: MUTE }}>{r.site}</span> : null}
        </span>
        <span style={{ ...S.rcell, color: INK }}>{r.authorName}</span>
        <span style={{ ...S.rcell, justifyContent: "center", color: MUTE }}>{r.photos || 0}</span>
        <span style={{ ...S.rcell, justifyContent: "center", fontWeight: 800, color: r.findings ? FAIL : "#b8af9e" }}>{r.findings || "—"}</span>
        <span style={S.rcell}><span style={{ ...S.regPill, background: st.color }}>{st.label}</span></span>
      </div>
      {open ? (
        <div style={{ padding: "12px 16px", background: "#FCFAF4", borderTop: "1px solid #EFEAdd" }}>
          {loading ? <div style={{ fontSize: 12.5, color: MUTE }}>Loading full detail…</div>
            : err ? <div style={{ fontSize: 12.5, color: FAIL }}>{err}</div>
            : detail ? <DetailBlocks blocks={detail.blocks} photoCount={detail.photoCount} />
            : null}
        </div>
      ) : null}
    </div>
  );
}

// Web renderer for the itemised blocks (mirrors the PDF ReportDetailBlocks).
function DetailBlocks({ blocks, photoCount }) {
  if (!blocks || !blocks.length) return <div style={{ fontSize: 12.5, color: MUTE, fontStyle: "italic" }}>No structured entries were captured on this report.</div>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {blocks.map((b, i) => (
        <div key={i}>
          <div style={{ fontSize: 11, fontWeight: 800, color: INK, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5 }}>
            {b.title}{b.kind === "checklist" && b.flagged ? <span style={{ color: FAIL }}> · {b.flagged} flagged</span> : null}
          </div>
          {b.kind === "fields" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "3px 18px" }}>
              {b.entries.map((e, k) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, borderBottom: "1px dashed var(--line)", padding: "3px 0" }}>
                  <span style={{ color: MUTE }}>{e.label}</span><b style={{ color: INK, textAlign: "right" }}>{e.value}</b>
                </div>
              ))}
            </div>
          ) : null}
          {b.kind === "note" ? <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.5, background: "#fff", border: "1px solid var(--line)", borderRadius: 6, padding: "7px 9px" }}>{b.value}</div> : null}
          {b.kind === "choice" ? <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{b.value}</div> : null}
          {b.kind === "checklist" ? <DetailChecklist block={b} /> : null}
          {(b.kind === "grid" || b.kind === "loadcells" || b.kind === "weekly") ? <DetailTable block={b} /> : null}
        </div>
      ))}
      {photoCount ? <div style={{ fontSize: 11.5, color: MUTE }}>{photoCount} photo{photoCount === 1 ? "" : "s"} attached.</div> : null}
    </div>
  );
}

function DetailChecklist({ block }) {
  const items = block.items.filter((i) => i.answered || i.remark);
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
      {items.map((i, k) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 90px 1.2fr", gap: 8, fontSize: 12, padding: "5px 9px", background: k % 2 ? "#fff" : "#FBF9F4", borderTop: k ? "1px solid #EFEAdd" : "none" }}>
          <span style={{ color: INK }}>{i.item}</span>
          <span style={{ fontWeight: 800, color: i.ok === false ? FAIL : i.ok ? PASS : MUTE, textAlign: "center" }}>{i.result || "—"}</span>
          <span style={{ color: i.remark ? FAIL : MUTE }}>{i.remark || ""}</span>
        </div>
      ))}
    </div>
  );
}

function DetailTable({ block }) {
  // Normalise grid / loadcells / weekly into cols + rows for one table renderer.
  let cols = [];
  let body = [];
  let numeric = [];
  if (block.kind === "grid") {
    cols = block.cols; numeric = block.numericCols || []; body = block.rows;
  } else if (block.kind === "loadcells") {
    cols = ["", ...block.cols]; numeric = cols.map((_, i) => i > 0);
    body = block.rows.map((r) => [r.label, ...r.cells]);
  } else if (block.kind === "weekly") {
    cols = ["Run", "End A", "Middle", "End B", "Spread"]; numeric = [false, true, true, true, true];
    body = block.rows.map((r) => [r.run, r.a, r.m, r.b, r.diff]);
  }
  return (
    <div style={{ overflowX: "auto" }}>
      {block.kind === "weekly" ? (
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 5, color: block.pass === false ? FAIL : INK }}>
          Verdict: {block.pass === null ? "not completed" : block.pass ? "within limit" : "over limit — attention required"} · limit {block.limit || "—"} kg
        </div>
      ) : null}
      <div style={{ minWidth: 360, border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, minmax(48px,1fr))`, background: COAL, color: "#fff" }}>
          {cols.map((c, ci) => <span key={ci} style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 6px", textAlign: numeric[ci] ? "right" : "left" }}>{c}</span>)}
        </div>
        {body.map((row, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, minmax(48px,1fr))`, background: ri % 2 ? "#FBF9F4" : "#fff", borderTop: "1px solid #EFEAdd" }}>
            {row.map((cell, ci) => <span key={ci} style={{ fontSize: 11.5, padding: "4px 6px", color: INK, textAlign: numeric[ci] ? "right" : "left", fontWeight: ci === 0 && block.kind !== "grid" ? 700 : 400 }}>{cell || "—"}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationsRegion({ ops }) {
  const hasDue = (ops.schedules?.overdueList?.length || 0) + (ops.contracts?.upcomingList?.length || 0) > 0 || ops.schedules || ops.contracts;
  return (
    <>
      <div style={S.divider}><span style={S.divLine} /><span style={S.divTxt}>Across the business</span><span style={S.divLine} /></div>
      <div style={S.grid2}>
        {ops.crf ? <Card title="Calibration requests" note={`${ops.crf.total} in period`}><Calib crf={ops.crf} /></Card> : null}
        {ops.satisfaction || ops.training ? <Card title="Satisfaction" note="rated out of 5">{<Satis s={ops.satisfaction} tr={ops.training} />}</Card> : null}
      </div>
      <div style={S.grid2}>
        {ops.tasks ? <Card title="Task workload" note={`${ops.tasks.total} task${ops.tasks.total === 1 ? "" : "s"}`}><Workload t={ops.tasks} /></Card> : null}
      </div>
      {hasDue ? (
        <div style={S.grid2}>
          {ops.schedules ? (
            <Card title="Overdue maintenance" note={`${ops.schedules.overdue} overdue · ${ops.schedules.dueSoon} this week`}>
              {ops.schedules.overdueList?.length ? <DueList items={ops.schedules.overdueList} allOverdue /> : <div style={okStyle}>No overdue maintenance obligations. 🎉</div>}
            </Card>
          ) : null}
          {ops.contracts ? (
            <Card title="Service contracts — upcoming" note={`${ops.contracts.overdue} overdue · ${ops.contracts.dueSoon} within 30 days`}>
              {ops.contracts.upcomingList?.length ? <DueList items={ops.contracts.upcomingList} /> : <div style={okStyle}>No services due soon.</div>}
            </Card>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function StackBar({ segments }) {
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  if (!segments.length) return <div style={okStyle}>Nothing recorded in this period.</div>;
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#F0EADD" }}>
        {segments.map((s, i) => <div key={i} style={{ width: `${(s.value / sum) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} />)}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 9, flexWrap: "wrap" }}>
        {segments.map((s, i) => (
          <span key={i} style={{ fontSize: 12, color: INK, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />{s.label} <b>{s.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function Calib({ crf }) {
  const segs = [
    { label: "Submitted", value: crf.submitted, color: WAIT },
    { label: "Accepted", value: crf.accepted, color: PASS },
    { label: "Rejected", value: crf.rejected, color: FAIL },
  ].filter((s) => s.value > 0);
  return (
    <div>
      {segs.length ? <StackBar segments={segs} /> : <div style={okStyle}>No calibration requests in this period.</div>}
      {crf.total > 0 ? (
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: MUTE }}>
          <span><b style={{ color: INK }}>{crf.inSitu}</b> in-situ</span>
          <span><b style={{ color: INK }}>{crf.lab}</b> laboratory</span>
        </div>
      ) : null}
      {crf.recent?.length ? (
        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          {crf.recent.map((r, i) => (
            <div key={i} style={S.miniRow}>
              <span style={S.miniSerial}>{r.serial}</span>
              <span style={{ flex: 1, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.clientName}</span>
              <span style={{ ...S.chip, background: CRF_COLOR[r.status] || MUTE }}>{r.status}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Satis({ s, tr }) {
  const items = [];
  if (s && s.avg != null) items.push({ label: "Customer service (CSSF)", avg: s.avg, sub: `${s.count} response${s.count === 1 ? "" : "s"}${s.recommendRate != null ? ` · ${s.recommendRate}% would recommend` : ""}` });
  if (tr && tr.avg != null) items.push({ label: "Training", avg: tr.avg, sub: `${tr.count} response${tr.count === 1 ? "" : "s"}` });
  if (!items.length) return <div style={okStyle}>No feedback recorded in this period.</div>;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}><span style={{ fontWeight: 700 }}>{it.label}</span><b>{it.avg} / 5</b></div>
          <div style={{ height: 10, background: "#F0EADD", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${(it.avg / 5) * 100}%`, height: "100%", background: it.avg >= 4 ? PASS : it.avg >= 3 ? WAIT : FAIL, borderRadius: 6 }} />
          </div>
          <div style={{ fontSize: 11.5, color: MUTE, marginTop: 4 }}>{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

function Workload({ t }) {
  const segs = [
    { label: "Open", value: t.openNew, color: "#3B82C4" },
    { label: "In progress", value: t.inProgress, color: GOLD },
    { label: "Blocked", value: t.blocked, color: FAIL },
    { label: "Done", value: t.done, color: PASS },
  ].filter((s) => s.value > 0);
  return (
    <div>
      {segs.length ? <StackBar segments={segs} /> : <div style={okStyle}>No tasks recorded.</div>}
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: MUTE }}>
        <span><b style={{ color: t.overdue ? FAIL : INK }}>{t.overdue}</b> overdue</span>
        <span><b style={{ color: INK }}>{t.highPriorityOpen}</b> high priority open</span>
      </div>
      {t.overdueList?.length ? (
        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          {t.overdueList.map((r, i) => (
            <div key={i} style={S.miniRow}>
              <span style={{ flex: 1, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
              <span style={{ fontSize: 11, color: MUTE }}>{r.assignedName}</span>
              <span style={{ ...S.chip, background: FAIL }}>{fmtDay(r.dueAt)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DueList({ items, allOverdue }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((r, i) => {
        const overdue = allOverdue || r.overdue;
        return (
          <div key={i} style={S.miniRow}>
            <span style={{ flex: 1, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            {r.weighbridgeId ? <span style={{ fontSize: 11, color: MUTE, fontFamily: "var(--mono)" }}>{r.weighbridgeId}</span> : null}
            <span style={{ ...S.chip, background: overdue ? FAIL : WAIT }}>{fmtDay(r.dueAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- styles ---------- */
const SHADOW = "0 1px 2px rgba(20,16,10,.04), 0 4px 16px rgba(20,16,10,.06)";
const SHADOW_LG = "0 2px 8px rgba(20,16,10,.10), 0 12px 34px rgba(20,16,10,.14)";
const S = {
  bar: { background: "#fff", border: "1px solid var(--line)", borderRadius: 16, boxShadow: SHADOW, padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8a6d00" },
  segs: { display: "flex", gap: 4, background: "#F3EFE6", border: "1px solid var(--line)", borderRadius: 10, padding: 4, flexWrap: "wrap" },
  seg: (on) => ({ fontSize: 12, fontWeight: 800, color: on ? GOLD : MUTE, padding: "6px 12px", borderRadius: 7, border: "none", background: on ? COAL : "transparent" }),
  btn: { border: "1px solid var(--line)", background: "#fff", color: INK, fontWeight: 800, padding: "9px 14px", borderRadius: 10, fontSize: 12.5, textDecoration: "none", boxShadow: SHADOW },
  btnDark: { background: COAL, color: GOLD, borderColor: COAL },
  live: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: "#fff", color: MUTE, fontWeight: 700, padding: "8px 11px", borderRadius: 999, fontSize: 11.5, cursor: "pointer", boxShadow: SHADOW },
  liveDot: { width: 8, height: 8, borderRadius: "50%", background: PASS, boxShadow: "0 0 0 0 rgba(46,125,70,.5)", animation: "qslPulse 2s infinite" },

  exec: { background: "linear-gradient(135deg,#1c1813 0%,#161310 60%,#221c12 100%)", borderRadius: 18, boxShadow: SHADOW_LG, padding: "22px 22px 20px", color: "#fff", position: "relative", overflow: "hidden" },
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
  ins: (k) => ({ background: "#fff", border: "1px solid var(--line)", borderLeft: `4px solid ${k === "good" ? PASS : k === "bad" ? FAIL : GOLD}`, borderRadius: 13, boxShadow: SHADOW, padding: "13px 15px" }),
  insH: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: MUTE },
  insB: { fontSize: 13.5, marginTop: 6, lineHeight: 1.4, color: INK },

  card: { background: "#fff", border: "1px solid var(--line)", borderRadius: 16, boxShadow: SHADOW, padding: 18 },
  sec: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8, flexWrap: "wrap" },
  secTtl: { fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".04em", display: "flex", gap: 9, alignItems: "center", color: INK },
  secDot: { width: 10, height: 10, background: GOLD, borderRadius: 3, flexShrink: 0 },
  secNote: { fontSize: 11, color: MUTE, fontWeight: 700 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 },
  grid2b: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 },

  stmtBar: { background: "linear-gradient(135deg,#fff,#FBF6EA)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: SHADOW, padding: "15px 18px", display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  tabs: { display: "flex", gap: 4, background: "#F3EFE6", border: "1px solid var(--line)", borderRadius: 12, padding: 5, flexWrap: "wrap", boxShadow: SHADOW },
  tab: (on) => ({ fontSize: 12.5, fontWeight: 800, color: on ? GOLD : MUTE, padding: "9px 15px", borderRadius: 8, border: "none", background: on ? COAL : "transparent", cursor: "pointer" }),
  pulse: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(158px,1fr))", gap: 12 },
  pulseTile: { background: "#fff", border: "1px solid var(--line)", borderRadius: 14, boxShadow: SHADOW, padding: "14px 16px" },
  pulseLab: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: MUTE },
  pulseVal: { fontSize: 26, fontWeight: 900, marginTop: 6, letterSpacing: "-.02em", lineHeight: 1.05 },
  pulseSub: { fontSize: 11, color: MUTE, marginTop: 4 },
  divider: { display: "flex", alignItems: "center", gap: 14, margin: "8px 2px 0" },
  divLine: { flex: 1, height: 1, background: "var(--line)" },
  divTxt: { fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".12em", color: "#8a6d00" },
  moneyRow: { display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" },
  moneyLab: { fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: MUTE },
  moneyVal: { fontSize: 18, fontWeight: 900, marginTop: 3 },
  miniRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 },
  miniSerial: { fontFamily: "var(--mono)", fontSize: 10.5, color: "#8a6d00", fontWeight: 700 },
  chip: { fontSize: 10, fontWeight: 800, color: "#fff", padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap" },

  usageGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 1, background: "var(--line)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" },
  usageCell: { background: "#fff", padding: "13px 14px", textAlign: "center" },
  usageVal: { fontSize: 24, fontWeight: 900, color: INK, letterSpacing: "-.02em" },
  usageLab: { fontSize: 10.5, fontWeight: 700, color: MUTE, marginTop: 4, textTransform: "uppercase", letterSpacing: ".03em", lineHeight: 1.25 },
  regRow: { display: "grid", gridTemplateColumns: "70px 130px 1.4fr 96px 1.2fr 1fr 62px 70px 130px" },
  rcell: { padding: "8px 10px", display: "flex", alignItems: "center", fontSize: 12, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  regPill: { fontSize: 10, fontWeight: 800, color: "#fff", padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap" },

  trow: { display: "grid", gridTemplateColumns: "120px 1.5fr 130px 1.3fr 100px" },
  thead: { background: COAL, color: "#fff" },
  thcell: { padding: "9px 12px", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em", display: "flex", alignItems: "center" },
  tcell: { padding: "9px 12px", display: "flex", alignItems: "center", fontSize: 12.5 },
  flag: { fontSize: 10.5, fontWeight: 900, color: "#fff", background: FAIL, padding: "3px 8px", borderRadius: 5, letterSpacing: ".03em" },
};
