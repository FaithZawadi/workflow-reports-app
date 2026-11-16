"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { PaperCard, SectionBar } from "./ui";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const money = (n) => (n == null || n === "" ? null : Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }));

export default function AttendanceAdmin() {
  const [tab, setTab] = useState("log");
  return (
    <div>
      <PaperCard>
        <p className="eyebrow">Attendance</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 className="h1" style={{ margin: 0 }}>Clocking &amp; attendance</h1>
          <Link href="/clock" className="btn btn-primary" style={{ textDecoration: "none", fontSize: 13, padding: "9px 16px" }}>▶ Open clocking station</Link>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Workers clock in/out on the manager’s phone at the clocking station. They are registered once (name + photo) and are not system users.
        </p>
        <div style={{ display: "flex", gap: 6, marginTop: 10, borderBottom: "1px solid #e6e0d2" }}>
          {[["log", "Clock log"], ["workers", "Workers"], ["wages", "Daily wages"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ background: "none", border: 0, borderBottom: tab === k ? `2px solid ${GOLD}` : "2px solid transparent", color: tab === k ? INK : MUTE, fontWeight: 800, fontSize: 13, padding: "8px 10px", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
        {tab === "log" ? <ClockLog /> : tab === "workers" ? <Workers /> : <WagesReport />}
      </PaperCard>
    </div>
  );
}

function ClockLog() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [site, setSite] = useState("");
  const [events, setEvents] = useState([]);
  const [withPhotos, setWithPhotos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ from, to, ...(site.trim() ? { site: site.trim() } : {}), ...(withPhotos ? { photos: "1" } : {}) });
      const r = await fetch(`/api/attendance/events?${qs}`);
      const d = await r.json();
      if (r.ok) setEvents(d.events || []);
    } catch {}
    setBusy(false);
  }, [from, to, site, withPhotos]);
  useEffect(() => { load(); }, [load]);

  const csvHref = `/api/attendance/events?${new URLSearchParams({ from, to, ...(site.trim() ? { site: site.trim() } : {}), format: "csv" })}`;
  const th = { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, color: MUTE, padding: "6px 8px", borderBottom: "1px solid #e6e0d2", whiteSpace: "nowrap" };
  const td = { fontSize: 13, padding: "7px 8px", borderBottom: "1px solid #f0ebe0", verticalAlign: "middle" };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: MUTE }}>From<br /><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" style={{ padding: 7 }} /></label>
        <label style={{ fontSize: 12, color: MUTE }}>To<br /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" style={{ padding: 7 }} /></label>
        <button className="btn" onClick={() => { setFrom(todayStr()); setTo(todayStr()); }} style={{ fontSize: 12 }}>Today</button>
        <button className="btn" onClick={() => { setFrom(daysAgoStr(6)); setTo(todayStr()); }} style={{ fontSize: 12 }}>7 days</button>
        <button className="btn" onClick={() => { setFrom(daysAgoStr(29)); setTo(todayStr()); }} style={{ fontSize: 12 }}>30 days</button>
        <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Filter by site…" className="input" style={{ padding: 7, fontSize: 12, maxWidth: 160 }} />
        <label style={{ fontSize: 12, color: MUTE, display: "flex", alignItems: "center", gap: 5 }}>
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} /> Show photos
        </label>
        <a className="btn btn-dark" href={csvHref} style={{ fontSize: 12, textDecoration: "none", marginLeft: "auto" }}>⬇ Export CSV</a>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead><tr><th style={th}>Worker</th><th style={th}>Site</th><th style={th}>In/Out</th><th style={th}>When</th>{withPhotos && <th style={th}>Photo</th>}<th style={th}>Location</th><th style={th}>By</th></tr></thead>
          <tbody>
            {events.length === 0 && !busy && (
              <tr><td style={{ ...td, textAlign: "center", color: MUTE }} colSpan={withPhotos ? 7 : 6}>No clock-ins for this range.</td></tr>
            )}
            {events.map((e) => (
              <tr key={e.id}>
                <td style={td}><b>{e.workerName}</b>{e.jobTitle ? <span style={{ color: MUTE }}> · {e.jobTitle}</span> : ""}</td>
                <td style={{ ...td, color: e.site ? INK : MUTE }}>{e.site || "—"}</td>
                <td style={td}><span style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", color: "#fff", background: e.type === "IN" ? PASS : WAIT, padding: "2px 7px", borderRadius: 4 }}>{e.type}</span></td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(e.at).toLocaleString("en-GB", { timeZone: "Africa/Nairobi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                {withPhotos && <td style={td}>{e.selfie ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={e.selfie} alt="" onClick={() => setLightbox(e.selfie)} style={{ width: 38, height: 38, borderRadius: 6, objectFit: "cover", cursor: "pointer", border: "1px solid #e6e0d2" }} />) : <span style={{ color: MUTE, fontSize: 12 }}>—</span>}</td>}
                <td style={td}>{e.lat != null ? <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noreferrer" style={{ color: "#8a6d00", fontSize: 12 }}>map</a> : <span style={{ color: MUTE }}>—</span>}</td>
                <td style={{ ...td, color: MUTE, fontSize: 12 }}>{e.byManagerName || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {busy && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Loading…</div>}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}

function WagesReport() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [site, setSite] = useState("");
  const [data, setData] = useState({ rows: [], total: 0, workerDays: 0, unset: 0 });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ from, to, ...(site.trim() ? { site: site.trim() } : {}) });
      const r = await fetch(`/api/attendance/wages?${qs}`);
      const d = await r.json();
      if (r.ok) setData({ rows: d.rows || [], total: d.total || 0, workerDays: d.workerDays || 0, unset: d.unset || 0 });
    } catch {}
    setBusy(false);
  }, [from, to, site]);
  useEffect(() => { load(); }, [load]);

  const csvHref = `/api/attendance/wages?${new URLSearchParams({ from, to, ...(site.trim() ? { site: site.trim() } : {}), format: "csv" })}`;

  // Group rows by day so each day's wages read together, with a daily subtotal.
  const byDay = useMemo(() => {
    const m = new Map();
    for (const r of data.rows) { if (!m.has(r.date)) m.set(r.date, []); m.get(r.date).push(r); }
    return Array.from(m.entries()); // already date-desc from the API
  }, [data.rows]);

  const th = { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, color: MUTE, padding: "6px 8px", borderBottom: "1px solid #e6e0d2", whiteSpace: "nowrap" };
  const td = { fontSize: 13, padding: "7px 8px", borderBottom: "1px solid #f0ebe0", verticalAlign: "middle" };
  const dayLabel = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: MUTE }}>From<br /><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" style={{ padding: 7 }} /></label>
        <label style={{ fontSize: 12, color: MUTE }}>To<br /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" style={{ padding: 7 }} /></label>
        <button className="btn" onClick={() => { setFrom(todayStr()); setTo(todayStr()); }} style={{ fontSize: 12 }}>Today</button>
        <button className="btn" onClick={() => { setFrom(daysAgoStr(6)); setTo(todayStr()); }} style={{ fontSize: 12 }}>7 days</button>
        <button className="btn" onClick={() => { setFrom(daysAgoStr(29)); setTo(todayStr()); }} style={{ fontSize: 12 }}>30 days</button>
        <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Filter by site…" className="input" style={{ padding: 7, fontSize: 12, maxWidth: 160 }} />
        <a className="btn btn-dark" href={csvHref} style={{ fontSize: 12, textDecoration: "none", marginLeft: "auto" }}>⬇ Export CSV</a>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <Stat label="Worker-days" value={data.workerDays} />
        <Stat label="Total wages" value={money(data.total) || "0"} />
        {data.unset > 0 && <Stat label="No wage set" value={data.unset} warn />}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: -2, marginBottom: 8 }}>
        One day present (any clock-in that day) earns the worker their current daily wage. Workers with no daily wage set show a dash — set it under <b>Workers</b>.
      </p>

      {data.rows.length === 0 && !busy && <div className="muted" style={{ fontSize: 13, padding: 12 }}>No attendance in this range.</div>}

      <div style={{ overflowX: "auto" }}>
        {byDay.map(([date, rows]) => {
          const daySum = rows.reduce((s, r) => s + (Number(r.dailyWage) || 0), 0);
          return (
            <div key={date} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 8px", background: "#faf7ef", borderRadius: 6, border: "1px solid #efe9db" }}>
                <b style={{ fontSize: 13, color: INK }}>{dayLabel(date)}</b>
                <span style={{ fontSize: 12.5, color: INK, fontWeight: 700 }}>{rows.length} worker{rows.length === 1 ? "" : "s"} · {money(daySum) || "0"}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                <thead><tr><th style={th}>Worker</th><th style={th}>Site</th><th style={{ ...th, textAlign: "right" }}>Daily wage</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td style={td}><b>{r.workerName}</b>{r.jobTitle ? <span style={{ color: MUTE }}> · {r.jobTitle}</span> : ""}</td>
                      <td style={{ ...td, color: r.site ? INK : MUTE }}>{r.site || "—"}</td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: r.dailyWage == null ? FAIL : INK }}>{r.dailyWage == null ? "—" : money(r.dailyWage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      {busy && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Loading…</div>}
    </div>
  );
}

function Stat({ label, value, warn }) {
  return (
    <div style={{ border: `1px solid ${warn ? "#e8c9a0" : "#e6e0d2"}`, background: warn ? "#fdf3e6" : "#fff", borderRadius: 10, padding: "8px 14px", minWidth: 110 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, color: MUTE, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: warn ? "#a86a1a" : INK }}>{value}</div>
    </div>
  );
}

function Workers() {
  const [workers, setWorkers] = useState([]);
  const [sites, setSites] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // worker id being site-changed
  const [pickSite, setPickSite] = useState("");
  const [expanded, setExpanded] = useState(null); // worker id showing details
  const [lightbox, setLightbox] = useState(null);
  const [editDetail, setEditDetail] = useState(null); // worker id being detail-edited
  const [form, setForm] = useState({ nextOfKin: "", nextOfKinPhone: "", dailyWage: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try { const r = await fetch("/api/attendance/workers?all=1"); const d = await r.json(); if (r.ok) setWorkers(d.workers || []); } catch {}
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/attendance/sites").then((r) => (r.ok ? r.json() : { sites: [] })).then((d) => setSites(d.sites || [])).catch(() => {}); }, []);

  const toggle = async (w) => {
    await fetch(`/api/attendance/workers/${w.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !w.active }) });
    load();
  };
  const startEdit = (w) => { setEditing(w.id); setPickSite(w.siteId || ""); };
  const saveSite = async (w) => {
    await fetch(`/api/attendance/workers/${w.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteId: pickSite || null }) });
    setEditing(null); load();
  };
  const startDetail = (w) => {
    setEditDetail(w.id);
    setForm({ nextOfKin: w.nextOfKin || "", nextOfKinPhone: w.nextOfKinPhone || "", dailyWage: w.dailyWage == null ? "" : String(w.dailyWage) });
  };
  const saveDetail = async (w) => {
    setSaving(true);
    try {
      await fetch(`/api/attendance/workers/${w.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ nextOfKin: form.nextOfKin, nextOfKinPhone: form.nextOfKinPhone, dailyWage: form.dailyWage === "" ? null : form.dailyWage }),
      });
      setEditDetail(null); await load();
    } catch {}
    setSaving(false);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <SectionBar>Registered workers <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11, color: MUTE }}>· register new ones at the clocking station</span></SectionBar>
      {workers.length === 0 && !busy && <div className="muted" style={{ fontSize: 13, padding: 12 }}>No workers registered yet. Open the clocking station to add them.</div>}
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {workers.map((w) => (
          <div key={w.id} style={{ border: "1px solid #e6e0d2", borderRadius: 10, opacity: w.active ? 1 : 0.6 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px" }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", background: "#f0ebe0", flexShrink: 0 }}>
                {w.photo ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={w.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />) : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: MUTE, fontWeight: 800 }}>{w.name[0]?.toUpperCase()}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: INK }}>{w.name}{!w.active && <span style={{ color: FAIL, fontSize: 11, fontWeight: 800 }}> · inactive</span>}</div>
                <div style={{ fontSize: 12, color: MUTE }}>{[w.jobTitle, w.idNumber ? `ID ${w.idNumber}` : null, w.phone].filter(Boolean).join(" · ") || "—"}</div>
                <div style={{ fontSize: 12, color: w.siteName ? INK : MUTE, fontWeight: w.siteName ? 600 : 400 }}>📍 {w.siteName || "No site assigned"}</div>
                <div style={{ fontSize: 12, color: w.dailyWage != null ? INK : MUTE, fontWeight: w.dailyWage != null ? 600 : 400 }}>💵 {w.dailyWage != null ? `${money(w.dailyWage)} / day` : "No daily wage set"}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                <button className="btn" onClick={() => startEdit(w)} style={{ fontSize: 12 }}>Change site</button>
                <button className="btn" onClick={() => startDetail(w)} style={{ fontSize: 12 }}>Edit</button>
                <button className="btn" onClick={() => setExpanded(expanded === w.id ? null : w.id)} style={{ fontSize: 12 }}>{expanded === w.id ? "Hide" : "Details"}</button>
                <button className="btn" onClick={() => toggle(w)} style={{ fontSize: 12, color: w.active ? FAIL : PASS }}>{w.active ? "Deactivate" : "Reactivate"}</button>
              </div>
            </div>

            {editDetail === w.id && (
              <div style={{ padding: "0 10px 10px", display: "grid", gap: 8 }}>
                <div style={{ background: "#faf7ef", border: "1px solid #e6e0d2", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3, color: MUTE }}>Edit next of kin &amp; daily wage</div>
                  <label style={{ fontSize: 12, color: MUTE }}>Next of kin<input value={form.nextOfKin} onChange={(e) => setForm((f) => ({ ...f, nextOfKin: e.target.value }))} className="input" style={{ width: "100%", padding: 8, marginTop: 2 }} placeholder="Name" /></label>
                  <label style={{ fontSize: 12, color: MUTE }}>Next of kin phone<input value={form.nextOfKinPhone} onChange={(e) => setForm((f) => ({ ...f, nextOfKinPhone: e.target.value }))} className="input" style={{ width: "100%", padding: 8, marginTop: 2 }} placeholder="+254…" /></label>
                  <label style={{ fontSize: 12, color: MUTE }}>Daily wage<input type="number" min={0} inputMode="decimal" value={form.dailyWage} onChange={(e) => setForm((f) => ({ ...f, dailyWage: e.target.value }))} className="input" style={{ width: "100%", padding: 8, marginTop: 2 }} placeholder="e.g. 800" /></label>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button className="btn" onClick={() => setEditDetail(null)} style={{ fontSize: 12 }}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => saveDetail(w)} disabled={saving} style={{ fontSize: 12 }}>{saving ? "Saving…" : "Save"}</button>
                  </div>
                </div>
              </div>
            )}

            {editing === w.id && (
              <div style={{ display: "flex", gap: 8, padding: "0 10px 10px", alignItems: "center" }}>
                <select value={pickSite} onChange={(e) => setPickSite(e.target.value)} className="input" style={{ flex: 1, fontSize: 13 }}>
                  <option value="">— No site —</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` · ${s.city}` : ""}</option>)}
                </select>
                <button className="btn" onClick={() => setEditing(null)} style={{ fontSize: 12 }}>Cancel</button>
                <button className="btn btn-primary" onClick={() => saveSite(w)} style={{ fontSize: 12 }}>Save</button>
              </div>
            )}

            {expanded === w.id && (
              <div style={{ padding: "0 10px 10px", display: "grid", gap: 6, fontSize: 12.5, color: INK }}>
                {w.idPhoto ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={w.idPhoto} alt="ID document" onClick={() => setLightbox(w.idPhoto)} style={{ maxWidth: 240, borderRadius: 8, border: "1px solid #e6e0d2", cursor: "zoom-in" }} />) : <span style={{ color: MUTE }}>No ID document on file.</span>}
                <div><b>Gender:</b> {w.gender || "—"} · <b>Address:</b> {w.address || "—"}</div>
                <div><b>Next of kin:</b> {w.nextOfKin || "—"}{w.nextOfKinPhone ? ` (${w.nextOfKinPhone})` : ""}</div>
                <div><b>Daily wage:</b> {w.dailyWage != null ? `${money(w.dailyWage)} / day` : "—"}</div>
                <div style={{ color: MUTE }}>Registered by {w.registeredByName || "—"}{w.createdAt ? ` · ${new Date(w.createdAt).toLocaleDateString()}` : ""}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="ID document" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}
