"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaperCard, SectionBar, Field, Textarea } from "./ui";
import { rolesOf } from "@/lib/roles";
import { GOLD, COAL, INK, MUTE, WAIT } from "@/lib/theme";

const BLANK = { name: "", makeModel: "", serialNo: "", capacity: "", division: "", location: "", remarks: "" };
const COLS = [
  ["name", "Equipment name"],
  ["makeModel", "Manufacturer / model"],
  ["serialNo", "Serial no."],
  ["capacity", "Capacity"],
  ["division", "Division (d)"],
  ["location", "Location"],
  ["remarks", "Remarks"],
];

export default function CalibrationRequestForm({ profile }) {
  const router = useRouter();
  const clientOnly = rolesOf(profile).length > 0 && rolesOf(profile).every((r) => r === "CLIENT");

  const [clientName, setClientName] = useState(profile.clientName || "");
  const [contactPerson, setContactPerson] = useState(profile.name || "");
  const [address, setAddress] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState(profile.email || "");
  const [rows, setRows] = useState([{ ...BLANK }, { ...BLANK }]);
  const [calibrationType, setCalibrationType] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [additionalRequests, setAdditionalRequests] = useState("");
  const [declarationName, setDeclarationName] = useState(profile.name || "");
  const [declarationDesignation, setDeclarationDesignation] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const setRow = (i, k, v) => setRows((s) => s.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addRow = () => setRows((s) => (s.length >= 20 ? s : [...s, { ...BLANK }]));
  const removeRow = (i) => setRows((s) => (s.length <= 1 ? s : s.filter((_, idx) => idx !== i)));

  const submit = async () => {
    setMsg("");
    if (!clientOnly && !clientName.trim()) return setMsg("Enter the client name.");
    if (!rows.some((r) => r.name.trim())) return setMsg("Add at least one instrument to calibrate.");
    if (!confirmed) return setMsg("Please confirm the declaration before sending.");
    setBusy(true);
    try {
      const res = await fetch("/api/calibration-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          contactPerson: contactPerson.trim(),
          address: address.trim(),
          telephone: telephone.trim(),
          email: email.trim(),
          equipment: rows,
          calibrationType: calibrationType || null,
          preferredDate: preferredDate || null,
          additionalRequests: additionalRequests.trim(),
          declarationName: declarationName.trim(),
          declarationDesignation: declarationDesignation.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || "Could not send the request.");
        setBusy(false);
        return;
      }
      router.push(`/calibration-requests/${d.id}`);
    } catch {
      setMsg("Network problem — please try again.");
      setBusy(false);
    }
  };

  return (
    <div>
      <button onClick={() => router.push("/calibration-requests")} style={{ background: "none", border: 0, color: WAIT, fontWeight: 700, fontSize: 13, marginTop: 12 }}>
        ← Back
      </button>
      <PaperCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div>
            <p className="eyebrow">Non-automatic weighing instrument</p>
            <h1 className="h1">Calibration request</h1>
          </div>
          <span className="mono" style={{ fontSize: 11, color: GOLD, background: COAL, padding: "3px 6px" }}>CRF-NAWI</span>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Qalibrated Systems Limited Calibration Laboratory. A request number is assigned when you send it.</p>

        <SectionBar>1. Client information</SectionBar>
        <div className="grid md-2">
          {!clientOnly && <Field label="Client name" value={clientName} onChange={setClientName} placeholder="e.g. Kapa Oil Refineries" />}
          <Field label="Contact person" value={contactPerson} onChange={setContactPerson} />
          <Field label="Address" value={address} onChange={setAddress} />
          <Field label="Telephone" value={telephone} onChange={setTelephone} />
          <Field label="Email" type="email" value={email} onChange={setEmail} />
        </div>

        <SectionBar>2. Equipment / instrument details</SectionBar>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 720 }}>
            <div style={{ display: "grid", gridTemplateColumns: "28px repeat(7, 1fr) 28px", gap: 4, marginBottom: 4 }}>
              <span />
              {COLS.map(([, label]) => (
                <span key={label} style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: COAL, padding: "4px 5px" }}>{label}</span>
              ))}
              <span />
            </div>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "28px repeat(7, 1fr) 28px", gap: 4, marginBottom: 4, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: MUTE, textAlign: "center" }}>{i + 1}</span>
                {COLS.map(([k]) => (
                  <input key={k} className="input" value={r[k]} onChange={(e) => setRow(i, k, e.target.value)} style={{ fontSize: 13, padding: "7px 6px" }} />
                ))}
                <button onClick={() => removeRow(i)} title="Remove row" style={{ background: "none", border: 0, color: "#b03a2e", fontSize: 18, cursor: "pointer" }}>×</button>
              </div>
            ))}
          </div>
        </div>
        <button className="btn" onClick={addRow} style={{ fontSize: 12, marginTop: 4 }}>+ Add instrument</button>

        <SectionBar>3. Calibration details</SectionBar>
        <div className="grid md-2">
          <label className="field">
            <span className="label">Type of calibration</span>
            <select className="input" value={calibrationType} onChange={(e) => setCalibrationType(e.target.value)}>
              <option value="">— choose —</option>
              <option value="IN_SITU">In situ (on site)</option>
              <option value="LAB">Lab calibration</option>
            </select>
          </label>
          <Field label="Preferred calibration date" type="date" value={preferredDate} onChange={setPreferredDate} />
        </div>

        <SectionBar>4. Additional requests</SectionBar>
        <Textarea label="" value={additionalRequests} onChange={setAdditionalRequests} rows={3} />

        <SectionBar>5. Customer declaration</SectionBar>
        <p className="muted" style={{ fontSize: 13 }}>I confirm that the information provided above is correct and authorize calibration of the listed items.</p>
        <div className="grid md-2">
          <Field label="Name" value={declarationName} onChange={setDeclarationName} />
          <Field label="Designation" value={declarationDesignation} onChange={setDeclarationDesignation} />
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 14, color: INK }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ width: 18, height: 18 }} />
          I confirm the declaration above.
        </label>

        {msg && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, margin: "10px 0" }}>{msg}</div>}
        <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ width: "100%", padding: 13, marginTop: 14 }}>
          {busy ? "Sending…" : "Send calibration request"}
        </button>
      </PaperCard>
    </div>
  );
}
