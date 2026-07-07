"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pill } from "./ui";
import { COAL, GOLD, INK, MUTE } from "@/lib/theme";

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

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch("/api/reports?" + params.toString());
    const data = await res.json();
    setReports(data.reports || []);
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
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
        </div>
      </div>

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

      <input className="input" placeholder="Search serial, author, site or weighbridge…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />

      {reports === null && <div className="muted">Loading registry…</div>}
      {reports && reports.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          Nothing here yet. {(profile.role === "TECHNICIAN" || profile.role === "ENGINEER") && "Tap New report to start."}
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
              <div className="muted" style={{ marginTop: 2, fontSize: 12 }}>
                by {r.authorName} · {new Date(r.createdAt).toLocaleDateString()}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
