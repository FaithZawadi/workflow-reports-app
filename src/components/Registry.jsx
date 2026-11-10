"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pill } from "./ui";
import { COAL, GOLD, INK, MUTE, FAIL, WAIT } from "@/lib/theme";

const FILTERS = [
  ["all", "All"],
  ["PENDING_SUPERVISOR", "In review"],
  ["PENDING_CLIENT", "With client"],
  ["CLIENT_RETURNED", "Returned"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected"],
];

const FILTERS_KEY = "qsl_registry_filters";
const INACTIVITY_MS = 2 * 60 * 1000;
const RECENT_MS = 24 * 60 * 60 * 1000;
const isRecent = (r) => {
  const t = new Date(r.createdAt).getTime();
  return !isNaN(t) && Date.now() - t < RECENT_MS;
};
const shortDate = (d) => {
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); } catch { return ""; }
};

export default function Registry({ profile }) {
  const router = useRouter();
  const isAdmin = profile.role === "ADMIN" || (Array.isArray(profile.roles) && profile.roles.includes("ADMIN"));
  const [reports, setReports] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [template, setTemplate] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [due, setDue] = useState(null);
  const [queuedNotice, setQueuedNotice] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const st = p.get("status"), tq = p.get("q"), tpl = p.get("template");
    if (st || tq || tpl) {
      if (st) setFilter(st);
      if (tq) setQ(tq);
      if (tpl) setTemplate(tpl);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(FILTERS_KEY) || "null");
      if (saved && Date.now() - (saved.savedAt || 0) < INACTIVITY_MS) {
        setFilter(saved.filter || "all");
        setQ(saved.q || "");
        setName(saved.name || "");
        setFrom(saved.from || "");
        setTo(saved.to || "");
        setTemplate(saved.template || "");
      } else {
        localStorage.removeItem(FILTERS_KEY);
      }
    } catch { /* ignore */ }
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

  const clearFilters = () => { setFilter("all"); setQ(""); setName(""); setFrom(""); setTo(""); setTemplate(""); };
  const anyFilter = filter !== "all" || q || name || from || to || template;

  useEffect(() => {
    try {
      if (anyFilter) localStorage.setItem(FILTERS_KEY, JSON.stringify({ filter, q, name, from, to, template, savedAt: Date.now() }));
      else localStorage.removeItem(FILTERS_KEY);
    } catch { /* ignore */ }
    if (!anyFilter) return;
    const id = setTimeout(() => { clearFilters(); try { localStorage.removeItem(FILTERS_KEY); } catch { /* ignore */ } }, INACTIVITY_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, q, name, from, to, template]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  useEffect(() => {
    const iv = setInterval(load, 40000);
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  useEffect(() => { fetch("/api/schedules").then((r) => r.json()).then((d) => setDue(d.summary || null)).catch(() => {}); }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("queued") === "1") {
      setQueuedNotice(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
    const onSynced = () => { setQueuedNotice(false); load(); };
    window.addEventListener("qsl:outbox-synced", onSynced);
    return () => window.removeEventListener("qsl:outbox-synced", onSynced);
  }, [load]);

  const exportCsv = () => {
    const rows = [["serial", "template", "author", "client", "site", "weighbridge", "photos", "findings", "status", "report_date", "filed_at"]].concat(
      (reports || []).map((r) => [r.serial, r.templateName, r.authorName, r.clientName, r.site, r.weighbridgeId, r.photoCount, r.findingsCount, r.status, r.reportDate || r.createdAt, r.createdAt])
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "qsl_report_register.csv";
    a.click();
  };

  const recentCount = (reports || []).filter(isRecent).length;

  return (
    <div>
      <style>{`.reg-row{transition:background .1s}.reg-row:hover{background:#f1ead9 !important}`}</style>

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">{profile.role.replace("_", " ")}</p>
          <h1 className="h1" style={{ margin: 0 }}>Report registry</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          <button className="btn btn-dark" onClick={exportCsv} style={{ fontSize: 12 }}>Export CSV</button>
          {isAdmin && <a className="btn btn-primary" href="/api/reports/export" style={{ fontSize: 12 }}>Export Excel</a>}
        </div>
      </div>

      {queuedNotice && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginTop: 12, borderColor: WAIT, borderLeftWidth: 5 }} role="status">
          <span style={{ fontSize: 18 }}>📩</span>
          <span style={{ fontSize: 13, color: INK, fontWeight: 700 }}>Report saved on this device.<span style={{ color: MUTE, fontWeight: 400 }}> It will be sent automatically as soon as you have a network connection.</span></span>
        </div>
      )}

      {due && (due.overdue > 0 || due.dueSoon > 0) && (
        <Link href="/schedule" className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginTop: 12, textDecoration: "none", borderColor: due.overdue > 0 ? FAIL : WAIT, borderLeftWidth: 5 }}>
          <span style={{ fontSize: 20 }}>🛠️</span>
          <span style={{ fontSize: 13, color: INK, fontWeight: 700 }}>
            {due.overdue > 0 && <span style={{ color: FAIL }}>{due.overdue} overdue</span>}
            {due.overdue > 0 && due.dueSoon > 0 && " · "}
            {due.dueSoon > 0 && <span style={{ color: WAIT }}>{due.dueSoon} due soon</span>}
            <span style={{ color: MUTE, fontWeight: 400 }}> — open maintenance schedule →</span>
          </span>
        </Link>
      )}

      {/* Filters — status chips + search on one line; extra filters tuck away. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", margin: "12px 0 8px" }}>
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className="btn" style={filter === k ? { background: COAL, color: GOLD, borderColor: COAL, fontSize: 12 } : { fontSize: 12 }}>{l}</button>
        ))}
        <input className="input" placeholder="Search serial, author, site, weighbridge…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: "1 1 220px", minWidth: 180, fontSize: 13 }} />
        <button className="btn" onClick={() => setShowMore((v) => !v)} style={{ fontSize: 12 }}>{showMore ? "Fewer filters" : "More filters"}</button>
        {anyFilter && <button className="btn" onClick={clearFilters} style={{ fontSize: 12, color: FAIL }}>Clear</button>}
      </div>

      {(showMore || template) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end", marginBottom: 10 }}>
          <label className="field" style={{ margin: 0, flex: "1 1 180px" }}>
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
          {template && (
            <button onClick={() => setTemplate("")} className="btn" style={{ fontSize: 12, background: COAL, color: GOLD, borderColor: COAL, height: 42 }}>Form: {template} ✕</button>
          )}
        </div>
      )}

      {/* Count line */}
      {reports && (
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span><b style={{ color: INK }}>{reports.length}</b> record{reports.length === 1 ? "" : "s"}{anyFilter ? " match your filters" : ""} · click a row for full detail</span>
          {recentCount > 0 && <span style={{ background: GOLD, color: COAL, fontWeight: 800, fontSize: 11, padding: "2px 8px", borderRadius: 999 }}>{recentCount} new · last 24h</span>}
        </div>
      )}

      {reports === null && <div className="muted">Loading registry…</div>}
      {reports && reports.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          {anyFilter ? "No reports match these filters. Try widening the dates or clearing filters." : `Nothing here yet. ${profile.role === "TECHNICIAN" || profile.role === "ENGINEER" ? "Tap New report to start." : ""}`}
        </div>
      )}

      {reports && reports.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
              <thead>
                <tr style={{ background: COAL, color: "#fff", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  <Th>Date</Th>
                  <Th>Serial</Th>
                  <Th>Service</Th>
                  <Th>Weighbridge</Th>
                  <Th>Client / Branch</Th>
                  <Th>Filed by</Th>
                  <Th center>Photos</Th>
                  <Th center>Findings</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => {
                  const recent = isRecent(r);
                  const backdated = isAdmin && r.reportDate && new Date(r.reportDate).toDateString() !== new Date(r.createdAt).toDateString();
                  return (
                    <tr
                      key={r.serial}
                      className="reg-row"
                      onClick={() => router.push(`/reports/${r.serial}`)}
                      style={{ cursor: "pointer", borderTop: "1px solid #eee4d0", background: recent ? "#fffdf4" : i % 2 ? "#faf7f0" : "#fff", boxShadow: recent ? `inset 3px 0 0 ${GOLD}` : "none" }}
                    >
                      <td style={td} title={new Date(r.reportDate || r.createdAt).toLocaleString()}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{shortDate(r.reportDate || r.createdAt)}</span>
                        {backdated && <span className="muted" style={{ fontSize: 9.5, display: "block" }}>backdated</span>}
                      </td>
                      <td style={td}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "#7a5c00" }}>{r.serial}</span>
                        {recent && <span style={{ marginLeft: 6, background: GOLD, color: COAL, fontSize: 9, fontWeight: 900, letterSpacing: ".04em", padding: "1px 5px", borderRadius: 3 }}>NEW</span>}
                      </td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.templateName}</td>
                      <td style={{ ...td, color: r.weighbridgeId ? INK : "#b8af9e", fontFamily: r.weighbridgeId ? "var(--mono)" : "inherit", fontSize: 12 }}>{r.weighbridgeId || "—"}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 700, color: INK }}>{r.clientName || "—"}</div>
                        {r.site ? <div className="muted" style={{ fontSize: 11 }}>{r.site}</div> : null}
                      </td>
                      <td style={td}>{r.authorName || "—"}</td>
                      <td style={{ ...td, textAlign: "center", color: MUTE }}>{r.photoCount || "—"}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {r.findingsCount > 0 ? <span style={{ color: "#fff", background: FAIL, fontWeight: 800, fontSize: 11, padding: "1px 7px", borderRadius: 999 }}>{r.findingsCount}</span> : <span style={{ color: "#b8af9e" }}>—</span>}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}><Pill status={r.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const td = { padding: "8px 12px", fontSize: 13, color: INK, verticalAlign: "middle" };

function Th({ children, center }) {
  return <th style={{ padding: "9px 12px", textAlign: center ? "center" : "left", fontWeight: 800, whiteSpace: "nowrap" }}>{children}</th>;
}
