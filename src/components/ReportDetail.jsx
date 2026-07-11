"use client";
import { useEffect, useState } from "react";
import { PaperCard, SectionBar, Pill } from "./ui";
import { templateByCode } from "@/lib/templates";
import { defaultStates, colorFor } from "./CheckItem";
import { COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

export default function ReportDetail({ serial, profile }) {
  const [rep, setRep] = useState(null);
  const [actAs, setActAs] = useState(null);
  const [canEditReport, setCanEditReport] = useState(false);
  const [err, setErr] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = async () => {
    setErr("");
    const res = await fetch(`/api/reports/${serial}`);
    const data = await res.json();
    if (!res.ok) return setErr(data.error || "Could not load report.");
    setRep(data.report);
    setActAs(data.permissions?.actAs || null);
    setCanEditReport(!!data.permissions?.canEdit);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial]);

  const decide = async (decision) => {
    if (decision === "reject" && !comment.trim()) return setNote("A comment is required to reject.");
    setBusy(true);
    setNote("Saving…");
    const res = await fetch(`/api/reports/${serial}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, comment }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setNote(data.error || "Could not save.");
    setNote(data.emailSent ? "Done. Notification sent." : "Saved. (Email notification is off or failed.)");
    setComment("");
    load();
  };

  if (err)
    return (
      <div style={{ marginTop: 16 }} className="err">
        {err}
      </div>
    );
  if (!rep) return <div className="muted" style={{ marginTop: 24 }}>Loading report…</div>;

  const tpl = templateByCode(rep.template);
  const data = rep.data || {};
  const pending = rep.status === "PENDING_SUPERVISOR" || rep.status === "PENDING_MANAGER";

  const freeFields = Object.entries(data.values || {}).filter(([k, v]) => k !== "weighbridgeId" && v);

  return (
    <div style={{ marginTop: 12 }}>
      <PaperCard>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, background: COAL, color: GOLD, padding: "4px 8px" }}>{rep.serial}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {canEditReport && (
              <a className="btn" href={`/reports/${rep.serial}/edit`} style={{ fontSize: 12, textDecoration: "none" }}>
                Edit
              </a>
            )}
            <a className="btn btn-dark" href={`/api/reports/${rep.serial}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>
              Download PDF
            </a>
          </div>
        </div>

        {/* Title on the left, STATUS on the extreme right — same line to save space */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10 }}>
          <h1 className="h1" style={{ margin: 0 }}>{rep.templateName}</h1>
          <Pill status={rep.status} />
        </div>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          {rep.clientName}
          {rep.site ? " - " + rep.site : ""} · {rep.weighbridgeId || "weighbridge not stated"} · by <b>{rep.authorName}</b> ·{" "}
          {new Date(rep.createdAt).toLocaleString()}
        </div>

        {/* action panel */}
        {pending && actAs && (
          <div className="card" style={{ borderColor: GOLD, background: "#fdf6e3", padding: 14, marginTop: 14 }}>
            <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK }}>
              {actAs === "SUPERVISOR" ? "Equipment User review" : "Client/Manager approval"}
            </div>
            <div className="muted" style={{ margin: "4px 0 10px" }}>
              Your decision is recorded with your name and the time.
            </div>
            <input className="input" placeholder="Comment (required to reject)" value={comment} onChange={(e) => setComment(e.target.value)} style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" disabled={busy} onClick={() => decide("approve")} style={{ flex: 1, background: PASS, color: "#fff", borderColor: PASS, fontWeight: 900, textTransform: "uppercase" }}>
                Approve
              </button>
              <button className="btn" disabled={busy || !comment.trim()} onClick={() => decide("reject")} style={{ flex: 1, background: comment.trim() ? FAIL : "#d8b4ac", color: "#fff", borderColor: comment.trim() ? FAIL : "#d8b4ac", fontWeight: 900, textTransform: "uppercase" }}>
                Reject
              </button>
            </div>
            {note && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, marginTop: 8 }}>{note}</div>}
          </div>
        )}
        {pending && !actAs && (
          <div className="card" style={{ padding: 12, marginTop: 14, background: "#f3eee2", color: MUTE, fontSize: 13 }}>
            Waiting for {rep.status === "PENDING_SUPERVISOR" ? "Equipment User review by " + rep.supervisorEmail : "Client/Manager approval by " + rep.managerEmail}.
          </div>
        )}

        {/* free fields */}
        {freeFields.map(([k, v]) => (
          <div key={k} style={{ fontSize: 14, marginTop: 8 }}>
            <b style={{ textTransform: "uppercase", fontSize: 11, color: MUTE }}>{k}: </b>
            {String(v)}
          </div>
        ))}

        {/* checklists — columnar table: Item | Result | Remarks */}
        {(tpl?.sections || []).map((sec, si) =>
          sec.type === "checklist" ? (
            <div key={si}>
              <SectionBar>{sec.title}</SectionBar>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 480, border: "1px solid #e6e0d2", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(150px,1fr) 92px minmax(240px,2fr)", background: COAL, color: "#fff", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                    <span style={{ padding: "6px 10px", borderRight: "1px solid #2c2720" }}>Item</span>
                    <span style={{ padding: "6px 10px", borderRight: "1px solid #2c2720", textAlign: "center" }}>Result</span>
                    <span style={{ padding: "6px 10px" }}>Remarks</span>
                  </div>
                  {sec.items.map((it, ii) => {
                    const v = data.checks?.[`${si}:${ii}`];
                    const states = sec.states || defaultStates(sec.yes, sec.no);
                    const st = states.find((s) => s.key === v?.state);
                    const isGood = st && st.key === states[0].key;
                    return (
                      <div key={ii} style={{ display: "grid", gridTemplateColumns: "minmax(150px,1fr) 92px minmax(240px,2fr)", fontSize: 14, borderTop: "1px solid #eae4d6" }}>
                        <span style={{ padding: "8px 10px", borderRight: "1px solid #eae4d6", color: INK }}>{it}</span>
                        <span style={{ padding: "8px 10px", borderRight: "1px solid #eae4d6", textAlign: "center", fontWeight: 800, color: st ? colorFor(st.key) : "#b8af9e" }}>
                          {st ? <span>{isGood ? "✓ " : ""}{st.label}</span> : "—"}
                        </span>
                        <span style={{ padding: "8px 10px", color: v?.remark ? FAIL : MUTE }}>{v?.remark || "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null
        )}

        {/* weekly */}
        {data.weekly && data.weekly.pass !== null && (
          <div style={{ padding: 10, marginTop: 12, borderRadius: 2, fontSize: 14, fontWeight: 700, color: "#fff", background: data.weekly.pass ? PASS : FAIL }}>
            Weekly test: {data.weekly.pass ? "WITHIN LIMIT" : "OVER LIMIT — QSL attention required"} (limit {data.weekly.limit} kg)
          </div>
        )}

        {/* photos */}
        {(rep.photos || []).length > 0 && (
          <div>
            <SectionBar>Photos</SectionBar>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))" }}>
              {rep.photos.map((p, i) => (
                <figure key={i} style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt={p.caption || "photo"} style={{ width: "100%", height: 200, objectFit: "contain", background: "#f3eee2", borderRadius: 2, border: "1px solid var(--line)" }} />
                  <figcaption className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {p.caption || "(no caption)"}
                    {p.gpsLat != null && (
                      <span className="mono" style={{ display: "block" }}>
                        {p.gpsLat.toFixed(5)}, {p.gpsLng.toFixed(5)}
                      </span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        {/* trail — each action clearly badged (created / approved / rejected) */}
        <SectionBar>Activity &amp; approval trail</SectionBar>
        {(rep.trailEvents || []).map((t, i) => {
          const a = (t.action || "").toLowerCase();
          const color = a.includes("reject") ? FAIL : a.includes("approv") ? PASS : a.includes("submit") ? WAIT : MUTE;
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "8px 0", borderBottom: "1px solid #eae4d6", alignItems: "flex-start" }}>
              <span style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", color: "#fff", background: color, padding: "2px 6px", borderRadius: 3, flexShrink: 0 }}>
                  {t.action}
                </span>
                <span style={{ color: INK }}>
                  by <b>{t.byName}</b>
                  {t.comment ? ` — "${t.comment}"` : ""}
                </span>
              </span>
              <span className="muted" style={{ flexShrink: 0, fontSize: 12 }}>{new Date(t.at).toLocaleString()}</span>
            </div>
          );
        })}
        {rep.status === "APPROVED" && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 2, fontWeight: 900, textTransform: "uppercase", color: "#fff", background: PASS, textAlign: "center" }}>
            Fully approved — record closed
          </div>
        )}
      </PaperCard>
    </div>
  );
}
