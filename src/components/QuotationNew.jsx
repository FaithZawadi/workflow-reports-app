"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PaperCard, SectionBar, Field, Textarea } from "./ui";
import { rolesOf } from "@/lib/roles";
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
              <Link href="/clients" style={{ color: "#8a6d00", fontWeight: 700 }}>Register the client first</Link> (with its full details).
            </span>
          </label>
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
