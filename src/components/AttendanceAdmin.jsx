"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { PaperCard, SectionBar } from "./ui";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

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
          {[["log", "Clock log"], ["workers", "Workers"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ background: "none", border: 0, borderBottom: tab === k ? `2px solid ${GOLD}` : "2px solid transparent", color: tab === k ? INK : MUTE, fontWeight: 800, fontSize: 13, padding: "8px 10px", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
        {tab === "log" ? <ClockLog /> : <Workers />}
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

function Workers() {
  const [workers, setWorkers] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try { const r = await fetch("/api/attendance/workers?all=1"); const d = await r.json(); if (r.ok) setWorkers(d.workers || []); } catch {}
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (w) => {
    await fetch(`/api/attendance/workers/${w.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !w.active }) });
    load();
  };

  return (
    <div style={{ marginTop: 12 }}>
      <SectionBar>Registered workers <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11, color: MUTE }}>· register new ones at the clocking station</span></SectionBar>
      {workers.length === 0 && !busy && <div className="muted" style={{ fontSize: 13, padding: 12 }}>No workers registered yet. Open the clocking station to add them.</div>}
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {workers.map((w) => (
          <div key={w.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", border: "1px solid #e6e0d2", borderRadius: 10, opacity: w.active ? 1 : 0.55 }}>
            <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", background: "#f0ebe0", flexShrink: 0 }}>
              {w.photo ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={w.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />) : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: MUTE, fontWeight: 800 }}>{w.name[0]?.toUpperCase()}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: INK }}>{w.name}{!w.active && <span style={{ color: FAIL, fontSize: 11, fontWeight: 800 }}> · inactive</span>}</div>
              <div style={{ fontSize: 12, color: MUTE }}>{[w.jobTitle, w.phone].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <button className="btn" onClick={() => toggle(w)} style={{ fontSize: 12, color: w.active ? FAIL : PASS }}>{w.active ? "Deactivate" : "Reactivate"}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
