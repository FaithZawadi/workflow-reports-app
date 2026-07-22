"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pill } from "./ui";
import { COAL, GOLD, INK, MUTE, WAIT, FAIL } from "@/lib/theme";

const FILTERS = [
  ["all", "All"],
  ["PENDING_SUPERVISOR", "Supervisor"],
  ["PENDING_MANAGER", "Manager"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected"],
];

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

  // Admin-only: permanently remove a report (for clearing test records).
  const deleteReport = async (r) => {
    if (!confirm(`Delete report ${r.serial}? This can't be undone.`)) return;
    const res = await fetch(`/api/reports/${r.serial}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Could not delete the report.");
      return;
    }
    setReports((prev) => (prev || []).filter((x) => x.serial !== r.serial));
  };

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
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          {reports.length} report{reports.length === 1 ? "" : "s"}
          {anyFilter ? " match your filters" : ""}
        </div>
      )}
      {reports && reports.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          {anyFilter
            ? "No reports match these filters. Try widening the dates or clearing filters."
            : `Nothing here yet. ${profile.role === "TECHNICIAN" || profile.role === "ENGINEER" ? "Tap New report to start." : ""}`}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
        {(reports || []).map((r) => (
          <Link key={r.serial} href={`/reports/${r.serial}`} className="card" style={{ textDecoration: "none", display: "block", padding: 0, overflow: "hidden" }}>
            <div className="stripe" style={{ height: 4 }} />
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, background: COAL, color: GOLD, padding: "2px 6px" }}>{r.serial}</span>
                <Pill status={r.status} />
              </div>
              <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 14, marginTop: 8, color: INK }}>{r.templateName}</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                {r.clientName}
                {r.site ? " - " + r.site : ""} · {r.weighbridgeId || "weighbridge not stated"}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  by {r.authorName} · {new Date(r.createdAt).toLocaleDateString()}
                </span>
                {profile.role === "ADMIN" && (
                  <button
                    className="btn"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteReport(r); }}
                    title="Delete report"
                    style={{ fontSize: 11, padding: "3px 8px", color: FAIL, borderColor: "#e6cfca" }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
