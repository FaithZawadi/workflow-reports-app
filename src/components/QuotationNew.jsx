"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PaperCard, SectionBar, Field, Textarea } from "./ui";
import { rolesOf, canRegisterClientsDirectly } from "@/lib/roles";
import { WAIT, MUTE } from "@/lib/theme";

// Client raises a quote request; PM/TM start a quotation for a client (then fill
// the line items on the next screen).
export default function QuotationNew({ profile, calibrationRequestId }) {
  const router = useRouter();
  const clientOnly = rolesOf(profile).length > 0 && rolesOf(profile).every((r) => r === "CLIENT");

  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState([]);
  useEffect(() => {
    if (clientOnly) return;
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
  }, [clientOnly]);
  // A client raising their own request pre-fills their own details; staff start
  // blank and enter the CLIENT's contact details (not their own).
  const [contactPerson, setContactPerson] = useState(clientOnly ? profile.name || "" : "");
  const [contactEmail, setContactEmail] = useState(clientOnly ? profile.email || "" : "");
  const [contactPhone, setContactPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Quotation creators (PM/TM/managers/admin/Sales) may register a new client
  // right here, approved immediately. Technician-only users don't get this — they
  // must have new clients approved, so they register via the report flow instead.
  const canAddClient = !clientOnly && canRegisterClientsDirectly(profile);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [ncBusy, setNcBusy] = useState(false);
  const [ncErr, setNcErr] = useState("");

  const addClient = async () => {
    const name = newName.trim();
    setNcErr("");
    if (!name) return setNcErr("Enter the new client's name.");
    setNcBusy(true);
    try {
      const res = await fetch("/api/clients/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) {
        // If it already exists, adopt the existing record instead of erroring out.
        if (d.existing) {
          setClients((cs) => (cs.some((c) => c.id === d.existing.id) ? cs : [...cs, d.existing]));
          setClientId(d.existing.id);
          setClientName(d.existing.name);
          setAdding(false); setNewName("");
        } else {
          setNcErr(d.error || "Could not add the client.");
        }
        setNcBusy(false);
        return;
      }
      const c = d.client;
      setClients((cs) => [...cs, { id: c.id, name: c.name }]);
      setClientId(c.id);
      setClientName(c.name);
      setAdding(false); setNewName("");
    } catch {
      setNcErr("Network problem — please try again.");
    }
    setNcBusy(false);
  };

  const submit = async () => {
    setMsg("");
    if (!clientOnly && !clientId && !calibrationRequestId) return setMsg("Select the client. Not listed? Register it first.");
    setBusy(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: clientId || undefined,
          clientName: clientName.trim(),
          contactPerson: contactPerson.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          subject: subject.trim(),
          requestNote: requestNote.trim(),
          calibrationRequestId: calibrationRequestId || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || "Could not create.");
        setBusy(false);
        return;
      }
      router.push(`/quotations/${d.id}`);
    } catch {
      setMsg("Network problem — please try again.");
      setBusy(false);
    }
  };

  return (
    <div>
      <button onClick={() => router.push("/quotations")} style={{ background: "none", border: 0, color: WAIT, fontWeight: 700, fontSize: 13, marginTop: 12 }}>
        ← Back
      </button>
      <PaperCard>
        <p className="eyebrow">Sales</p>
        <h1 className="h1">{clientOnly ? "Request a quotation" : "New quotation"}</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          {clientOnly
            ? "Tell us what you'd like priced. Our team will prepare a quotation and send it back to you here."
            : "Start a quotation for a client, then add line items and issue it on the next screen."}
          {calibrationRequestId ? " Linked to the accepted calibration request." : ""}
        </p>

        <SectionBar>Details</SectionBar>
        {!clientOnly && !calibrationRequestId && (
          <label className="field">
            <span className="label">Client (company)</span>
            <select
              className="input"
              value={clientId}
              onChange={(e) => {
                const id = e.target.value;
                setClientId(id);
                setClientName(clients.find((c) => c.id === id)?.name || "");
              }}
            >
              <option value="">— select a registered client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="muted" style={{ fontSize: 11.5, marginTop: 4, display: "block", color: MUTE }}>
              Only registered clients appear here. Not listed?{" "}
              {canAddClient ? (
                <button type="button" onClick={() => { setAdding((a) => !a); setNcErr(""); }} style={{ background: "none", border: 0, padding: 0, color: "#8a6d00", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
                  {adding ? "Cancel" : "+ Add a new client"}
                </button>
              ) : (
                <>
                  <Link href="/clients" style={{ color: "#8a6d00", fontWeight: 700 }}>Register the client first</Link> (with its full details).
                </>
              )}
            </span>
          </label>
        )}
        {canAddClient && adding && (
          <div style={{ border: "1px solid #e6dfce", borderRadius: 6, padding: 12, margin: "4px 0 10px", background: "#fbf8f1" }}>
            <span className="label" style={{ display: "block", marginBottom: 6 }}>New client (company name)</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="input"
                style={{ flex: "1 1 220px" }}
                value={newName}
                placeholder="e.g. AEA Limited"
                autoCapitalize="words"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addClient(); } }}
              />
              <button type="button" className="btn btn-primary" onClick={addClient} disabled={ncBusy} style={{ padding: "10px 18px" }}>
                {ncBusy ? "Adding…" : "Add client"}
              </button>
            </div>
            <span className="muted" style={{ fontSize: 11, marginTop: 6, display: "block", color: MUTE }}>
              Added and approved immediately. You can fill its full details later under Clients.
            </span>
            {ncErr && <div style={{ color: WAIT, fontWeight: 700, fontSize: 12, marginTop: 6 }}>{ncErr}</div>}
          </div>
        )}
        <div className="grid md-2">
          <Field label="Client contact person" value={contactPerson} onChange={setContactPerson} placeholder="e.g. Jane Doe" />
          <Field label="Client email" type="email" value={contactEmail} onChange={setContactEmail} placeholder="client@company.com" />
        </div>
        <div className="grid md-2">
          <Field label="Client phone" value={contactPhone} onChange={setContactPhone} placeholder="+254 7XX XXX XXX" />
          {!clientOnly && <Field label="Subject / job" value={subject} onChange={setSubject} placeholder="e.g. Calibration & verification of weighbridge" />}
        </div>
        {clientOnly && (
          <Textarea label="What would you like quoted?" value={requestNote} onChange={setRequestNote} rows={4} />
        )}

        {msg && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, margin: "10px 0" }}>{msg}</div>}
        <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ width: "100%", padding: 13, marginTop: 12 }}>
          {busy ? "Sending…" : clientOnly ? "Send request" : "Create & add items"}
        </button>
      </PaperCard>
    </div>
  );
}
