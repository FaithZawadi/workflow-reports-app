"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { rolesOf, isClient } from "@/lib/roles";
import { COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const STATUS = {
  SUBMITTED: { label: "Submitted", color: WAIT },
  ACCEPTED: { label: "Accepted", color: PASS },
  REJECTED: { label: "Not accepted", color: FAIL },
};

export function StatusBadge({ status, map }) {
  const s = (map || STATUS)[status] || { label: status, color: MUTE };
  return (
    <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#fff", background: s.color, padding: "2px 7px", borderRadius: 2, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

export default function CalibrationRequests({ profile }) {
  const [rows, setRows] = useState(null);
  const canFile = isClient(profile) || rolesOf(profile).includes("ADMIN") || rolesOf(profile).some((r) => ["PROJECT_MANAGER", "TECHNICAL_MANAGER"].includes(r));

  // Filters: free-text (serial / client name), client, who filed it, and a date range.
  const [q, setQ] = useState("");
  const [client, setClient] = useState("all");
  const [by, setBy] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    fetch("/api/calibration-requests")
      .then((r) => r.json())
      .then((d) => setRows(d.requests || []))
      .catch(() => setRows([]));
  }, []);

  const clientOpts = [...new Set((rows || []).map((r) => r.clientName).filter(Boolean))].sort();
  const byOpts = [...new Set((rows || []).map((r) => r.requestedByName).filter(Boolean))].sort();

  const filtered = (rows || []).filter((r) => {
    if (client !== "all" && r.clientName !== client) return false;
    if (by !== "all" && r.requestedByName !== by) return false;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      if (!`${r.serial} ${r.clientName || ""} ${r.site || ""}`.toLowerCase().includes(t)) return false;
    }
    if (from || to) {
      const d = new Date(r.createdAt);
      if (from && d < new Date(from + "T00:00:00")) return false;
      if (to && d > new Date(to + "T23:59:59")) return false;
    }
    return true;
  });

  const activeFilters = q.trim() || client !== "all" || by !== "all" || from || to;
  const reset = () => { setQ(""); setClient("all"); setBy("all"); setFrom(""); setTo(""); };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Calibration</p>
          <h1 className="h1">Calibration requests</h1>
        </div>
        {canFile && (
          <Link href="/calibration-requests/new" className="btn btn-primary" style={{ fontSize: 13, textDecoration: "none" }}>
            + New request
          </Link>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div className="card" style={{ padding: 12, marginTop: 14, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          <label className="field" style={{ margin: 0 }}>
            <span className="label">Search (no. / client / site)</span>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Kapa or CRF-00012" />
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span className="label">Client</span>
            <select className="input" value={client} onChange={(e) => setClient(e.target.value)}>
              <option value="all">All clients</option>
              {clientOpts.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {!isClient(profile) && (
            <label className="field" style={{ margin: 0 }}>
              <span className="label">Filed by</span>
              <select className="input" value={by} onChange={(e) => setBy(e.target.value)}>
                <option value="all">Anyone</option>
                {byOpts.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          )}
          <label className="field" style={{ margin: 0 }}>
            <span className="label">From</span>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span className="label">To</span>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {activeFilters && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="btn" style={{ fontSize: 12 }} onClick={reset}>Clear filters</button>
            </div>
          )}
        </div>
      )}

      {rows === null && <div className="muted" style={{ marginTop: 16 }}>Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE, marginTop: 16 }}>
          No calibration requests yet.{isClient(profile) ? " Tap “New request” to ask QSL to calibrate your instruments." : ""}
        </div>
      )}
      {rows && rows.length > 0 && filtered.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE, marginTop: 16 }}>
          No requests match these filters. <button className="btn" style={{ fontSize: 12, marginLeft: 6 }} onClick={reset}>Clear</button>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", marginTop: 16 }}>
        {filtered.map((r) => {
          const n = Array.isArray(r.equipment) ? r.equipment.length : 0;
          return (
            <Link key={r.id} href={`/calibration-requests/${r.id}`} className="card" style={{ textDecoration: "none", display: "block", padding: 0, overflow: "hidden" }}>
              <div className="stripe" style={{ height: 4 }} />
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, background: COAL, color: GOLD, padding: "2px 6px" }}>{r.serial}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div style={{ fontWeight: 900, fontSize: 14, marginTop: 8, color: INK }}>{r.clientName}{r.site ? <span className="muted" style={{ fontWeight: 400 }}> · {r.site}</span> : null}</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  {n} instrument{n === 1 ? "" : "s"} · {r.calibrationType === "IN_SITU" ? "In situ" : r.calibrationType === "LAB" ? "Lab" : "type not set"}
                </div>
                <div className="muted" style={{ marginTop: 2, fontSize: 12 }}>
                  {new Date(r.createdAt).toLocaleDateString()}{r.requestedByName ? ` · ${r.requestedByName}` : ""}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
