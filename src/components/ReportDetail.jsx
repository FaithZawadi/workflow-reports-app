"use client";
import { useEffect, useState } from "react";
import { PaperCard, SectionBar, Pill } from "./ui";
import Lightbox from "./Lightbox";
import { templateByCode, isSingleApproval } from "@/lib/templates";
import { defaultStates, colorFor } from "./CheckItem";
import { COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

export default function ReportDetail({ serial, profile }) {
  const [rep, setRep] = useState(null);
  const [actAs, setActAs] = useState(null);
  const [reviewers, setReviewers] = useState(null);
  const [canEditReport, setCanEditReport] = useState(false);
  const [lightbox, setLightbox] = useState(null); // index of the open photo, or null
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
    setReviewers(data.reviewers || null);
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
  const singleApproval = isSingleApproval(rep.template);
  const data = rep.data || {};
  const pending = rep.status === "PENDING_SUPERVISOR" || rep.status === "PENDING_MANAGER";

  const freeFields = Object.entries(data.values || {}).filter(([k, v]) => k !== "weighbridgeId" && v);

  // Proper field labels so a value key like "stampExpiry" reads "Stamp Expiry"
  // instead of "STAMPEXPIRY". Prefer the template's own label; otherwise split
  // camelCase / underscores / letter-number runs (mirrors the mobile app).
  const fieldLabels = {};
  (tpl?.sections || []).forEach((sec) => {
    if (sec.type === "fields") (sec.fields || []).forEach((f) => { if (f.k) fieldLabels[f.k] = f.label || f.k; });
    else if (sec.type === "choices" && sec.k) fieldLabels[sec.k] = sec.title || sec.k;
    else if (sec.type === "textarea" && sec.k) fieldLabels[sec.k] = sec.label || sec.k;
  });
  const humanizeKey = (k) => {
    let s = String(k)
      .replace(/_/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Za-z])([0-9])/g, "$1 $2")
      .trim()
      .replace(/\s+/g, " ");
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  };
  const labelFor = (k) => fieldLabels[k] || humanizeKey(k);

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
        {/* Client · Site · Weighbridge — the three key identifiers, shown clearly. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <IdChip label="Client" value={rep.clientName || "—"} />
          <IdChip label="Site / branch" value={rep.site || "—"} />
          <IdChip label="Weighbridge" value={rep.weighbridgeId || "not stated"} mono />
        </div>
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
          by <b>{rep.authorName}</b> · {new Date(rep.reportDate || rep.createdAt).toLocaleDateString()}
          {(profile?.role === "ADMIN" || (Array.isArray(profile?.roles) && profile.roles.includes("ADMIN"))) &&
          rep.reportDate && new Date(rep.reportDate).toDateString() !== new Date(rep.createdAt).toDateString() ? (
            <span title={`Filed on ${new Date(rep.createdAt).toLocaleString()}`}> · <b>backdated</b> (filed {new Date(rep.createdAt).toLocaleDateString()})</span>
          ) : null}
        </div>

        {/* Approval route — who must review/approve. Shown to everyone; only the
            routed reviewer gets the buttons below. */}
        {pending && (
          <div className="card" style={{ padding: 14, marginTop: 14, background: "#f3eee2" }}>
            <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 12, color: INK, letterSpacing: ".04em", marginBottom: 8 }}>Approval route</div>
            {(reviewers?.supervisors && reviewers.supervisors.length > 0
              ? reviewers.supervisors
              : [{ email: reviewers?.supervisorEmail || rep.supervisorEmail, name: reviewers?.supervisorName }]
            ).map((s, i, arr) => (
              <ReviewerRow
                key={s.email}
                label={
                  i === 0
                    ? singleApproval
                      ? arr.length > 1
                        ? "Clients (any one approves)"
                        : "Client (approves)"
                      : arr.length > 1
                      ? "Equipment Users (any one reviews)"
                      : "Equipment User (reviews first)"
                    : ""
                }
                name={s.name}
                email={s.email}
                state={rep.status === "PENDING_SUPERVISOR" ? "current" : "done"}
              />
            ))}
            {!singleApproval && (
              <ReviewerRow
                label="Client/Manager (final approval)"
                name={reviewers?.managerName}
                email={reviewers?.managerEmail || rep.managerEmail}
                state={rep.status === "PENDING_MANAGER" ? "current" : rep.status === "PENDING_SUPERVISOR" ? "waiting" : "done"}
              />
            )}
          </div>
        )}

        {/* action panel — only the routed reviewer for the current stage */}
        {pending && actAs && (
          <div className="card" style={{ borderColor: GOLD, background: "#fdf6e3", padding: 14, marginTop: 10 }}>
            <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK }}>
              {actAs === "SUPERVISOR" ? "Your review" : "Your approval"}
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
          <div className="muted" style={{ fontSize: 12, marginTop: 8, fontStyle: "italic" }}>
            Only the routed {rep.status === "PENDING_SUPERVISOR" ? (singleApproval ? "Client" : "Equipment User") : "Client/Manager"} above can approve or reject this report.
          </div>
        )}

        {/* free fields */}
        {freeFields.map(([k, v]) => (
          <div key={k} style={{ fontSize: 14, marginTop: 8 }}>
            <b style={{ textTransform: "uppercase", fontSize: 11, color: MUTE }}>{labelFor(k)}: </b>
            {String(v)}
          </div>
        ))}

        {/* checklists — columnar table: Item | Result | Remarks */}
        {(tpl?.sections || []).map((sec, si) =>
          sec.type === "checklist" ? (
            <div key={si}>
              <SectionBar>{sec.title}</SectionBar>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 480, maxWidth: 980, border: "1px solid #e6e0d2", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(190px,1.05fr) 76px minmax(240px,2fr)", background: COAL, color: "#fff", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
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
                      <div key={ii} style={{ display: "grid", gridTemplateColumns: "minmax(190px,1.05fr) 76px minmax(240px,2fr)", fontSize: 14, borderTop: "1px solid #eae4d6" }}>
                        <span style={{ padding: "10px 12px", borderRight: "1px solid #eae4d6", color: INK, lineHeight: 1.35 }}>{it}</span>
                        <span style={{ padding: "10px 8px", borderRight: "1px solid #eae4d6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {st ? (
                            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".02em", color: "#fff", background: colorFor(st.key), textAlign: "center", lineHeight: 1.3 }}>
                              {isGood ? "✓ " : ""}{st.label}
                            </span>
                          ) : (
                            <span style={{ color: "#b8af9e" }}>—</span>
                          )}
                        </span>
                        <span style={{ padding: "10px 12px", color: v?.remark ? FAIL : MUTE, lineHeight: 1.35 }}>{v?.remark || "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null
        )}

        {/* row grids (e.g. Technical Report job-time / mileage, engineer test grids) */}
        {(tpl?.sections || []).map((sec, si) => {
          if (sec.type !== "rows") return null;
          const g = data.grids || {};
          const nRows = sec.rows || 4;
          const cells = [];
          for (let ri = 0; ri < nRows; ri++) {
            const row = sec.cols.map((_, ci) => g[`${sec.key}:${ri}:${ci}`] ?? "");
            if (row.some((v) => String(v).trim() !== "")) cells.push(row);
          }
          return (
            <div key={`rows-${si}`}>
              <SectionBar>{sec.title}</SectionBar>
              {cells.length ? (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: sec.cols.length * 110, border: "1px solid #e6e0d2", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${sec.cols.length}, minmax(100px,1fr))`, background: COAL, color: "#fff", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                      {sec.cols.map((c, ci) => <span key={ci} style={{ padding: "6px 10px", borderRight: ci < sec.cols.length - 1 ? "1px solid #2c2720" : "none" }}>{c}</span>)}
                    </div>
                    {cells.map((row, ri) => (
                      <div key={ri} style={{ display: "grid", gridTemplateColumns: `repeat(${sec.cols.length}, minmax(100px,1fr))`, fontSize: 13.5, borderTop: "1px solid #eae4d6", background: ri % 2 ? "#FBF9F4" : "#fff" }}>
                        {row.map((v, ci) => <span key={ci} style={{ padding: "8px 10px", borderRight: ci < sec.cols.length - 1 ? "1px solid #eae4d6" : "none", color: INK }}>{String(v) || "—"}</span>)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: MUTE, fontStyle: "italic" }}>Not recorded.</div>
              )}
            </div>
          );
        })}

        {/* weekly */}
        {data.weekly && data.weekly.pass !== null && (
          <div style={{ padding: 10, marginTop: 12, borderRadius: 2, fontSize: 14, fontWeight: 700, color: "#fff", background: data.weekly.pass ? PASS : FAIL }}>
            Weekly test: {data.weekly.pass ? "WITHIN LIMIT" : "OVER LIMIT — QSL attention required"} (limit {data.weekly.limit} kg)
          </div>
        )}

        {/* photos — click any to open the full-screen viewer (zoom / pan / download) */}
        {(rep.photos || []).length > 0 && (
          <div>
            <SectionBar>Photos <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11, color: MUTE }}>· tap a photo to view full screen &amp; zoom</span></SectionBar>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))" }}>
              {rep.photos.map((p, i) => (
                <figure key={i} style={{ margin: 0 }}>
                  <button
                    type="button"
                    onClick={() => setLightbox(i)}
                    title="View full screen"
                    style={{ display: "block", width: "100%", padding: 0, border: "1px solid var(--line)", borderRadius: 2, background: "#f3eee2", cursor: "zoom-in", position: "relative", overflow: "hidden" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.dataUrl} alt={p.caption || "photo"} style={{ width: "100%", height: 200, objectFit: "contain", display: "block" }} />
                    <span aria-hidden style={{ position: "absolute", right: 6, bottom: 6, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>⤢ View</span>
                  </button>
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
        {lightbox != null && (
          <Lightbox photos={rep.photos} index={lightbox} onClose={() => setLightbox(null)} />
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

// A labelled identifier chip — Client / Site / Weighbridge on the report header.
function IdChip({ label, value, mono }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 1, background: "#FBF8F0", border: `1px solid ${GOLD}`, borderRadius: 8, padding: "5px 11px", minWidth: 0 }}>
      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: MUTE }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: INK, fontFamily: mono ? "var(--mono)" : "inherit" }}>{value}</span>
    </span>
  );
}

function ReviewerRow({ label, name, email, state }) {
  const chip =
    state === "current" ? { text: "Awaiting them", color: WAIT }
    : state === "done" ? { text: "Done", color: PASS }
    : { text: "Waiting", color: MUTE };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "6px 0", borderTop: "1px solid #e6e0d2" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: MUTE }}>{label}</div>
        <div style={{ fontSize: 14, color: INK, fontWeight: 700 }}>{name || "—"}</div>
        <div className="mono" style={{ fontSize: 12, color: MUTE, wordBreak: "break-all" }}>{email || "not set"}</div>
      </div>
      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", color: "#fff", background: chip.color, padding: "3px 8px", borderRadius: 999 }}>
        {chip.text}
      </span>
    </div>
  );
}
