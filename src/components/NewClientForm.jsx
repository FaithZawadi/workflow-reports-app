"use client";
import { useState } from "react";
import { GOLD, INK, MUTE, WAIT } from "@/lib/theme";
import { REQUIRED_CLIENT_FIELDS } from "@/lib/clientFields";

// Inline "register a new client WITH its full details" card, shared by the
// report, quotation and calibration-request forms. A client can never be added
// with just a name — the required contact/address/PIN details must be filled.
// onAdded(client, wasExisting, isPending) is called on success.
//
// NOTE: the field inputs are inlined (not a nested component) on purpose — a
// component defined inside render is a NEW type every keystroke, which remounts
// the input and loses focus after one character.
export default function NewClientForm({ canAddDirectly, onAdded, onCancel }) {
  const [f, setF] = useState({ name: "", contactPerson: "", contactPhone: "", contactEmail: "", address: "", city: "", taxPin: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => { const v = e.target.value; setF((s) => ({ ...s, [k]: v })); };

  const add = async () => {
    setErr("");
    if (!f.name.trim()) return setErr("Enter the client's name in full.");
    const missing = REQUIRED_CLIENT_FIELDS.filter(([k]) => !String(f[k] || "").trim()).map(([, l]) => l);
    if (missing.length) return setErr(`Add the client's ${missing.join(", ")}.`);
    setBusy(true);
    try {
      const res = await fetch("/api/clients/quick", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const d = await res.json();
      if (!res.ok) {
        if (d.existing) onAdded(d.existing, true, false);
        else setErr(d.error || "Could not add the client.");
        setBusy(false);
        return;
      }
      onAdded(d.client, false, d.client.approvalStatus === "PENDING");
    } catch {
      setErr("Network problem — try again.");
    }
    setBusy(false);
  };

  const field = (label, k, type, placeholder) => (
    <label className="field" style={{ margin: 0 }}>
      <span className="label">{label}</span>
      <input className="input" type={type || "text"} value={f[k]} onChange={set(k)} placeholder={placeholder || ""} autoComplete="off" />
    </label>
  );

  return (
    <div className="card" style={{ padding: 12, marginTop: 8, borderColor: GOLD }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: INK, marginBottom: 8 }}>Register a new client (all details required)</div>
      <div className="grid md-2" style={{ gap: 8 }}>
        {field("Client name (in full)", "name", "text", "e.g. Kapa Oil Refineries Limited")}
        {field("KRA PIN", "taxPin", "text", "e.g. P051XXXXXXA")}
        {field("Contact person", "contactPerson", "text", "e.g. Jane Doe")}
        {field("Contact phone", "contactPhone", "text", "+254 7XX XXX XXX")}
        {field("Contact email", "contactEmail", "email", "client@company.com")}
        {field("City / town", "city", "text", "e.g. Nakuru")}
      </div>
      <div style={{ marginTop: 8 }}>
        {field("Physical / postal address", "address", "text", "e.g. Industrial Area, P.O Box 123-00100")}
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 6, color: MUTE }}>
        {canAddDirectly
          ? "Existing clients (any spelling) can’t be added again."
          : "Goes to a manager for approval — usable right away. Existing clients (any spelling) can’t be added again."}
      </div>
      {err && <div style={{ color: WAIT, fontWeight: 700, fontSize: 12, marginTop: 6 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-dark" style={{ fontSize: 12 }} disabled={busy} onClick={add}>{busy ? "Saving…" : "Register & use"}</button>
        {onCancel && <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
