"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PaperCard, SectionBar, Field, Textarea } from "./ui";
import CheckItem, { CheckHeader, CHECK_TABLE_MINWIDTH, defaultStates } from "./CheckItem";
import Photos from "./Photos";
import { templatesForRoles, templateByCode } from "@/lib/templates";
import { rolesOf } from "@/lib/roles";
import { enqueueReport } from "@/lib/outbox";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

export default function ReportForm({ profile, prefill = {}, edit = null }) {
  const router = useRouter();

  const isTech = profile.role === "TECHNICIAN";
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
  const [clients, setClients] = useState([]);
  const [weighbridges, setWeighbridges] = useState([]);
  const [sites, setSites] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [managers, setManagers] = useState([]);
  const [clientName, setClientName] = useState(edit ? edit.clientName || "" : profile.clientName || prefill.client || "");
  const [site, setSite] = useState(edit ? edit.site || "" : profile.site || prefill.site || "");
  const [supervisorEmail, setSupervisorEmail] = useState(edit ? edit.supervisorEmail || "" : "");
  const [managerEmail, setManagerEmail] = useState(edit ? edit.managerEmail || "" : "");
  const [scheduleId] = useState(prefill.scheduleId || null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Validate the routing, then open the review dialog so the filer can re-read
  // everything before it is sent.
  const review = () => {
    setMsg("");
    if (!/\S+@\S+\.\S+/.test(supervisorEmail)) return setMsg("Enter the Equipment User's email.");
    if (!/\S+@\S+\.\S+/.test(managerEmail)) return setMsg("Enter the Client/Manager's email.");
    if (!isTech && !clientName.trim()) return setMsg("Choose the client (plant).");
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

  // Site suggestions for the chosen client (plus any client-less "all" sites).
  const siteOptions = (() => {
    const c = (isTech ? profile.clientName : clientName || "").trim().toLowerCase();
    return sites
      .filter((s) => !s.client || !c || String(s.client).toLowerCase() === c)
      .map((s) => s.name);
  })();

  const setV = (k, v) => setValues((s) => ({ ...s, [k]: v }));

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

    const payload = {
      template: tpl.code,
      scheduleId: scheduleId || undefined,
      weighbridgeId: values.weighbridgeId || "",
      clientName: isTech ? undefined : clientName.trim(),
      site: isTech ? undefined : site.trim(),
      supervisorEmail: supervisorEmail.trim(),
      managerEmail: managerEmail.trim(),
      values,
      checks,
      grids,
      runs,
      photos,
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

  const approvalPanel = (
    <div className="card" style={{ borderColor: GOLD, padding: 16 }}>
      <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK }}>Approval route</div>
      <div className="muted" style={{ margin: "4px 0 12px" }}>You → Equipment User reviews → Client/Manager approves. Each is emailed automatically.</div>
      <div style={{ fontSize: 12, fontWeight: 700, background: "#efe8d6", color: INK, padding: "8px 10px", borderRadius: 2, marginBottom: 12 }}>
        Submitting as {profile.name}
        {(isTech ? profile.clientName : clientName) ? " · " + (isTech ? profile.clientName : clientName) : ""}
        {(isTech ? profile.site : site) ? " - " + (isTech ? profile.site : site) : ""}
      </div>
      <ReviewerPicker
        label="Equipment User (reviews first)"
        people={supervisors}
        value={supervisorEmail}
        onChange={setSupervisorEmail}
        placeholder="equipment.user@company.com"
      />
      <ReviewerPicker
        label="Client/Manager (approves after review)"
        people={managers}
        value={managerEmail}
        onChange={setManagerEmail}
        placeholder="client.manager@company.com"
      />
      {msg && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, margin: "8px 0" }}>{msg}</div>}
      <button className="btn btn-primary" style={{ width: "100%", padding: "13px" }} disabled={busy} onClick={review}>
        {busy ? "Working…" : isEdit ? "Review & save changes" : "Review & submit"}
      </button>
    </div>
  );

  const filledCount =
    Object.values(values).filter((v) => v !== "" && v != null).length +
    Object.keys(checks).length;

  return (
    <div>
      {confirming && (
        <div
          role="dialog"
          aria-label="Confirm before sending"
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(22,19,16,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setConfirming(false)}
        >
          <div className="card" style={{ maxWidth: 460, width: "100%", padding: 18, background: "#fff", borderColor: GOLD }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 14, color: INK }}>
              {isEdit ? "Re-read your changes" : "Please re-read before sending"}
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "6px 0 12px" }}>
              {isEdit
                ? "Your correction will be saved and stamped on the report's trail with your name and the time. Check the details below."
                : "Once sent, this goes to your Equipment User for review. Check the details below are correct."}
            </p>
            <div style={{ fontSize: 13, color: INK, display: "grid", gap: 4 }}>
              <div><b>Form:</b> {tpl.code} — {tpl.name}</div>
              <div><b>Client:</b> {(isTech ? profile.clientName : clientName) || "—"}</div>
              <div><b>Site / location:</b> {(isTech ? profile.site : site) || "—"}</div>
              <div><b>Weighbridge:</b> {values.weighbridgeId || "—"}</div>
              <div><b>Equipment User:</b> {supervisorEmail}</div>
              <div><b>Client/Manager:</b> {managerEmail}</div>
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

          {isTech ? (
            <div style={{ fontSize: 12, fontWeight: 700, background: "#efe8d6", color: INK, padding: "8px 10px", borderRadius: 2, margin: "8px 0" }}>
              Client: {profile.clientName || "—"} · Site: {profile.site || "—"}
            </div>
          ) : (
            <div className="grid md-2">
              <Field label="Client (plant)" value={clientName} onChange={setClientName} suggestions={clients.map((c) => c.name)} listId="clients-dl" placeholder="e.g. TATA Chemicals Magadi" />
              <Field label="Site / location of this job" value={site} onChange={setSite} suggestions={siteOptions} listId="sites-dl" placeholder={siteOptions.length ? "Pick a site or type one" : "e.g. Main plant weighbridge"} />
            </div>
          )}

          <div style={{ maxWidth: 460 }}>
            <WeighbridgePicker
              list={weighbridges.filter((w) => {
                const c = (isTech ? profile.clientName : clientName || "").trim().toLowerCase();
                return !c || (w.client || "").toLowerCase() === c;
              })}
              value={values.weighbridgeId}
              onType={(v) => setV("weighbridgeId", v)}
              onPick={(w) => {
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
              }}
            />
          </div>

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
            if (sec.type === "choices")
              return (
                <div key={si}>
                  <SectionBar>{sec.title}</SectionBar>
                  <div className="grid md-2">
                    {sec.options.map((o) => (
                      <button
                        key={o}
                        onClick={() => setV(sec.k, o)}
                        style={{
                          textAlign: "left",
                          fontSize: 14,
                          padding: "10px 12px",
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: values[sec.k] === o ? COAL : "#cfc8ba",
                          background: values[sec.k] === o ? COAL : "#fff",
                          color: values[sec.k] === o ? GOLD : INK,
                          fontWeight: values[sec.k] === o ? 700 : 400,
                        }}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              );
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

          <Photos photos={photos} setPhotos={setPhotos} />
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
