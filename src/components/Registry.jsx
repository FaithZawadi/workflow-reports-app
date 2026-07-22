"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pill } from "./ui";
import { COAL, GOLD, INK, MUTE, WAIT } from "@/lib/theme";

const FILTERS = [
  ["all", "All"],
  ["PENDING_SUPERVISOR", "Supervisor"],
  ["PENDING_MANAGER", "Manager"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected"],
];

// A report is "recent" if filed within the last 24 hours. Shown to every role,
// scoped to the reports they can see.
const RECENT_MS = 24 * 60 * 60 * 1000;
const isRecent = (r) => {
  const t = new Date(r.createdAt).getTime();
  return !isNaN(t) && Date.now() - t < RECENT_MS;
};

// Compact relative time so the newest work reads at a glance.
function relTime(d) {
  const dt = new Date(d);
  const diff = Date.now() - dt.getTime();
  if (isNaN(diff)) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return dt.toLocaleDateString();
}

export default function Registry({ profile }) {
  const [reports, setReports] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [template, setTemplate] = useState("");

  const [due, setDue] = useState(null);
  const [queuedNotice, setQueuedNotice] = useState(false);

  // Land pre-filtered when arriving from a dashboard chart (e.g. /dashboard?status=APPROVED
  // or ?template=WB01 or ?q=...). Read once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const st = p.get("status");
    if (st) setFilter(st);
    const tq = p.get("q");
    if (tq) setQ(tq);
    const tpl = p.get("template");
    if (tpl) setTemplate(tpl);
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (q.trim()) params.set("q", q.trim());
    if (name.trim()) params.set("name", name.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (template) params.set("template", template);
    const res = await fetch("/api/reports?" + params.toString());
    const data = await res.json();
    setReports(data.reports || []);
  }, [filter, q, name, from, to, template]);

  const clearFilters = () => {
    setFilter("all");
    setQ("");
    setName("");
    setFrom("");
    setTo("");
    setTemplate("");
  };
  const anyFilter = filter !== "all" || q || name || from || to || template;

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  // Keep the registry current without a manual Refresh: poll periodically and
  // reload whenever the tab regains focus or becomes visible again. New reports
  // then auto-populate at the top (the API already returns newest-first).
  useEffect(() => {
    const iv = setInterval(load, 40000);
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    fetch("/api/schedules")
      .then((r) => r.json())
      .then((d) => setDue(d.summary || null))
      .catch(() => {});
  }, []);

  // A report filed while offline lands here with ?queued=1. Show a reassurance
  // note, and reload the registry once the outbox has synced to the server.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("queued") === "1") {
      setQueuedNotice(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
    const onSynced = () => {
      setQueuedNotice(false);
      load();
    };
    window.addEventListener("qsl:outbox-synced", onSynced);
    return () => window.removeEventListener("qsl:outbox-synced", onSynced);
  }, [load]);

  const exportCsv = () => {
    const rows = [["serial", "template", "author", "client", "site", "weighbridge", "status", "created"]].concat(
      (reports || []).map((r) => [r.serial, r.templateName, r.authorName, r.clientName, r.site, r.weighbridgeId, r.status, r.createdAt])
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "qsl_report_register.csv";
    a.click();
  };

  // Split the (already newest-first) list into a "Recent" group and the rest,
  // so every role sees the latest work tagged and grouped at the top.
  const recentReports = (reports || []).filter(isRecent);
  const earlierReports = (reports || []).filter((r) => !isRecent(r));
  const recentCount = recentReports.length;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">{profile.role.replace("_", " ")}</p>
          <h1 className="h1">Report registry</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          <button className="btn btn-dark" onClick={exportCsv} style={{ fontSize: 12 }}>Export CSV</button>
          {profile.role === "ADMIN" && (
            <a className="btn btn-primary" href="/api/reports/export" style={{ fontSize: 12 }}>
              Export Excel
            </a>
          )}
        </div>
      </div>

      {queuedNotice && (
        <div
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginTop: 12, borderColor: WAIT, borderLeftWidth: 5 }}
          role="status"
        >
          <span style={{ fontSize: 18 }}>📩</span>
          <span style={{ fontSize: 13, color: INK, fontWeight: 700 }}>
            Report saved on this device.
            <span style={{ color: MUTE, fontWeight: 400 }}> It will be sent automatically as soon as you have a network connection.</span>
          </span>
        </div>
      )}

      {due && (due.overdue > 0 || due.dueSoon > 0) && (
        <Link
          href="/schedule"
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            marginTop: 12,
            textDecoration: "none",
            borderColor: due.overdue > 0 ? "#B03A2E" : "#946B00",
            borderLeftWidth: 5,
          }}
        >
          <span style={{ fontSize: 20 }}>🛠️</span>
          <span style={{ fontSize: 13, color: INK, fontWeight: 700 }}>
            {due.overdue > 0 && (
              <span style={{ color: "#B03A2E" }}>{due.overdue} overdue</span>
            )}
            {due.overdue > 0 && due.dueSoon > 0 && " · "}
            {due.dueSoon > 0 && (
              <span style={{ color: "#946B00" }}>{due.dueSoon} due soon</span>
            )}
            <span style={{ color: MUTE, fontWeight: 400 }}> — open maintenance schedule →</span>
          </span>
        </Link>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
        {FILTERS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className="btn"
            style={filter === k ? { background: COAL, color: GOLD, borderColor: COAL, fontSize: 12 } : { fontSize: 12 }}
          >
            {l}
          </button>
        ))}
      </div>

      {template && (
        <div style={{ margin: "0 0 8px" }}>
          <button onClick={() => setTemplate("")} className="btn" style={{ fontSize: 12, background: COAL, color: GOLD, borderColor: COAL }}>
            Form: {template} ✕
          </button>
        </div>
      )}

      <input className="input" placeholder="Search serial, author, site or weighbridge…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 12, alignItems: "end" }}>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Filed by (name / plant)</span>
          <input className="input" placeholder="e.g. John or TATA" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">From date</span>
          <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">To date</span>
          <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        {anyFilter && (
          <button className="btn" onClick={clearFilters} style={{ fontSize: 12, height: 42 }}>
            Clear filters
          </button>
        )}
      </div>

      {reports === null && <div className="muted">Loading registry…</div>}
      {reports && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{reports.length} report{reports.length === 1 ? "" : "s"}{anyFilter ? " match your filters" : ""}</span>
          {recentCount > 0 && (
            <span style={{ background: GOLD, color: COAL, fontWeight: 800, fontSize: 11, padding: "2px 8px", borderRadius: 999 }}>
              {recentCount} new · last 24h
            </span>
          )}
        </div>
      )}
      {reports && reports.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          {anyFilter
            ? "No reports match these filters. Try widening the dates or clearing filters."
            : `Nothing here yet. ${profile.role === "TECHNICIAN" || profile.role === "ENGINEER" ? "Tap New report to start." : ""}`}
        </div>
      )}

      {recentReports.length > 0 && (
        <>
          <SectionHeading label="Recent" note="last 24 hours" count={recentReports.length} />
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", marginBottom: 18 }}>
            {recentReports.map((r, i) => (
              <ReportCard key={r.serial} r={r} num={i + 1} recent />
            ))}
          </div>
        </>
      )}

      {earlierReports.length > 0 && (
        <>
          {recentReports.length > 0 && <SectionHeading label="Earlier" count={earlierReports.length} />}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
            {earlierReports.map((r, i) => (
              <ReportCard key={r.serial} r={r} num={recentReports.length + i + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// A small, orderly section divider.
function SectionHeading({ label, note, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 10px" }}>
      <span style={{ width: 10, height: 10, background: GOLD, borderRadius: 2 }} />
      <span style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: ".04em", color: INK }}>{label}</span>
      {note && <span className="muted" style={{ fontSize: 11 }}>· {note}</span>}
      <span className="muted" style={{ fontSize: 11 }}>({count})</span>
      <span style={{ flex: 1, height: 1, background: "#e9e2d2" }} />
    </div>
  );
}

function ReportCard({ r, recent, num }) {
  return (
    <Link href={`/reports/${r.serial}`} className="card" style={{ textDecoration: "none", display: "block", padding: 0, overflow: "hidden", borderColor: recent ? GOLD : undefined }}>
      <div className="stripe" style={{ height: 4 }} />
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {num != null && (
              <span title="Registry number (1 = latest)" style={{ fontSize: 11, fontWeight: 900, color: MUTE, minWidth: 22, textAlign: "right" }}>#{num}</span>
            )}
            <span className="mono" style={{ fontSize: 12, fontWeight: 700, background: COAL, color: GOLD, padding: "2px 6px" }}>{r.serial}</span>
            {recent && <span style={{ background: GOLD, color: COAL, fontSize: 10, fontWeight: 900, letterSpacing: ".04em", padding: "2px 6px", borderRadius: 3 }}>NEW</span>}
          </span>
          <Pill status={r.status} />
        </div>
        <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 14, marginTop: 8, color: INK }}>{r.templateName}</div>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          {r.clientName}
          {r.site ? " - " + r.site : ""} · {r.weighbridgeId || "weighbridge not stated"}
        </div>
        <div className="muted" style={{ marginTop: 2, fontSize: 12 }}>
          by {r.authorName} · <span title={new Date(r.createdAt).toLocaleString()}>{relTime(r.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
