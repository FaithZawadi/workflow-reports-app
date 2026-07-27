"use client";
import { useEffect, useMemo, useState } from "react";
import { PaperCard, SectionBar } from "./ui";
import { StatTile, Donut, BarList, TrendArea } from "./charts";
import { COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const STATUS_LABEL = {
  PENDING_SUPERVISOR: "Supervisor review",
  PENDING_MANAGER: "Manager approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
const STATUS_COLOR = { PENDING_SUPERVISOR: WAIT, PENDING_MANAGER: "#B8860B", APPROVED: PASS, REJECTED: FAIL };
const BAR_COLORS = ["#161310", "#946B00", "#2E7D46", "#3B82C4", "#B03A2E", "#7A5CCB", "#0E7C86", "#C2711C"];

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
  ["quarter", "3 months"],
  ["year", "12 months"],
  ["all", "All time"],
];

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

  const rangeLabel = from || to ? `${from || "start"} → ${to || "today"}` : "All time";

  return (
    <div style={{ marginTop: 12 }}>
      {/* Toolbar */}
      <PaperCard>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <h1 className="h1" style={{ margin: 0 }}>Management report</h1>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Analytics across the reports you oversee · <b>{rangeLabel}</b></div>
          </div>
          <a
            className="btn btn-dark"
            href={`/api/reports/summary/pdf?${qs}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, textDecoration: "none", pointerEvents: loading ? "none" : "auto", opacity: loading ? 0.6 : 1 }}
          >
            ⬇ Download PDF
          </a>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14, alignItems: "center" }}>
          {PRESETS.map(([key, label]) => (
            <button key={key} onClick={() => choose(key)} className="btn" style={chip(!custom && preset === key)}>{label}</button>
          ))}
          <button onClick={() => setCustom(true)} className="btn" style={chip(custom)}>Custom</button>
          {custom && (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, color: MUTE }}>
              <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={{ padding: "5px 8px", fontSize: 12 }} />
              <span>to</span>
              <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={{ padding: "5px 8px", fontSize: 12 }} />
            </span>
          )}
        </div>
        {err && <div className="err" style={{ marginTop: 14 }}>{err}</div>}
      </PaperCard>

      {loading && !data ? (
        <div className="muted" style={{ marginTop: 16 }}>Building analytics…</div>
      ) : data ? (
        <Analytics data={data} loading={loading} />
      ) : null}
    </div>
  );
}

function chip(active) {
  return {
    fontSize: 12,
    padding: "6px 12px",
    background: active ? COAL : "#fff",
    color: active ? GOLD : INK,
    borderColor: active ? COAL : "var(--line)",
    fontWeight: 700,
  };
}

function Analytics({ data, loading }) {
  const statusSegments = ["APPROVED", "PENDING_MANAGER", "PENDING_SUPERVISOR", "REJECTED"]
    .map((k) => ({ label: STATUS_LABEL[k], value: data.byStatus?.[k] || 0, color: STATUS_COLOR[k] }))
    .filter((s) => s.value > 0);

  const bars = (arr, key = "count") => arr.map((r, i) => ({ label: r.label, value: r[key], color: BAR_COLORS[i % BAR_COLORS.length] }));

  return (
    <div style={{ marginTop: 14, opacity: loading ? 0.55 : 1, transition: "opacity .2s", display: "grid", gap: 14 }}>
      {/* KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <StatTile label="Total reports" value={data.total} icon="📋" />
        <StatTile label="Approved" value={`${data.approved}`} sub={`${data.approvalRate}% of total`} tone="pass" icon="✓" />
        <StatTile label="Pending" value={data.pending} tone="wait" icon="⏳" />
        <StatTile label="Rejected" value={data.rejected} sub={`${data.rejectionRate}% of total`} tone="fail" icon="✗" />
        <StatTile label="Findings" value={data.findingsCount} sub={`${data.findingsRate} per report`} tone="fail" icon="⚠" />
        <StatTile label="Avg approval" value={data.avgTurnaroundHours != null ? `${data.avgTurnaroundHours}h` : "—"} sub="submit → approved" icon="⚡" />
      </div>

      {/* Status donut + submissions trend */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) minmax(300px,1.4fr)", gap: 14 }}>
        <PaperCard>
          <SectionBar>Status distribution</SectionBar>
          {statusSegments.length ? <Donut segments={statusSegments} centerValue={data.total} centerLabel="reports" /> : <Empty />}
        </PaperCard>
        <PaperCard>
          <SectionBar>Submissions over time</SectionBar>
          {data.trend?.length ? <TrendArea points={data.trend} height={150} /> : <Empty />}
        </PaperCard>
      </div>

      {/* Breakdowns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        <PaperCard>
          <SectionBar>By weighbridge</SectionBar>
          <BarList items={bars(data.byWeighbridge.map((r) => ({ label: r.id, count: r.count })))} />
        </PaperCard>
        <PaperCard>
          <SectionBar>By report type</SectionBar>
          <BarList items={bars(data.byTemplate.map((r) => ({ label: `${r.name}`, count: r.count })))} />
        </PaperCard>
        <PaperCard>
          <SectionBar>By client &amp; site</SectionBar>
          <BarList items={bars(data.byClient.map((r) => ({ label: r.name, count: r.count })))} />
        </PaperCard>
        <PaperCard>
          <SectionBar>By person (filed)</SectionBar>
          <BarList items={bars(data.byAuthor.map((r) => ({ label: r.name, count: r.count })))} />
        </PaperCard>
      </div>

      {/* Findings */}
      <PaperCard>
        <SectionBar>Most common findings</SectionBar>
        {data.topFindings?.length ? (
          <BarList items={data.topFindings.map((r) => ({ label: r.item, value: r.count, color: FAIL }))} color={FAIL} />
        ) : (
          <div className="muted" style={{ fontSize: 13, fontStyle: "italic" }}>No items needed attention in this period. 🎉</div>
        )}
      </PaperCard>

      <PaperCard>
        <SectionBar>Flagged findings — needs attention ({data.findingsCount})</SectionBar>
        {data.findings?.length ? (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 640 }}>
              <div style={{ display: "grid", gridTemplateColumns: "150px 1.4fr 120px 1.2fr", background: COAL, color: "#fff", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                <span style={{ padding: "6px 10px" }}>Serial</span>
                <span style={{ padding: "6px 10px" }}>Item</span>
                <span style={{ padding: "6px 10px" }}>Result</span>
                <span style={{ padding: "6px 10px" }}>Remark</span>
              </div>
              {data.findings.map((f, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1.4fr 120px 1.2fr", fontSize: 13, borderTop: "1px solid #eae4d6" }}>
                  <a href={`/reports/${f.serial}`} style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 12, color: "#8a6d00", textDecoration: "none" }}>{f.serial}</a>
                  <span style={{ padding: "8px 10px", color: INK }}>{f.item}</span>
                  <span style={{ padding: "8px 10px", color: FAIL, fontWeight: 800 }}>{f.result}</span>
                  <span style={{ padding: "8px 10px", color: INK }}>{f.remark || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 13, fontStyle: "italic" }}>No items needed attention in this period.</div>
        )}
      </PaperCard>
    </div>
  );
}

function Empty() {
  return <div className="muted" style={{ fontSize: 13, fontStyle: "italic", padding: "10px 0" }}>No data in this period.</div>;
}
