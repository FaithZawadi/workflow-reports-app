"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PaperCard, SectionBar, Field, Textarea } from "./ui";
import { rolesOf, canRegisterClientsDirectly } from "@/lib/roles";
import { GOLD, COAL, INK, MUTE, WAIT } from "@/lib/theme";
import NewClientForm from "./NewClientForm";

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

  const canAddDirectly = canRegisterClientsDirectly(profile);
  const [clientName, setClientName] = useState(profile.clientName || "");
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [site, setSite] = useState("");
  // Inline add-new-client / add-new-site (registered, de-duplicated, approval-gated).
  const [addingClient, setAddingClient] = useState(false);
  const [addingSite, setAddingSite] = useState(false);
  const [nsName, setNsName] = useState("");
  const [nsBusy, setNsBusy] = useState(false);
  const [nsErr, setNsErr] = useState("");
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

  // Staff pick a registered client + site. Load the catalogues once.
  useEffect(() => {
    if (clientOnly) return;
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
    fetch("/api/sites").then((r) => r.json()).then((d) => setSites(d.sites || [])).catch(() => {});
  }, [clientOnly]);

  // Sites belonging to the chosen client (branch list), de-duplicated.
  const siteOptions = [...new Set(sites.filter((s) => s.clientId === clientId).map((s) => (s.name || "").trim()).filter(Boolean))];

  const pickClient = (id) => {
    setClientId(id);
    setClientName(clients.find((c) => c.id === id)?.name || "");
    setSite("");
  };

  const onClientAdded = (c, _wasExisting, isPending) => {
    setClients((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, { id: c.id, name: c.name }]));
    pickClient(c.id);
    setAddingClient(false);
    if (isPending) setMsg("New client submitted for approval — you can still use it on this request.");
  };

  const addNewSite = async () => {
    const name = nsName.trim();
    if (!name) return setNsErr("Enter the new site's name.");
    if (!clientId) return setNsErr("Pick the client first.");
    setNsBusy(true); setNsErr("");
    try {
      const res = await fetch("/api/sites/quick", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, name }) });
      const d = await res.json();
      if (!res.ok) {
        if (d.existing) { setSite(d.existing.name); setAddingSite(false); setNsName(""); }
        else setNsErr(d.error || "Could not add the site.");
        setNsBusy(false); return;
      }
      setSite(d.site.name);
      fetch("/api/sites").then((r) => r.json()).then((sd) => setSites(sd.sites || [])).catch(() => {});
      setAddingSite(false); setNsName("");
      if (d.site.approvalStatus === "PENDING") setMsg("New site submitted for approval — you can still use it on this request.");
    } catch { setNsErr("Network problem — try again."); }
    setNsBusy(false);
  };

  const submit = async () => {
    setMsg("");
    if (!clientOnly && !clientId) return setMsg("Select the client. Not listed? Add it first.");
    if (!rows.some((r) => r.name.trim())) return setMsg("Add at least one instrument to calibrate.");
    if (!confirmed) return setMsg("Please confirm the declaration before sending.");
    setBusy(true);
    try {
      const res = await fetch("/api/calibration-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: clientId || undefined,
          clientName: clientName.trim(),
          site: site.trim(),
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
        {!clientOnly && (
          <>
            <div className="grid md-2">
              <label className="field">
                <span className="label">Client (company)</span>
                <select className="input" value={clientId} onChange={(e) => pickClient(e.target.value)}>
                  <option value="">— select a registered client —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="label">Site / branch (optional)</span>
                {siteOptions.length ? (
                  <select className="input" value={site} onChange={(e) => setSite(e.target.value)} disabled={!clientId}>
                    <option value="">— select site —</option>
                    {siteOptions.map((sName) => <option key={sName} value={sName}>{sName}</option>)}
                    {site && !siteOptions.includes(site) && <option value={site}>{site}</option>}
                  </select>
                ) : (
                  <input className="input" value={site} onChange={(e) => setSite(e.target.value)} placeholder="e.g. Nakuru plant" disabled={!clientId} />
                )}
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
              {!addingClient
                ? <button type="button" className="btn" style={{ fontSize: 12 }} onClick={() => setAddingClient(true)}>+ New client</button>
                : null}
              {clientId && !addingSite
                ? <button type="button" className="btn" style={{ fontSize: 12 }} onClick={() => { setAddingSite(true); setNsErr(""); setNsName(""); }}>+ New site for {clientName}</button>
                : null}
            </div>

            {addingClient && (
              <NewClientForm canAddDirectly={canAddDirectly} onAdded={onClientAdded} onCancel={() => setAddingClient(false)} />
            )}
            {addingSite && (
              <div className="card" style={{ padding: 12, marginTop: 8, borderColor: GOLD }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: INK, marginBottom: 6 }}>Add a site to {clientName}</div>
                <label className="field"><span className="label">New site / branch</span>
                  <input className="input" value={nsName} onChange={(e) => setNsName(e.target.value)} placeholder="e.g. Eldoret depot" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewSite(); } }} />
                </label>
                <div className="muted" style={{ fontSize: 11.5 }}>Duplicate sites (any spelling) are blocked.</div>
                {nsErr && <div className="err" style={{ fontSize: 12, marginTop: 6 }}>{nsErr}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn btn-dark" style={{ fontSize: 12 }} disabled={nsBusy} onClick={addNewSite}>{nsBusy ? "Adding…" : "Add & use"}</button>
                  <button type="button" className="btn" style={{ fontSize: 12 }} onClick={() => setAddingSite(false)}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
        <div className="grid md-2" style={{ marginTop: clientOnly ? 0 : 4 }}>
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
