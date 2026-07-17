"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaperCard, SectionBar, Field, Textarea } from "./ui";
import { rolesOf } from "@/lib/roles";
import { WAIT } from "@/lib/theme";

// Client raises a quote request; PM/TM start a quotation for a client (then fill
// the line items on the next screen).
export default function QuotationNew({ profile, calibrationRequestId }) {
  const router = useRouter();
  const clientOnly = rolesOf(profile).length > 0 && rolesOf(profile).every((r) => r === "CLIENT");

  const [clientName, setClientName] = useState("");
  const [contactPerson, setContactPerson] = useState(profile.name || "");
  const [contactEmail, setContactEmail] = useState(profile.email || "");
  const [requestNote, setRequestNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    if (!clientOnly && !clientName.trim() && !calibrationRequestId) return setMsg("Enter the client.");
    setBusy(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          contactPerson: contactPerson.trim(),
          contactEmail: contactEmail.trim(),
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
          <Field label="Client" value={clientName} onChange={setClientName} placeholder="e.g. Kapa Oil Refineries" />
        )}
        <div className="grid md-2">
          <Field label="Contact person" value={contactPerson} onChange={setContactPerson} />
          <Field label="Contact email" type="email" value={contactEmail} onChange={setContactEmail} />
        </div>
        <Textarea label={clientOnly ? "What would you like quoted?" : "Request note"} value={requestNote} onChange={setRequestNote} rows={4} />

        {msg && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, margin: "10px 0" }}>{msg}</div>}
        <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ width: "100%", padding: 13, marginTop: 12 }}>
          {busy ? "Sending…" : clientOnly ? "Send request" : "Create & add items"}
        </button>
      </PaperCard>
    </div>
  );
}
