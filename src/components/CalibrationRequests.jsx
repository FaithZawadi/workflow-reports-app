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

  useEffect(() => {
    fetch("/api/calibration-requests")
      .then((r) => r.json())
      .then((d) => setRows(d.requests || []))
      .catch(() => setRows([]));
  }, []);

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

      {rows === null && <div className="muted" style={{ marginTop: 16 }}>Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE, marginTop: 16 }}>
          No calibration requests yet.{isClient(profile) ? " Tap “New request” to ask QSL to calibrate your instruments." : ""}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", marginTop: 16 }}>
        {(rows || []).map((r) => {
          const n = Array.isArray(r.equipment) ? r.equipment.length : 0;
          return (
            <Link key={r.id} href={`/calibration-requests/${r.id}`} className="card" style={{ textDecoration: "none", display: "block", padding: 0, overflow: "hidden" }}>
              <div className="stripe" style={{ height: 4 }} />
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, background: COAL, color: GOLD, padding: "2px 6px" }}>{r.serial}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div style={{ fontWeight: 900, fontSize: 14, marginTop: 8, color: INK }}>{r.clientName}</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  {n} instrument{n === 1 ? "" : "s"} · {r.calibrationType === "IN_SITU" ? "In situ" : r.calibrationType === "LAB" ? "Lab" : "type not set"}
                </div>
                <div className="muted" style={{ marginTop: 2, fontSize: 12 }}>{new Date(r.createdAt).toLocaleDateString()}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
