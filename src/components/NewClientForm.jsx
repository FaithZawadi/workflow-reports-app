"use client";
import { useState } from "react";
import { GOLD, INK, MUTE } from "@/lib/theme";
import { REQUIRED_CLIENT_FIELDS } from "@/lib/clientFields";

// Inline "register a new client WITH its full details" card, shared by the
// report, quotation and calibration-request forms. A client can never be added
// with just a name — the required contact/address/PIN details must be filled.
// onAdded(client, wasExisting, isPending) is called on success.
export default function NewClientForm({ canAddDirectly, onAdded, onCancel }) {
  const [f, setF] = useState({ name: "", contactPerson: "", contactPhone: "", contactEmail: "", address: "", city: "", taxPin: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

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

  const F = ({ label, k, type = "text", placeholder }) => (
    <label className="field" style={{ margin: 0 }}>
      <span className="label">{label}</span>
      <input className="input" type={type} value={f[k]} onChange={set(k)} placeholder={placeholder || ""} />
    </label>
  );

  return (
    <div className="card" style={{ padding: 12, marginTop: 8, borderColor: GOLD }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: INK, marginBottom: 8 }}>Register a new client (all details required)</div>
      <div className="grid md-2" style={{ gap: 8 }}>
        <F label="Client name (in full)" k="name" placeholder="e.g. Kapa Oil Refineries Limited" />
        <F label="KRA PIN" k="taxPin" placeholder="e.g. P051XXXXXXA" />
        <F label="Contact person" k="contactPerson" placeholder="e.g. Jane Doe" />
        <F label="Contact phone" k="contactPhone" placeholder="+254 7XX XXX XXX" />
        <F label="Contact email" k="contactEmail" type="email" placeholder="client@company.com" />
        <F label="City / town" k="city" placeholder="e.g. Nakuru" />
      </div>
      <div style={{ marginTop: 8 }}>
        <F label="Physical / postal address" k="address" placeholder="e.g. Industrial Area, P.O Box 123-00100" />
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 6, color: MUTE }}>
        {canAddDirectly
          ? "Existing clients (any spelling) can’t be added again."
          : "Goes to a manager for approval — usable right away. Existing clients (any spelling) can’t be added again."}
      </div>
      {err && <div className="err" style={{ fontSize: 12, marginTop: 6 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-dark" style={{ fontSize: 12 }} disabled={busy} onClick={add}>{busy ? "Saving…" : "Register & use"}</button>
        {onCancel && <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
