"use client";
import { useEffect, useMemo, useState } from "react";
import { PaperCard, SectionBar } from "./ui";
import { COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const STATUS_LABEL = {
  PENDING_SUPERVISOR: "Supervisor review",
  PENDING_MANAGER: "Manager approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
const STATUS_COLOR = { PENDING_SUPERVISOR: WAIT, PENDING_MANAGER: WAIT, APPROVED: PASS, REJECTED: FAIL };

const iso = (d) => d.toISOString().slice(0, 10);

// Preset date ranges → { from, to } (YYYY-MM-DD).
function presetRange(key) {
  const now = new Date();
  const to = iso(now);
  const start = new Date(now);
  if (key === "week") start.setDate(now.getDate() - 7);
  else if (key === "month") start.setMonth(now.getMonth() - 1);
  else if (key === "quarter") start.setMonth(now.getMonth() - 3);
  else if (key === "year") start.setFullYear(now.getFullYear() - 1);
  else if (key === "all") return { from: "", to: "" };
  return { from: iso(start), to };
}

const PRESETS = [
  ["week", "Last 7 days"],
  ["month", "Last 30 days"],
  ["quarter", "Last 3 months"],
  ["year", "Last 12 months"],
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

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/reports/summary?${qs}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load the report.");
      setData(d);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const choosePreset = (key) => {
    setPreset(key);
    setCustom(false);
    const r = presetRange(key);
    setFrom(r.from);
    setTo(r.to);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <PaperCard>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <h1 className="h1" style={{ margin: 0 }}>Management report</h1>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>A segmented summary of the reports you oversee.</div>
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

        {/* range picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14, alignItems: "center" }}>
          {PRESETS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => choosePreset(key)}
              className="btn"
              style={{
                fontSize: 12,
                padding: "6px 12px",
                background: !custom && preset === key ? COAL : "#fff",
                color: !custom && preset === key ? GOLD : INK,
                borderColor: !custom && preset === key ? COAL : "var(--line)",
                fontWeight: 700,
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setCustom(true)}
            className="btn"
            style={{ fontSize: 12, padding: "6px 12px", background: custom ? COAL : "#fff", color: custom ? GOLD : INK, borderColor: custom ? COAL : "var(--line)", fontWeight: 700 }}
          >
            Custom
          </button>
          {custom && (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, color: MUTE }}>
              <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={{ padding: "5px 8px", fontSize: 12 }} />
              <span>to</span>
              <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={{ padding: "5px 8px", fontSize: 12 }} />
            </span>
          )}
        </div>

        {err && <div className="err" style={{ marginTop: 14 }}>{err}</div>}
        {loading && !data ? (
          <div className="muted" style={{ marginTop: 20 }}>Building report…</div>
        ) : data ? (
          <Report data={data} loading={loading} />
        ) : null}
      </PaperCard>
    </div>
  );
}

function Report({ data, loading }) {
  const kpis = [
    { n: data.total, l: "Total reports", c: INK },
    { n: data.pending, l: "Pending", c: WAIT },
    { n: data.approved, l: "Approved", c: PASS },
    { n: data.rejected, l: "Rejected", c: FAIL },
    { n: data.findingsCount, l: "Findings", c: FAIL },
    { n: data.avgTurnaroundHours != null ? `${data.avgTurnaroundHours}h` : "—", l: "Avg approval", c: INK },
  ];
  return (
    <div style={{ marginTop: 16, opacity: loading ? 0.6 : 1 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "12px 10px", textAlign: "center", background: "#fff" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.c }}>{k.n}</div>
            <div style={{ fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <Segment title="Status breakdown">
        <Table
          cols={[
            { label: "Status", w: "1fr", get: (r) => STATUS_LABEL[r.key] || r.key, color: (r) => STATUS_COLOR[r.key] },
            { label: "Reports", w: "90px", align: "right", get: (r) => r.count },
          ]}
          rows={Object.keys(data.byStatus || {}).map((k) => ({ key: k, count: data.byStatus[k] }))}
        />
      </Segment>

      <Segment title="By weighbridge">
        <Table
          cols={[
            { label: "Weighbridge", w: "1fr", get: (r) => r.id },
            { label: "Reports", w: "90px", align: "right", get: (r) => r.count },
            { label: "Findings", w: "90px", align: "right", get: (r) => r.findings, color: (r) => (r.findings ? FAIL : MUTE) },
          ]}
          rows={data.byWeighbridge}
        />
      </Segment>

      <Segment title="By client & site">
        <Table cols={[{ label: "Client / site", w: "1fr", get: (r) => r.name }, { label: "Reports", w: "90px", align: "right", get: (r) => r.count }]} rows={data.byClient} />
      </Segment>

      <Segment title="By report type">
        <Table cols={[{ label: "Report type", w: "1fr", get: (r) => `${r.name} (${r.code})` }, { label: "Reports", w: "90px", align: "right", get: (r) => r.count }]} rows={data.byTemplate} />
      </Segment>

      <Segment title="By person (filed)">
        <Table cols={[{ label: "Filed by", w: "1fr", get: (r) => r.name }, { label: "Reports", w: "90px", align: "right", get: (r) => r.count }]} rows={data.byAuthor} />
      </Segment>

      <Segment title={`Flagged findings — needs attention (${data.findingsCount})`}>
        {data.findings?.length ? (
          <Table
            cols={[
              { label: "Serial", w: "130px", get: (r) => r.serial, mono: true },
              { label: "Item", w: "1.4fr", get: (r) => r.item },
              { label: "Result", w: "120px", get: (r) => r.result, color: () => FAIL, bold: true },
              { label: "Remark", w: "1.2fr", get: (r) => r.remark || "—" },
            ]}
            rows={data.findings}
          />
        ) : (
          <div className="muted" style={{ fontSize: 13, fontStyle: "italic" }}>No items needed attention in this period.</div>
        )}
      </Segment>
    </div>
  );
}

function Segment({ title, children }) {
  return (
    <div>
      <SectionBar>{title}</SectionBar>
      {children}
    </div>
  );
}

function Table({ cols, rows }) {
  if (!rows || !rows.length) return <div className="muted" style={{ fontSize: 13, fontStyle: "italic" }}>None in this period.</div>;
  const template = cols.map((c) => c.w).join(" ");
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 420, border: "1px solid #e6e0d2", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: template, background: COAL, color: "#fff", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
          {cols.map((c, i) => (
            <span key={i} style={{ padding: "6px 10px", textAlign: c.align || "left" }}>{c.label}</span>
          ))}
        </div>
        {rows.map((r, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: template, fontSize: 13.5, borderTop: "1px solid #eae4d6" }}>
            {cols.map((c, i) => (
              <span
                key={i}
                style={{
                  padding: "8px 10px",
                  textAlign: c.align || "left",
                  color: c.color ? c.color(r) : INK,
                  fontWeight: c.bold ? 800 : 400,
                  fontFamily: c.mono ? "monospace" : "inherit",
                  fontSize: c.mono ? 12 : undefined,
                }}
              >
                {c.get(r)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
