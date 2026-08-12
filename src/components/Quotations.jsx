"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { rolesOf, isClient } from "@/lib/roles";
import { StatusBadge } from "./CalibrationRequests";
import { COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const QUOTE_STATUS = {
  REQUESTED: { label: "Requested", color: WAIT },
  QUOTED: { label: "Quoted", color: COAL },
  ACCEPTED: { label: "Accepted", color: PASS },
  DECLINED: { label: "Declined", color: FAIL },
};

const money = (n, cur) => `${cur || "KES"} ${Number(n || 0).toLocaleString()}`;

const SORTS = {
  newest: { label: "Newest first", cmp: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  oldest: { label: "Oldest first", cmp: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
  value: { label: "Highest value", cmp: (a, b) => Number(b.grandTotal || 0) - Number(a.grandTotal || 0) },
  client: { label: "Client A–Z", cmp: (a, b) => String(a.clientName || "").localeCompare(String(b.clientName || "")) },
};

export default function Quotations({ profile }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("newest");
  const client = isClient(profile);
  const canStart = client || rolesOf(profile).some((r) => ["ADMIN", "PROJECT_MANAGER", "TECHNICAL_MANAGER", "TECHNICIAN", "SALES"].includes(r));

  useEffect(() => {
    fetch("/api/quotations")
      .then((r) => r.json())
      .then((d) => setRows(d.quotations || []))
      .catch(() => setRows([]));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (!needle) return true;
      return [r.number, r.clientName, r.subject, r.title].some((v) => String(v || "").toLowerCase().includes(needle));
    });
    return out.sort((SORTS[sort] || SORTS.newest).cmp);
  }, [rows, q, status, sort]);

  const counts = useMemo(() => {
    const c = { ALL: rows?.length || 0 };
    for (const k of Object.keys(QUOTE_STATUS)) c[k] = 0;
    for (const r of rows || []) if (c[r.status] != null) c[r.status]++;
    return c;
  }, [rows]);

  const hasFilters = q.trim() || status !== "ALL";

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Sales</p>
          <h1 className="h1">Quotations</h1>
        </div>
        {canStart && (
          <Link href="/quotations/new" className="btn btn-primary" style={{ fontSize: 13, textDecoration: "none" }}>
            {client ? "+ Request a quote" : "+ New quotation"}
          </Link>
        )}
      </div>

      {rows === null && <div className="muted" style={{ marginTop: 16 }}>Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE, marginTop: 16 }}>
          No quotations yet.{client ? " Tap “Request a quote” to ask QSL for pricing." : ""}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            placeholder="Search number, client or subject…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: "1 1 220px", minWidth: 180 }}
          />
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} style={{ flex: "0 0 auto", width: "auto" }}>
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button type="button" className="btn" onClick={() => { setQ(""); setStatus("ALL"); }} style={{ fontSize: 12 }}>
              Clear
            </button>
          )}
          <div style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[["ALL", "All"], ...Object.entries(QUOTE_STATUS).map(([k, v]) => [k, v.label])].map(([k, label]) => {
              const on = status === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setStatus(k)}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "5px 10px",
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor: on ? COAL : "#d8d1c2",
                    background: on ? COAL : "#fff",
                    color: on ? "#fff" : INK,
                    cursor: "pointer",
                  }}
                >
                  {label} <span style={{ opacity: 0.7 }}>· {counts[k] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filtered && rows.length > 0 && filtered.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE, marginTop: 16 }}>
          No quotations match your filters.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", marginTop: 16 }}>
        {(filtered || []).map((q) => (
          <Link key={q.id} href={`/quotations/${q.id}`} className="card" style={{ textDecoration: "none", display: "block", padding: 0, overflow: "hidden" }}>
            <div className="stripe" style={{ height: 4 }} />
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, background: COAL, color: GOLD, padding: "2px 6px" }}>{q.number}</span>
                <StatusBadge status={q.status} map={QUOTE_STATUS} />
              </div>
              <div style={{ fontWeight: 900, fontSize: 14, marginTop: 8, color: INK }}>{q.clientName}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginTop: 4 }}>
                {q.status === "REQUESTED" ? <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Awaiting pricing</span> : money(q.grandTotal, q.currency)}
              </div>
              <div className="muted" style={{ marginTop: 2, fontSize: 12 }}>
                {new Date(q.createdAt).toLocaleDateString()}
                {q.validUntil ? ` · valid to ${new Date(q.validUntil).toLocaleDateString()}` : ""}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export { QUOTE_STATUS };
