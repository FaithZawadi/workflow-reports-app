"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PaperCard, SectionBar, Field, Textarea } from "./ui";
import { rolesOf, canRegisterClientsDirectly } from "@/lib/roles";
import { WAIT, MUTE } from "@/lib/theme";
import NewClientForm from "./NewClientForm";

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

  // Sites for the chosen client — the picker only appears when the client has
  // some (a client with none simply omits it). Optional on every quote.
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");
  useEffect(() => {
    if (clientOnly || !clientName.trim()) { setSites([]); return; }
    let cancelled = false;
    fetch(`/api/sites?client=${encodeURIComponent(clientName.trim())}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setSites(d.sites || []); })
      .catch(() => { if (!cancelled) setSites([]); });
    return () => { cancelled = true; };
  }, [clientName, clientOnly]);
  // If the client changes, drop a chosen site that's no longer offered.
  useEffect(() => {
    if (siteId && !sites.some((s) => s.id === siteId)) setSiteId("");
  }, [sites, siteId]);

  // Inline "add a site" to the selected (existing) client — mirrors the
  // new-client shortcut. Staff who may register clients directly get it.
  const [addingSite, setAddingSite] = useState(false);
  const [newSite, setNewSite] = useState("");
  const [siteBusy, setSiteBusy] = useState(false);
  const addSite = async () => {
    const name = newSite.trim();
    if (!name) return;
    if (!clientId) { setMsg("Pick the client first, then add its site."); return; }
    setSiteBusy(true);
    try {
      const res = await fetch("/api/sites/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, name }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error || "Could not add the site."); setSiteBusy(false); return; }
      const s = { id: d.site?.id, name: d.site?.name || name, clientId, client: clientName };
      setSites((arr) => (arr.some((x) => x.id === s.id) ? arr : [...arr, s]));
      if (s.id) setSiteId(s.id);
      setAddingSite(false);
      setNewSite("");
      if (d.site?.approvalStatus === "PENDING")
        setMsg("New site submitted for approval — you can still use it on this quotation.");
    } catch {
      setMsg("Network problem adding the site.");
    }
    setSiteBusy(false);
  };
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

  const onClientAdded = (c, _wasExisting, isPending) => {
    setClients((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, { id: c.id, name: c.name }]));
    setClientId(c.id);
    setClientName(c.name);
    setAdding(false);
    if (isPending) setMsg("New client submitted for approval — you can still use it on this quotation.");
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
          siteId: siteId || undefined,
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
                <button type="button" onClick={() => setAdding((a) => !a)} style={{ background: "none", border: 0, padding: 0, color: "#8a6d00", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
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
          <NewClientForm canAddDirectly onAdded={onClientAdded} onCancel={() => setAdding(false)} />
        )}

        {/* Site / location — appears only once a client is chosen; the dropdown
            shows only if that client has registered sites. Always optional. */}
        {!clientOnly && !calibrationRequestId && clientId && (sites.length > 0 || canAddClient) && (
          <label className="field">
            <span className="label">
              Site / location <span style={{ color: MUTE, fontWeight: 400, fontSize: 11 }}>(optional)</span>
            </span>
            {sites.length > 0 ? (
              <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <option value="">— no specific site —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{!s.clientId ? " (shared)" : ""}</option>
                ))}
              </select>
            ) : (
              <span className="muted" style={{ fontSize: 11.5, display: "block", color: MUTE }}>
                This client has no registered sites yet — a site is optional.
              </span>
            )}
            {canAddClient && (
              addingSite ? (
                <div style={{ marginTop: 8 }}>
                  <Field label="New site name" value={newSite} onChange={setNewSite} placeholder="e.g. Athi River plant" />
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button type="button" className="btn btn-primary" onClick={addSite} disabled={siteBusy} style={{ padding: "7px 14px", fontSize: 13 }}>
                      {siteBusy ? "Adding…" : "Add site"}
                    </button>
                    <button type="button" className="btn" onClick={() => { setAddingSite(false); setNewSite(""); }} style={{ padding: "7px 14px", fontSize: 13 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingSite(true)} style={{ background: "none", border: 0, padding: 0, marginTop: 6, color: "#8a6d00", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
                  + Add a site to this client
                </button>
              )
            )}
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
