"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PaperCard, SectionBar } from "./ui";
import { StatusBadge } from "./CalibrationRequests";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const CHECK_ROWS = [
  ["withinScope", "Instrument(s) within laboratory scope"],
  ["standardsAvailable", "Required standards available"],
  ["uncertaintyAchievable", "Measurement uncertainty achievable"],
  ["personnelAvailable", "Qualified personnel available"],
  ["impartialityRisk", "Risk to impartiality check on available personnel"],
  ["methodAvailable", "Calibration method available"],
];

const EQ = [
  ["name", "Equipment"],
  ["makeModel", "Manufacturer / model"],
  ["serialNo", "Serial no."],
  ["capacity", "Capacity"],
  ["division", "Division (d)"],
  ["location", "Location"],
  ["remarks", "Remarks"],
];

export default function CalibrationRequestDetail({ id, profile }) {
  const router = useRouter();
  const [req, setReq] = useState(null);
  const [canReview, setCanReview] = useState(false);
  const [err, setErr] = useState("");
  const [checklist, setChecklist] = useState({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch(`/api/calibration-requests/${id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) return setErr(d.error || "Could not load.");
        setReq(d.request);
        setCanReview(d.canReview);
        setChecklist(d.request.reviewChecklist || {});
        setReason(d.request.decisionReason || "");
      })
      .catch(() => setErr("Could not load."));
  }, [id]);

  const setCheck = (k, field, v) => setChecklist((s) => ({ ...s, [k]: { ...(s[k] || {}), [field]: v } }));

  const decide = async (status) => {
    setNote("");
    if (status === "REJECTED" && !reason.trim()) return setNote("Add a reason to reject.");
    setBusy(true);
    try {
      const res = await fetch(`/api/calibration-requests/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewChecklist: checklist, status, decisionReason: reason.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        setNote(d.error || "Could not save.");
        setBusy(false);
        return;
      }
      router.refresh();
      const r = await fetch(`/api/calibration-requests/${id}`).then((x) => x.json());
      setReq(r.request);
      setBusy(false);
    } catch {
      setNote("Network problem — try again.");
      setBusy(false);
    }
  };

  const saveChecklist = async () => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch(`/api/calibration-requests/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewChecklist: checklist }),
      });
      setNote(res.ok ? "Checklist saved." : "Could not save.");
    } catch {
      setNote("Network problem.");
    }
    setBusy(false);
  };

  if (err) return <div className="err" style={{ marginTop: 16 }}>{err}</div>;
  if (!req) return <div className="muted" style={{ marginTop: 24 }}>Loading…</div>;

  const equipment = Array.isArray(req.equipment) ? req.equipment : [];
  const decided = req.status !== "SUBMITTED";

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => router.push("/calibration-requests")} style={{ background: "none", border: 0, color: WAIT, fontWeight: 700, fontSize: 13 }}>
        ← Back
      </button>
      <PaperCard>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, background: COAL, color: GOLD, padding: "4px 8px" }}>{req.serial}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={req.status} />
            <a className="btn btn-dark" href={`/api/calibration-requests/${id}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>Download PDF</a>
          </div>
        </div>

        <h1 className="h1" style={{ marginTop: 10 }}>Calibration request — {req.clientName}</h1>
        <div className="muted" style={{ fontSize: 12 }}>
          {req.calibrationType === "IN_SITU" ? "In situ (on site)" : req.calibrationType === "LAB" ? "Lab calibration" : "type not set"}
          {req.preferredDate ? " · preferred " + new Date(req.preferredDate).toLocaleDateString() : ""} · raised {new Date(req.createdAt).toLocaleDateString()}
        </div>

        <SectionBar>Client information</SectionBar>
        <div style={{ fontSize: 14, color: INK, display: "grid", gap: 3 }}>
          <div><b>Contact:</b> {req.contactPerson || "-"}</div>
          <div><b>Address:</b> {req.address || "-"}</div>
          <div><b>Telephone:</b> {req.telephone || "-"}</div>
          <div><b>Email:</b> {req.email || "-"}</div>
        </div>

        <SectionBar>Instruments ({equipment.length})</SectionBar>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thd}>#</th>
                {EQ.map(([, l]) => <th key={l} style={thd}>{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {equipment.map((r, i) => (
                <tr key={i}>
                  <td style={tdc}>{i + 1}</td>
                  {EQ.map(([k]) => <td key={k} style={tdc}>{r?.[k] || ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {req.additionalRequests && (
          <>
            <SectionBar>Additional requests</SectionBar>
            <div style={{ fontSize: 14, color: INK }}>{req.additionalRequests}</div>
          </>
        )}

        <SectionBar>Customer declaration</SectionBar>
        <div style={{ fontSize: 14, color: INK }}>
          {req.declarationName || "-"}{req.declarationDesignation ? ` · ${req.declarationDesignation}` : ""}
          {req.declarationDate ? ` · ${new Date(req.declarationDate).toLocaleDateString()}` : ""}
        </div>

        {/* Laboratory review — PM / TM only */}
        {canReview && (
          <div className="card" style={{ marginTop: 16, padding: 14, borderColor: GOLD, background: "#fdf9ee" }}>
            <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK }}>Laboratory review</div>
            <p className="muted" style={{ fontSize: 12, margin: "4px 0 10px" }}>Complete the checklist, then accept or reject the request.</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520, fontSize: 13 }}>
                <thead><tr><th style={thd}>Review item</th><th style={thd}>Yes / No</th><th style={thd}>Remarks</th></tr></thead>
                <tbody>
                  {CHECK_ROWS.map(([k, label]) => (
                    <tr key={k}>
                      <td style={tdc}>{label}</td>
                      <td style={tdc}>
                        <select className="input" value={checklist[k]?.yn || ""} onChange={(e) => setCheck(k, "yn", e.target.value)} style={{ padding: "5px 6px", fontSize: 13 }} disabled={decided}>
                          <option value="">—</option>
                          <option value="YES">Yes</option>
                          <option value="NO">No</option>
                        </select>
                      </td>
                      <td style={tdc}>
                        <input className="input" value={checklist[k]?.remark || ""} onChange={(e) => setCheck(k, "remark", e.target.value)} style={{ padding: "5px 6px", fontSize: 13 }} disabled={decided} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!decided ? (
              <>
                <input className="input" placeholder="Reason (required to reject)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ margin: "10px 0" }} />
                {note && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{note}</div>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" onClick={saveChecklist} disabled={busy} style={{ fontSize: 13 }}>Save checklist</button>
                  <button className="btn" onClick={() => decide("ACCEPTED")} disabled={busy} style={{ flex: 1, minWidth: 120, background: PASS, color: "#fff", borderColor: PASS, fontWeight: 900, textTransform: "uppercase" }}>Accept</button>
                  <button className="btn" onClick={() => decide("REJECTED")} disabled={busy || !reason.trim()} style={{ flex: 1, minWidth: 120, background: reason.trim() ? FAIL : "#d8b4ac", color: "#fff", borderColor: reason.trim() ? FAIL : "#d8b4ac", fontWeight: 900, textTransform: "uppercase" }}>Reject</button>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 10, fontSize: 13, color: INK }}>
                <b>Decision:</b> <StatusBadge status={req.status} />{req.decisionReason ? ` — ${req.decisionReason}` : ""}
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Reviewed by {req.reviewedByName || "-"}{req.reviewedAt ? ` · ${new Date(req.reviewedAt).toLocaleString()}` : ""}</div>
                <Link href={`/quotations/new?calibrationRequestId=${req.id}`} className="btn btn-primary" style={{ fontSize: 13, textDecoration: "none", marginTop: 10, display: "inline-block" }}>
                  Prepare a quotation →
                </Link>
              </div>
            )}
          </div>
        )}

        {!canReview && decided && (
          <div className="card" style={{ marginTop: 16, padding: 14, borderLeftWidth: 5, borderColor: req.status === "ACCEPTED" ? PASS : FAIL }}>
            <b>Decision:</b> <StatusBadge status={req.status} />
            {req.decisionReason ? <div style={{ fontSize: 13, marginTop: 4 }}>{req.decisionReason}</div> : null}
          </div>
        )}
      </PaperCard>
    </div>
  );
}

const thd = { background: COAL, color: "#fff", fontSize: 11, fontWeight: 800, textAlign: "left", padding: "6px 8px", border: "1px solid #2c2720" };
const tdc = { padding: "6px 8px", border: "1px solid #e6e0d2", color: INK, verticalAlign: "top" };
