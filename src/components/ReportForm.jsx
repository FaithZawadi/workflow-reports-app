"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PaperCard, SectionBar, Field, Textarea } from "./ui";
import CheckItem, { CheckHeader, CHECK_TABLE_MINWIDTH, defaultStates } from "./CheckItem";
import Photos from "./Photos";
import NewClientForm from "./NewClientForm";
import { templatesForRoles, templateByCode, isSingleApproval } from "@/lib/templates";
import { chainFor } from "@/lib/approvalChain";
import { rolesOf, canRegisterClientsDirectly } from "@/lib/roles";
import { enqueueReport } from "@/lib/outbox";
import { loadDraft, saveDraft, clearDraft, draftHasContent } from "@/lib/reportDraft";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

export default function ReportForm({ profile, prefill = {}, edit = null }) {
  const router = useRouter();

  const isEdit = !!edit;
  // The forms this user may file — the union across all of their roles.
  const available = templatesForRoles(rolesOf(profile));

  const editTpl = edit ? templateByCode(edit.template) : null;
  const prefillTpl = editTpl || (prefill.template ? available.find((t) => t.code === prefill.template) || null : null);

  // When editing, rebuild the working state from the stored report.
  const editPhotos =
    edit && Array.isArray(edit.photos)
      ? edit.photos.map((p) => ({
          src: p.dataUrl,
          caption: p.caption || "",
          takenAt: p.takenAt,
          gps: p.gpsLat != null ? { lat: p.gpsLat, lng: p.gpsLng, acc: p.gpsAcc } : null,
        }))
      : [];

  const [tpl, setTpl] = useState(prefillTpl);
  const [values, setValues] = useState(
    edit
      ? { ...(edit.data?.values || {}), weighbridgeId: edit.weighbridgeId || edit.data?.values?.weighbridgeId || "" }
      : prefill.weighbridgeId
      ? { weighbridgeId: prefill.weighbridgeId }
      : {}
  );
  const [checks, setChecks] = useState(edit?.data?.checks || {});
  const [grids, setGrids] = useState(edit?.data?.grids || {});
  const [runs, setRuns] = useState(edit?.data?.runs || {});
  const [photos, setPhotos] = useState(editPhotos);
  // Supporting PDF attachments (Site Instruction). {name, dataUrl, size}
  const [attachments, setAttachments] = useState([]);
  const [attachMsg, setAttachMsg] = useState("");
  const addAttachment = (file) => {
    if (!file) return;
    setAttachMsg("");
    if (file.type !== "application/pdf") return setAttachMsg("Only PDF files can be attached.");
    if (file.size > 15 * 1024 * 1024) return setAttachMsg("That PDF is over 15 MB — please attach a smaller file.");
    if (attachments.length >= 5) return setAttachMsg("Up to 5 PDFs can be attached.");
    const reader = new FileReader();
    reader.onload = () => setAttachments((a) => [...a, { name: file.name, dataUrl: String(reader.result), size: file.size }]);
    reader.onerror = () => setAttachMsg("Could not read that file.");
    reader.readAsDataURL(file);
  };
  const [clients, setClients] = useState([]);
  const [weighbridges, setWeighbridges] = useState([]);
  const [sites, setSites] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [managers, setManagers] = useState([]);
  const [technicalManagers, setTechnicalManagers] = useState([]);
  const [projectManagers, setProjectManagers] = useState([]);
  const [clientName, setClientName] = useState(edit ? edit.clientName || "" : profile.clientName || prefill.client || "");
  const [site, setSite] = useState(edit ? edit.site || "" : profile.site || prefill.site || "");
  const [supervisorEmails, setSupervisorEmails] = useState(
    edit
      ? (edit.supervisorEmails && edit.supervisorEmails.length ? edit.supervisorEmails : edit.supervisorEmail ? [edit.supervisorEmail] : [])
      : []
  );
  const [managerEmail, setManagerEmail] = useState(edit ? edit.managerEmail || "" : "");
  const [scheduleId] = useState(prefill.scheduleId || null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirming, setConfirming] = useState(false);
  // Draft state (new reports only). pendingDraft = a saved draft awaiting a
  // Resume/Discard decision; draftReady gates auto-save so we don't overwrite it
  // before the user decides; draftSavedAt drives the "saved" indicator.
  const [pendingDraft, setPendingDraft] = useState(null);
  const [draftReady, setDraftReady] = useState(isEdit);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  // Inline "register a brand-new client (with full details)" while filing.
  const [addingClient, setAddingClient] = useState(false);
  // Inline "add a NEW site to the already-chosen client".
  const [addingSite, setAddingSite] = useState(false);
  const [nsName, setNsName] = useState("");
  const [nsBusy, setNsBusy] = useState(false);
  const [nsErr, setNsErr] = useState("");

  // Validate the routing, then open the review dialog so the filer can re-read
  // everything before it is sent.
  const review = () => {
    setMsg("");
    const single = tpl ? isSingleApproval(tpl.code) : false;
    const ch = tpl ? chainFor(tpl.code) : null;
    if (!supervisorEmails.some((e) => /\S+@\S+\.\S+/.test(e)))
      return setMsg(ch ? `Add the ${ch.SUPERVISOR.label}.` : single ? "Add at least one Client." : "Add at least one Equipment User.");
    if (!single && !/\S+@\S+\.\S+/.test(managerEmail))
      return setMsg(ch ? `Add the ${ch.MANAGER.label}.` : "Enter the Client/Manager's email.");
    if (!clientName.trim()) return setMsg("Choose the client (plant).");
    setConfirming(true);
  };

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .catch(() => {});
    fetch("/api/users/directory")
      .then((r) => r.json())
      .then((d) => {
        setSupervisors(d.supervisors || []);
        setManagers(d.managers || []);
        setTechnicalManagers(d.technicalManagers || []);
        setProjectManagers(d.projectManagers || []);
      })
      .catch(() => {});
    fetch("/api/weighbridges")
      .then((r) => r.json())
      .then((d) => setWeighbridges(d.weighbridges || []))
      .catch(() => {});
    fetch("/api/sites")
      .then((r) => r.json())
      .then((d) => setSites(d.sites || []))
      .catch(() => {});
  }, []);

  // When a template is chosen, offer any saved draft for it (new reports only).
  useEffect(() => {
    if (isEdit || !tpl) return;
    const d = loadDraft(tpl.code);
    if (draftHasContent(d)) {
      setPendingDraft(d);
      setDraftReady(false);
    } else {
      setPendingDraft(null);
      setDraftReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl?.code]);

  // Auto-save the working report as a local draft (debounced). Held back until
  // any pending draft has been resumed/discarded so it isn't overwritten first.
  useEffect(() => {
    if (isEdit || !tpl || !draftReady) return;
    const t = setTimeout(() => {
      const res = saveDraft(tpl.code, { template: tpl.code, values, checks, grids, runs, photos, clientName, site, supervisorEmails, managerEmail });
      if (res) setDraftSavedAt(Date.now());
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, tpl, draftReady, values, checks, grids, runs, photos, clientName, site, supervisorEmails, managerEmail]);

  const resumeDraft = () => {
    const d = pendingDraft;
    if (!d) return;
    if (d.values) setValues(d.values);
    if (d.checks) setChecks(d.checks);
    if (d.grids) setGrids(d.grids);
    if (d.runs) setRuns(d.runs);
    if (Array.isArray(d.photos)) setPhotos(d.photos);
    if (d.clientName) setClientName(d.clientName);
    if (d.site) setSite(d.site);
    if (Array.isArray(d.supervisorEmails) && d.supervisorEmails.length) setSupervisorEmails(d.supervisorEmails);
    if (d.managerEmail) setManagerEmail(d.managerEmail);
    setPendingDraft(null);
    setDraftReady(true);
  };
  const discardDraft = () => {
    if (tpl) clearDraft(tpl.code);
    setPendingDraft(null);
    setDraftReady(true);
  };
  const saveDraftAndLeave = () => {
    if (!tpl) return setMsg("Pick a report type first.");
    const res = saveDraft(tpl.code, { template: tpl.code, values, checks, grids, runs, photos, clientName, site, supervisorEmails, managerEmail });
    if (res === false) return setMsg("Couldn't save the draft on this device — storage may be full.");
    router.push("/dashboard?draft=1");
  };

  // Add a brand-new client (+ optional site) inline. Server rejects any name
  // that already exists (any casing), so we never create a duplicate.
  const onClientAdded = (c, _wasExisting, isPending) => {
    setClients((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, { id: c.id, name: c.name }]));
    setClientName(c.name);
    setAddingClient(false);
    if (isPending) setMsg("New client submitted for approval — you can still use it on this report.");
  };

  // The chosen client's registry id (needed to add a site to it). Matched
  // case-insensitively against the loaded client list.
  const selectedClientId = (clients.find((c) => (c.name || "").trim().toLowerCase() === clientName.trim().toLowerCase()) || {}).id || null;

  // Add a NEW site to the already-chosen (existing) client. The server refuses a
  // duplicate (any casing) so a site is never double-added, and routes a
  // technician's site for approval.
  const addNewSite = async () => {
    const name = nsName.trim();
    if (!name) return setNsErr("Enter the new site's name.");
    if (!selectedClientId) return setNsErr("Pick the client first.");
    setNsBusy(true);
    setNsErr("");
    try {
      const res = await fetch("/api/sites/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientId, name }),
      });
      const d = await res.json();
      if (!res.ok) {
        // Already exists — just adopt it on the form.
        if (d.existing) { setSite(d.existing.name); setAddingSite(false); setNsName(""); }
        else setNsErr(d.error || "Could not add the site.");
        setNsBusy(false);
        return;
      }
      setSite(d.site.name);
      fetch("/api/sites").then((r) => r.json()).then((sd) => setSites(sd.sites || [])).catch(() => {});
      setAddingSite(false); setNsName("");
      if (d.site.approvalStatus === "PENDING") setMsg("New site submitted for approval — you can still use it on this report.");
    } catch {
      setNsErr("Network problem — try again.");
    }
    setNsBusy(false);
  };

  // Site options for the chosen client: registered sites PLUS the sites (branches)
  // carried by that client's weighbridges — so the dropdown is populated even when
  // no sites were registered separately. Weighbridge LABELS are deliberately
  // excluded — the site is the branch/location, the weighbridge is a separate field.
  const siteOptions = (() => {
    const c = (clientName || "").trim().toLowerCase();
    const fromSites = sites
      .filter((s) => !s.client || !c || String(s.client).toLowerCase() === c)
      .map((s) => s.name);
    const fromWbs = weighbridges
      .filter((w) => !c || (w.client || "").toLowerCase() === c)
      .map((w) => w.site)
      .filter(Boolean);
    return [...new Set([...fromSites, ...fromWbs].map((v) => String(v).trim()).filter(Boolean))];
  })();

  // Site and weighbridge are DISTINCT fields on every form. The technician's
  // assigned site (branch) auto-fills, and they pick the weighbridge from the
  // dropdown — both are shown and stored so client, site and weighbridge are all
  // visible on the report.
  const siteIsWeighbridge = false;

  // A technician files for their OWN assigned client + site. Those auto-fill and
  // are locked (read-only), so the only thing they choose is the weighbridge.
  const roles = profile.roles && profile.roles.length ? profile.roles : (profile.role ? [profile.role] : []);
  // The client(s) this user is assigned to — shown first as a convenience. Any
  // filer may still choose ANY client (or add a brand-new one), so this is a
  // prefill/shortcut, not a restriction.
  const assignedClients = Array.isArray(profile.assignedClients) ? profile.assignedClients : [];
  // Client approvers and quotation creators register clients outright; a
  // technician-only filer must route the new client to a chosen approval manager.
  const canApproveClient = canRegisterClientsDirectly(profile);

  const setV = (k, v) => setValues((s) => ({ ...s, [k]: v }));

  // Adopt a registered weighbridge onto the form: set the weighbridge, and fill
  // the client, site and equipment details FROM the registry so the report is
  // accurate and consistent. Only fills fields that are still empty, so a manual
  // choice is never overwritten. Shared by the picker and the auto-select below.
  const applyWeighbridge = (w) => {
    if (!w) return;
    if (!clientName && w.client) setClientName(w.client);
    if (!site && w.site) setSite(w.site);
    const keys = new Set();
    (tpl?.sections || []).forEach((sec) => { if (sec.type === "fields") sec.fields.forEach((f) => keys.add(f.k)); });
    setValues((s) => {
      const n = { ...s, weighbridgeId: w.label };
      if (keys.has("make") && w.makeModel) n.make = w.makeModel;
      if (keys.has("serialNo") && w.serialNo) n.serialNo = w.serialNo;
      if (keys.has("capacity") && w.capacity) n.capacity = w.capacity;
      if (keys.has("deckLength") && w.deckLength) n.deckLength = w.deckLength;
      return n;
    });
    if (w.managerEmail && !managerEmail) setManagerEmail(w.managerEmail);
  };

  // Auto-select the weighbridge for a technician with a single assigned unit, so
  // client / site / weighbridge are all populated with no manual step. Only for a
  // new report, and only when nothing has been chosen yet.
  useEffect(() => {
    if (isEdit || values.weighbridgeId || !weighbridges.length) return;
    const c = (clientName || "").trim().toLowerCase();
    const candidates = weighbridges.filter((w) => !c || (w.client || "").toLowerCase() === c);
    if (candidates.length === 1) applyWeighbridge(candidates[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weighbridges, clientName, tpl]);

  // WB02 live verdict
  const { worst, verdict, limit } = useMemo(() => {
    const diffs = [1, 2].map((r) => {
      const a = parseFloat(runs[`${r}a`]);
      const m = parseFloat(runs[`${r}m`]);
      const b = parseFloat(runs[`${r}b`]);
      if ([a, m, b].some((n) => isNaN(n))) return null;
      return Math.max(a, m, b) - Math.min(a, m, b);
    });
    const lim = parseFloat(values.limit);
    const w = Math.max(...diffs.map((d) => (d == null ? 0 : d)));
    const v = diffs.every((d) => d == null) || isNaN(lim) ? null : w <= lim;
    return { worst: w, verdict: v, limit: lim };
  }, [runs, values.limit]);

  const submit = async () => {
    setConfirming(false);
    setBusy(true);
    setMsg(isEdit ? "Saving changes…" : "Submitting…");

    // Best-effort location capture for geofencing (proof of on-site attendance).
    // Only on a new submission; a denial or timeout just leaves it unset. A
    // non-geofenced form (e.g. Site Instruction) never captures location.
    const geo = isEdit || tpl?.geofence === false
      ? null
      : await new Promise((resolve) => {
          if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
          );
        });

    const payload = {
      template: tpl.code,
      scheduleId: scheduleId || undefined,
      weighbridgeId: values.weighbridgeId || "",
      clientName: clientName.trim(),
      site: site.trim(),
      supervisorEmails: supervisorEmails.map((e) => e.trim()).filter(Boolean),
      managerEmail: managerEmail.trim(),
      values,
      checks,
      grids,
      runs,
      photos,
      attachments,
      ...(geo ? { filedLat: geo.lat, filedLng: geo.lng, filedAccuracy: geo.acc } : {}),
    };

    // Editing an existing report — save the correction (online only) and return
    // to the report. The change is stamped on the trail server-side.
    if (isEdit) {
      try {
        const res = await fetch(`/api/reports/${edit.serial}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setMsg(data.error || "Could not save changes.");
          setBusy(false);
          return;
        }
        router.push(`/reports/${edit.serial}`);
      } catch {
        setMsg("Network problem — changes not saved. Try again when you're online.");
        setBusy(false);
      }
      return;
    }

    // Save-and-forward: keep the report on the device and let the outbox deliver
    // it when the network returns.
    const queueOffline = async () => {
      try {
        await enqueueReport(payload);
        if (tpl) clearDraft(tpl.code); // it's in the outbox now
        window.dispatchEvent(new CustomEvent("qsl:outbox-queued"));
        router.push("/dashboard?queued=1");
        return true;
      } catch {
        return false;
      }
    };

    // No connection at all — don't even try the request; queue straight away.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (await queueOffline()) return;
      setMsg("Could not save on this device. Please try again.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Could not submit.");
        setBusy(false);
        return;
      }
      if (tpl) clearDraft(tpl.code); // submitted — drop the local draft
      router.push(`/reports/${data.serial}`);
    } catch {
      // The request failed to reach the server (dropped connection). Queue it
      // and move on instead of losing the technician's work.
      if (await queueOffline()) return;
      setMsg("Network problem. Try again.");
      setBusy(false);
    }
  };

  if (!tpl) {
    return (
      <div>
        <p className="eyebrow" style={{ marginTop: 12 }}>Start a new report</p>
        <h1 className="h1">Choose the sheet</h1>
        <p className="muted">Pick what you are doing today.</p>
        <div className="grid md-2" style={{ marginTop: 12 }}>
          {available.map((t) => (
            <button key={t.code} className="card" onClick={() => setTpl(t)} style={{ textAlign: "left", display: "flex", padding: 0 }}>
              <div style={{ width: 6, backgroundImage: `repeating-linear-gradient(45deg, ${GOLD} 0 6px, ${COAL} 6px 12px)` }} />
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 14, color: INK }}>{t.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: GOLD, background: COAL, padding: "2px 6px" }}>{t.code}</span>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>{t.desc}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: WAIT, marginTop: 4 }}>Filled by: {t.who}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const singleApproval = tpl ? isSingleApproval(tpl.code) : false;
  // Role-locked chains (e.g. Technical Report → Technical Manager then Project
  // Manager) relabel the two stages and route them to those role holders.
  const chain = tpl ? chainFor(tpl.code) : null;
  const stage1Label = chain ? `${chain.SUPERVISOR.label} — reviews first` : singleApproval ? "Client(s) — approves" : "Equipment User(s) — reviews first";
  const stage2Label = chain ? `${chain.MANAGER.label} — approves` : "Client/Manager (approves after review)";
  const stage1People = chain ? technicalManagers : supervisors;
  const stage2People = chain ? projectManagers : managers;
  const approvalPanel = (
    <div className="card" style={{ borderColor: GOLD, padding: 16 }}>
      <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK }}>Approval route</div>
      <div className="muted" style={{ margin: "4px 0 12px" }}>
        {chain
          ? `You → ${chain.SUPERVISOR.label} reviews → ${chain.MANAGER.label} approves. Each is emailed automatically.`
          : singleApproval
          ? "You → Client approves. The Client is emailed automatically; their approval completes the report."
          : "You → Equipment User reviews → Client/Manager approves. Each is emailed automatically."}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, background: "#efe8d6", color: INK, padding: "8px 10px", borderRadius: 2, marginBottom: 12 }}>
        Submitting as {profile.name}
        {clientName ? " · " + clientName : ""}
        {site ? " - " + site : ""}
      </div>
      <MultiReviewerPicker
        label={stage1Label}
        people={stage1People}
        value={supervisorEmails}
        onChange={setSupervisorEmails}
        placeholder={chain ? "technical.manager@qalibrated.com" : singleApproval ? "client@company.com" : "equipment.user@company.com"}
      />
      {chain && stage1People.length === 0 && (
        <div className="muted" style={{ fontSize: 11.5, marginTop: -4 }}>No {chain.SUPERVISOR.label} is registered yet — an admin can assign the role in Users.</div>
      )}
      {!singleApproval && (
        <ReviewerPicker
          label={stage2Label}
          people={stage2People}
          value={managerEmail}
          onChange={setManagerEmail}
          placeholder={chain ? "project.manager@qalibrated.com" : "client.manager@company.com"}
        />
      )}
      {msg && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, margin: "8px 0" }}>{msg}</div>}
      <button className="btn btn-primary" style={{ width: "100%", padding: "13px" }} disabled={busy} onClick={review}>
        {busy ? "Working…" : isEdit ? "Review & save changes" : "Review & submit"}
      </button>
      {!isEdit && tpl && (
        <>
          <button className="btn" style={{ width: "100%", padding: "12px", marginTop: 8 }} disabled={busy} onClick={saveDraftAndLeave}>
            Save draft &amp; leave
          </button>
          <div className="muted" style={{ fontSize: 11.5, textAlign: "center", marginTop: 6 }}>
            {draftSavedAt ? "Draft saved automatically on this device — resume it anytime." : "Your progress is saved to this device automatically."}
          </div>
        </>
      )}
    </div>
  );

  const filledCount =
    Object.values(values).filter((v) => v !== "" && v != null).length +
    Object.keys(checks).length;

  return (
    <div>
      {pendingDraft && !isEdit && (
        <div className="card" style={{ padding: 14, marginBottom: 12, borderColor: GOLD, background: "#fdf6e3" }}>
          <div style={{ fontWeight: 800, color: INK, fontSize: 14 }}>Resume your saved draft?</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            You have an unfinished {tpl ? tpl.name : "report"} on this device
            {pendingDraft.savedAt ? ` from ${new Date(pendingDraft.savedAt).toLocaleString()}` : ""}
            {pendingDraft.photosDropped ? " (photos weren't kept — they were too large to store)" : ""}.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={resumeDraft}>Resume draft</button>
            <button className="btn" style={{ fontSize: 13 }} onClick={discardDraft}>Start fresh</button>
          </div>
        </div>
      )}
      {confirming && (
        <div
          role="dialog"
          aria-label="Confirm before sending"
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(22,19,16,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setConfirming(false)}
        >
          <div className="card modal-card" style={{ maxWidth: 460, width: "100%", padding: 18, background: "#fff", borderColor: GOLD }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 14, color: INK }}>
              {isEdit ? "Re-read your changes" : "Please re-read before sending"}
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "6px 0 12px" }}>
              {isEdit
                ? "Your correction will be saved and stamped on the report's trail with your name and the time. Check the details below."
                : singleApproval
                ? "Once sent, this goes to your Client for approval. Check the details below are correct."
                : "Once sent, this goes to your Equipment User for review. Check the details below are correct."}
            </p>
            <div style={{ fontSize: 13, color: INK, display: "grid", gap: 4 }}>
              <div><b>Form:</b> {tpl.code} — {tpl.name}</div>
              <div><b>Client:</b> {clientName || "—"}</div>
              <div><b>Site / location:</b> {site || "—"}</div>
              {tpl.code !== "TR01" && <div><b>Weighbridge:</b> {values.weighbridgeId || "—"}</div>}
              <div><b>{chain ? chain.SUPERVISOR.label : singleApproval ? "Client" : "Equipment User"}{supervisorEmails.length > 1 ? "s" : ""}:</b> {supervisorEmails.join(", ") || "—"}</div>
              {!singleApproval && <div><b>{chain ? chain.MANAGER.label : "Client/Manager"}:</b> {managerEmail}</div>}
              <div><b>Entries filled:</b> {filledCount} · <b>Photos:</b> {photos.length}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => setConfirming(false)}>
                ← Keep editing
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={submit}>
                {busy ? "Saving…" : isEdit ? "Confirm & save" : "Confirm & send"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isEdit ? (
        <button onClick={() => router.push(`/reports/${edit.serial}`)} style={{ background: "none", border: 0, color: WAIT, fontWeight: 700, fontSize: 13, marginTop: 12 }}>
          ← Cancel edit
        </button>
      ) : (
        <button onClick={() => setTpl(null)} style={{ background: "none", border: 0, color: WAIT, fontWeight: 700, fontSize: 13, marginTop: 12 }}>
          ← Choose a different sheet
        </button>
      )}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr", marginTop: 8 }} className="report-grid">
        <PaperCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <h1 className="h1">{tpl.name}</h1>
            <span className="mono" style={{ fontSize: 11, color: GOLD, background: COAL, padding: "3px 6px" }}>{tpl.code}</span>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>Serial number is assigned when you submit.</p>

          {/* Client / Site. Any filer may pick ANY client (assigned ones are
              listed first as a shortcut) or add a brand-new one inline. */}
          <div className="grid md-2">
            <label className="field">
              <span className="label">Client (company)</span>
              <select className="input" value={clientName} onChange={(e) => { setClientName(e.target.value); setSite(""); }}>
                <option value="">— select client —</option>
                {assignedClients.length > 0 && (
                  <optgroup label="Your clients">
                    {assignedClients.map((c) => <option key={"a-" + c.id} value={c.name}>{c.name}</option>)}
                  </optgroup>
                )}
                <optgroup label="All clients">
                  {clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </optgroup>
                {clientName && !clients.some((c) => c.name === clientName) && !assignedClients.some((c) => c.name === clientName) && (
                  <option value={clientName}>{clientName}</option>
                )}
              </select>
            </label>
            <label className="field">
              <span className="label">Site / branch{profile.site ? " (your assigned site)" : ""}</span>
              {siteOptions.length || (site && !siteOptions.includes(site)) ? (
                <select className="input" value={site} onChange={(e) => setSite(e.target.value)}>
                  <option value="">— select site —</option>
                  {siteOptions.map((sName) => <option key={sName} value={sName}>{sName}</option>)}
                  {site && !siteOptions.includes(site) && <option value={site}>{site}</option>}
                </select>
              ) : (
                <input className="input" value={site} onChange={(e) => setSite(e.target.value)} placeholder="e.g. Magadi plant" />
              )}
            </label>
          </div>
          {clientName && !siteOptions.length && (
            <div className="muted" style={{ fontSize: 11.5, marginTop: -4 }}>No sites registered for {clientName} yet — type the site above, or add one below.</div>
          )}
          {/* Register a brand-new client (with full details) inline. */}
          {!isEdit && (!addingClient ? (
            <button type="button" className="btn" style={{ fontSize: 12, marginTop: 8 }} onClick={() => setAddingClient(true)}>+ New client</button>
          ) : (
            <NewClientForm canAddDirectly={canApproveClient} onAdded={onClientAdded} onCancel={() => setAddingClient(false)} />
          ))}

          {/* Add a NEW site to the already-chosen (existing) client. */}
          {!isEdit && !addingClient && selectedClientId && (!addingSite ? (
            <button type="button" className="btn" style={{ fontSize: 12, marginTop: 8 }} onClick={() => { setAddingSite(true); setNsErr(""); setNsName(""); }}>+ New site for {clientName}</button>
          ) : (
            <div className="card" style={{ padding: 12, marginTop: 8, borderColor: GOLD }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: INK, marginBottom: 6 }}>Add a site to {clientName}</div>
              <label className="field"><span className="label">New site / branch</span>
                <input className="input" value={nsName} onChange={(e) => setNsName(e.target.value)} placeholder="e.g. Eldoret depot" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewSite(); } }} />
              </label>
              <div className="muted" style={{ fontSize: 11.5 }}>
                {canApproveClient
                  ? "Only for a site not already listed for this client — duplicates (any spelling) are blocked."
                  : "The new site goes to a manager for approval. You can still use it on this report right away. Duplicate sites (any spelling) are blocked."}
              </div>
              {nsErr && <div className="err" style={{ fontSize: 12, marginTop: 6 }}>{nsErr}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-dark" style={{ fontSize: 12 }} disabled={nsBusy} onClick={addNewSite}>{nsBusy ? "Adding…" : "Add & use"}</button>
                <button type="button" className="btn" style={{ fontSize: 12 }} onClick={() => setAddingSite(false)}>Cancel</button>
              </div>
            </div>
          ))}

          {/* The Technical Report is a field-service report (scales, analysers,
              general equipment) — it is not tied to a weighbridge. */}
          {tpl.code !== "TR01" && (
            <div style={{ maxWidth: 460 }}>
              <WeighbridgePicker
                list={weighbridges.filter((w) => {
                  const c = (clientName || "").trim().toLowerCase();
                  return !c || (w.client || "").toLowerCase() === c;
                })}
                value={values.weighbridgeId}
                onType={(v) => setV("weighbridgeId", v)}
                onPick={(w) => applyWeighbridge(w)}
              />
            </div>
          )}

          {tpl.sections.map((sec, si) => {
            if (sec.type === "fields")
              return (
                <div key={si} className="grid md-2">
                  {sec.fields.map((f) => (
                    <Field key={f.k} label={f.label} type={f.inputType || "text"} value={values[f.k]} onChange={(v) => setV(f.k, v)} />
                  ))}
                </div>
              );
            if (sec.type === "checklist")
              return (
                <div key={si}>
                  <SectionBar>{sec.title}</SectionBar>
                  <div style={{ overflowX: "auto" }}>
                    {(() => {
                      const states = sec.states || defaultStates(sec.yes, sec.no);
                      return (
                        <div className="card" style={{ minWidth: CHECK_TABLE_MINWIDTH, marginBottom: 8, overflow: "hidden" }}>
                          <CheckHeader states={states} />
                          {sec.items.map((it, ii) => (
                            <CheckItem
                              key={ii}
                              text={it}
                              states={states}
                              val={checks[`${si}:${ii}`]}
                              onChange={(v) => setChecks((s) => ({ ...s, [`${si}:${ii}`]: v }))}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            if (sec.type === "textarea")
              return <div key={si}><SectionBar>{sec.label}</SectionBar><Textarea label="" value={values[sec.k]} onChange={(v) => setV(sec.k, v)} /></div>;
            if (sec.type === "choices" && sec.dropdown)
              return (
                <div key={si}>
                  <SectionBar>{sec.title}</SectionBar>
                  <select
                    className="input"
                    value={values[sec.k] || ""}
                    onChange={(e) => setV(sec.k, e.target.value)}
                    style={{ maxWidth: 420 }}
                  >
                    <option value="">Select…</option>
                    {sec.options.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              );

            if (sec.type === "choices") {
              // Multi-select stores the chosen options as a comma-joined string
              // (e.g. "Service, Repairs") so more than one kind of work done in
              // the same visit can be recorded. Single-select stores one string.
              const selected = sec.multi
                ? String(values[sec.k] || "").split(",").map((s) => s.trim()).filter(Boolean)
                : [];
              const isOn = (o) => (sec.multi ? selected.includes(o) : values[sec.k] === o);
              const toggle = (o) => {
                if (!sec.multi) return setV(sec.k, o);
                const next = selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o];
                // keep template order for a stable, readable value
                setV(sec.k, sec.options.filter((x) => next.includes(x)).join(", "));
              };
              return (
                <div key={si}>
                  <SectionBar>{sec.title}</SectionBar>
                  {sec.multi && <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>Pick all that apply.</p>}
                  <div className="grid md-2">
                    {sec.options.map((o) => (
                      <button
                        key={o}
                        onClick={() => toggle(o)}
                        style={{
                          textAlign: "left",
                          fontSize: 14,
                          padding: "10px 12px",
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: isOn(o) ? COAL : "#cfc8ba",
                          background: isOn(o) ? COAL : "#fff",
                          color: isOn(o) ? GOLD : INK,
                          fontWeight: isOn(o) ? 700 : 400,
                        }}
                      >
                        {sec.multi && <span style={{ marginRight: 8 }}>{isOn(o) ? "☑" : "☐"}</span>}
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }
            if (sec.type === "weekly")
              return (
                <div key={si}>
                  <SectionBar>End — Middle — End test (same truck)</SectionBar>
                  {[1, 2].map((r) => (
                    <div key={r} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr", gap: 8, marginBottom: 8, alignItems: "end", maxWidth: 560 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, paddingBottom: 10 }}>Run {r}</span>
                      {["a", "m", "b"].map((p, i) => (
                        <label key={p}>
                          <span style={{ fontSize: 11, color: MUTE }}>{["End A", "Middle", "End B"][i]} kg</span>
                          <input className="input" type="number" value={runs[`${r}${p}`] || ""} onChange={(e) => setRuns((s) => ({ ...s, [`${r}${p}`]: e.target.value }))} />
                        </label>
                      ))}
                    </div>
                  ))}
                  {verdict !== null && (
                    <div style={{ padding: 12, borderRadius: 2, fontSize: 14, fontWeight: 700, color: "#fff", background: verdict ? PASS : FAIL }}>
                      Biggest difference: {worst.toFixed(0)} kg (limit {limit} kg) —{" "}
                      {verdict ? "GOOD. Keep using the weighbridge." : "OVER THE LIMIT. Stop trade weighing and call QSL: +254 714 999 996."}
                    </div>
                  )}
                </div>
              );
            if (sec.type === "loadcells") {
              const unit = grids.lcUnit || "mV";
              const primaryLabel = unit === "ohm" ? "Impedance (Ω)" : "Output (mV)";
              const rows = [
                { key: "lc", label: primaryLabel },
                { key: "corner", label: "Corner (kg)" },
              ];
              return (
                <div key={si}>
                  <SectionBar>Load cell readings</SectionBar>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: MUTE }}>Measure:</span>
                    {[
                      { k: "mV", label: "Output (mV)" },
                      { k: "ohm", label: "Impedance (Ω)" },
                    ].map((opt) => (
                      <button
                        key={opt.k}
                        type="button"
                        onClick={() => setGrids((s) => ({ ...s, lcUnit: opt.k }))}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "6px 12px",
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: unit === opt.k ? COAL : "#cfc8ba",
                          background: unit === opt.k ? COAL : "#fff",
                          color: unit === opt.k ? GOLD : INK,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {rows.map((row) => (
                    <div key={row.key} style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: MUTE }}>{row.label}</span>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, marginTop: 4 }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <input key={i} className="input" type="number" style={{ textAlign: "right" }} placeholder={`#${i + 1}`} value={grids[`${row.key}:${i}`] || ""} onChange={(e) => setGrids((s) => ({ ...s, [`${row.key}:${i}`]: e.target.value }))} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            if (sec.type === "rows")
              return (
                <div key={si}>
                  <SectionBar>{sec.title}</SectionBar>
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${sec.cols.length}, minmax(90px,1fr))`, gap: 4, marginBottom: 4 }}>
                      {sec.cols.map((c) => (
                        <span key={c} style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: COAL, padding: "3px 4px" }}>{c}</span>
                      ))}
                    </div>
                    {Array.from({ length: sec.rows }).map((_, ri) => (
                      <div key={ri} style={{ display: "grid", gridTemplateColumns: `repeat(${sec.cols.length}, minmax(90px,1fr))`, gap: 4, marginBottom: 4 }}>
                        {sec.cols.map((col, ci) => {
                          const numeric = /\(kg\)|\(mv\)|\(Ω\)/i.test(col);
                          return (
                            <input key={ci} className="input" style={numeric ? { textAlign: "right" } : undefined} value={grids[`${sec.key}:${ri}:${ci}`] ?? (sec.prefill?.[ri]?.[ci] || "")} onChange={(e) => setGrids((s) => ({ ...s, [`${sec.key}:${ri}:${ci}`]: e.target.value }))} />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            return null;
          })}

          <Photos photos={photos} setPhotos={setPhotos} stampGps={tpl.geofence !== false} />
          <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
            {tpl.geofence === false
              ? "Attach sketches or site photos — these are not location-stamped."
              : `Photos are optional${tpl.code === "TR01" ? " — a technical report can be submitted without any" : ""}.`}
          </div>

          {tpl.allowAttachments !== false && (
            <div style={{ marginTop: 16 }}>
              <SectionBar>Attach a PDF</SectionBar>
              <div className="muted" style={{ fontSize: 11.5, margin: "2px 0 8px" }}>
                Attach a supporting PDF (drawing, schedule, scan). Its pages are added to the end of this document. Up to 5 PDFs, 15&nbsp;MB each.
              </div>
              {attachments.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid #e6dfce", borderRadius: 6, marginBottom: 6, background: "#fbf8f1" }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{(a.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button type="button" onClick={() => setAttachments((list) => list.filter((_, j) => j !== i))} style={{ background: "none", border: 0, color: FAIL, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Remove</button>
                </div>
              ))}
              {attachments.length < 5 && (
                <label className="btn" style={{ display: "inline-block", cursor: "pointer", fontSize: 13, padding: "8px 14px" }}>
                  + Add PDF
                  <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => { addAttachment(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              )}
              {attachMsg && <div style={{ color: WAIT, fontWeight: 700, fontSize: 12, marginTop: 6 }}>{attachMsg}</div>}
            </div>
          )}
          <div style={{ marginTop: 20 }}>{approvalPanel}</div>
        </PaperCard>
      </div>
    </div>
  );
}

// Pick a registered weighbridge from a dropdown (auto-fills the service form's
// make/model/serial/capacity). Falls back to a plain text field when none are
// registered for the client, or via "Other", so filing is never blocked.
function WeighbridgePicker({ list, value, onPick, onType }) {
  const selected = list.find((w) => w.label === value);
  const [manual, setManual] = useState(!!value && !selected);
  const showManual = list.length === 0 || manual;

  if (showManual) {
    return (
      <label className="field">
        <span className="label">Weighbridge</span>
        <input className="input" value={value || ""} placeholder="e.g. WB-1 Dispatch Gate" onChange={(e) => onType(e.target.value)} />
        {list.length > 0 && (
          <button type="button" onClick={() => setManual(false)} style={{ background: "none", border: 0, color: WAIT, fontWeight: 700, fontSize: 12, marginTop: 4, textAlign: "left", padding: 0 }}>
            ← pick from the register
          </button>
        )}
      </label>
    );
  }
  return (
    <label className="field">
      <span className="label">Weighbridge</span>
      <select
        className="input"
        value={selected ? selected.id : ""}
        onChange={(e) => {
          if (e.target.value === "__other") { setManual(true); onType(""); return; }
          const w = list.find((x) => x.id === e.target.value);
          if (w) onPick(w);
        }}
      >
        <option value="">— choose weighbridge —</option>
        {list.map((w) => (
          <option key={w.id} value={w.id}>{w.label}{w.site ? ` — ${w.site}` : ""}</option>
        ))}
        <option value="__other">Other (type it)…</option>
      </select>
    </label>
  );
}

// Pick a reviewer from registered staff. Falls back to a plain email input when
// no one with that role is registered yet, so filing is never blocked.
// Pick one or MORE Equipment Users. Any one of them can review the report; the
// first to act decides. Chosen people show as removable chips; extra addresses
// (not in the directory) can be typed in.
function MultiReviewerPicker({ label, people, value, onChange, placeholder }) {
  const [custom, setCustom] = useState("");
  const list = value || [];
  const has = (email) => list.some((e) => e.toLowerCase() === email.toLowerCase());
  const add = (email) => {
    const e = (email || "").trim();
    if (!e || has(e)) return;
    onChange([...list, e]);
  };
  const remove = (email) => onChange(list.filter((e) => e.toLowerCase() !== email.toLowerCase()));
  const nameFor = (email) => {
    const p = people.find((p) => p.email.toLowerCase() === email.toLowerCase());
    return p ? p.name : email;
  };
  const available = people.filter((p) => !has(p.email));

  return (
    <div className="field">
      <span className="label">{label}</span>
      {list.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "0 0 8px" }}>
          {list.map((e) => (
            <span key={e} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: COAL, color: GOLD, fontSize: 12, fontWeight: 700, padding: "4px 8px", borderRadius: 999 }}>
              {nameFor(e)}
              <button type="button" onClick={() => remove(e)} aria-label={`Remove ${e}`} style={{ background: "transparent", border: 0, color: GOLD, cursor: "pointer", fontWeight: 900, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
      {available.length > 0 ? (
        <select className="input" value="" onChange={(e) => { add(e.target.value); }}>
          <option value="">— add an Equipment User —</option>
          {available.map((p) => (
            <option key={p.id} value={p.email}>{p.name} ({p.email})</option>
          ))}
        </select>
      ) : null}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input
          className="input"
          type="email"
          value={custom}
          placeholder={placeholder}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(custom); setCustom(""); } }}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn" onClick={() => { add(custom); setCustom(""); }} style={{ fontSize: 12 }}>Add</button>
      </div>
      <span className="muted" style={{ fontSize: 11, marginTop: 4, display: "block" }}>Add one or more. Any one of them can review — the first to act decides.</span>
    </div>
  );
}

function ReviewerPicker({ label, people, value, onChange, placeholder }) {
  const known = people.some((p) => p.email.toLowerCase() === (value || "").toLowerCase());
  return (
    <label className="field">
      <span className="label">{label}</span>
      {people.length > 0 ? (
        <>
          <select className="input" value={known ? value : ""} onChange={(e) => onChange(e.target.value)}>
            <option value="">— choose —</option>
            {people.map((p) => (
              <option key={p.id} value={p.email}>
                {p.name} ({p.email})
              </option>
            ))}
          </select>
          {value && !known && (
            <span className="muted" style={{ fontSize: 11, marginTop: 4 }}>Using a custom address: {value}</span>
          )}
        </>
      ) : (
        <input className="input" type="email" value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
