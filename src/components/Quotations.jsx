"use client";
import { useEffect, useState } from "react";
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

export default function Quotations({ profile }) {
  const [rows, setRows] = useState(null);
  const client = isClient(profile);
  const canStart = client || rolesOf(profile).includes("ADMIN") || rolesOf(profile).some((r) => ["PROJECT_MANAGER", "TECHNICAL_MANAGER"].includes(r));

  useEffect(() => {
    fetch("/api/quotations")
      .then((r) => r.json())
      .then((d) => setRows(d.quotations || []))
      .catch(() => setRows([]));
  }, []);

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

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", marginTop: 16 }}>
        {(rows || []).map((q) => (
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
