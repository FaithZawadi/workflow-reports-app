"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PaperCard, SectionBar, Field, Textarea } from "./ui";
import CheckItem from "./CheckItem";
import Photos from "./Photos";
import { TEMPLATES } from "@/lib/templates";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

export default function ReportForm({ profile }) {
  const router = useRouter();
  const [tpl, setTpl] = useState(null);
  const [values, setValues] = useState({});
  const [checks, setChecks] = useState({});
  const [grids, setGrids] = useState({});
  const [runs, setRuns] = useState({});
  const [photos, setPhotos] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientName, setClientName] = useState(profile.clientName || "");
  const [site, setSite] = useState(profile.site || "");
  const [supervisorEmail, setSupervisorEmail] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const isTech = profile.role === "TECHNICIAN";
  const available = TEMPLATES.filter((t) =>
    profile.role === "ENGINEER" ? t.who === "QSL Engineer" : t.who === "Site Technician" || profile.role === "ADMIN"
  );

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .catch(() => {});
  }, []);

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
    setMsg("");
    if (!/\S+@\S+\.\S+/.test(supervisorEmail)) return setMsg("Enter the supervisor's email.");
    if (!/\S+@\S+\.\S+/.test(managerEmail)) return setMsg("Enter the manager's email.");
    if (!isTech && !clientName.trim()) return setMsg("Choose the client (plant).");
    setBusy(true);
    setMsg("Submitting…");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template: tpl.code,
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Could not submit.");
        setBusy(false);
        return;
      }
      router.push(`/reports/${data.serial}`);
    } catch {
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
      <div className="muted" style={{ margin: "4px 0 12px" }}>You → Supervisor reviews → Manager approves. Each is emailed automatically.</div>
      <div style={{ fontSize: 12, fontWeight: 700, background: "#efe8d6", color: INK, padding: "8px 10px", borderRadius: 2, marginBottom: 12 }}>
        Submitting as {profile.name}
        {(isTech ? profile.clientName : clientName) ? " · " + (isTech ? profile.clientName : clientName) : ""}
        {(isTech ? profile.site : site) ? " - " + (isTech ? profile.site : site) : ""}
      </div>
      <Field label="Supervisor email (reviews first)" type="email" value={supervisorEmail} onChange={setSupervisorEmail} />
      <Field label="Manager email (approves after supervisor)" type="email" value={managerEmail} onChange={setManagerEmail} />
      {msg && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, margin: "8px 0" }}>{msg}</div>}
      <button className="btn btn-primary" style={{ width: "100%", padding: "13px" }} disabled={busy} onClick={submit}>
        {busy ? "Working…" : "Submit — send to supervisor"}
      </button>
    </div>
  );

  return (
    <div>
      <button onClick={() => setTpl(null)} style={{ background: "none", border: 0, color: WAIT, fontWeight: 700, fontSize: 13, marginTop: 12 }}>
        ← Choose a different sheet
      </button>
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
              <Field label="Site / location of this job" value={site} onChange={setSite} placeholder="e.g. Main plant weighbridge" />
            </div>
          )}

          <div style={{ maxWidth: 420 }}>
            <Field label="Weighbridge ID" value={values.weighbridgeId} onChange={(v) => setV("weighbridgeId", v)} placeholder="e.g. WB-1 Dispatch Gate" />
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
                  {sec.items.map((it, ii) => (
                    <CheckItem
                      key={ii}
                      text={it}
                      yes={sec.yes || "OK"}
                      no={sec.no || "NEEDS ATTENTION"}
                      val={checks[`${si}:${ii}`]}
                      onChange={(v) => setChecks((s) => ({ ...s, [`${si}:${ii}`]: v }))}
                    />
                  ))}
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
            if (sec.type === "loadcells")
              return (
                <div key={si}>
                  <SectionBar>Load cell readings</SectionBar>
                  {["Output (mV)", "Corner (kg)"].map((row) => (
                    <div key={row} style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: MUTE }}>{row}</span>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, marginTop: 4 }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <input key={i} className="input" type="number" placeholder={`#${i + 1}`} value={grids[`${row}:${i}`] || ""} onChange={(e) => setGrids((s) => ({ ...s, [`${row}:${i}`]: e.target.value }))} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
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
                        {sec.cols.map((_, ci) => (
                          <input key={ci} className="input" value={grids[`${sec.key}:${ri}:${ci}`] ?? (sec.prefill?.[ri]?.[ci] || "")} onChange={(e) => setGrids((s) => ({ ...s, [`${sec.key}:${ri}:${ci}`]: e.target.value }))} />
                        ))}
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
