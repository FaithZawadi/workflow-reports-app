"use client";
import { useEffect, useState } from "react";
import { templateByCode } from "@/lib/templates";
import { colorFor, defaultStates } from "./CheckItem";
import Lightbox from "./Lightbox";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

// One-click email approval screen. Loads the report by token, shows a read-only
// summary, and lets the routed reviewer approve or reject with a comment — no
// sign-in. Works on mobile and web.
export default function ApproveClient({ token, initialAction }) {
  const [state, setState] = useState({ loading: true });
  const [action, setAction] = useState(initialAction); // "approve" | "reject" | null
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { status } after acting
  const [err, setErr] = useState("");
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetch(`/api/approve/${token}`)
      .then((r) => r.json())
      .then((d) => setState({ loading: false, ...d }))
      .catch(() => setState({ loading: false, ok: false, message: "Could not load this link." }));
  }, [token]);

  const submit = async (decision) => {
    setErr("");
    if (decision === "reject" && !comment.trim()) {
      setAction("reject");
      setErr("Please add a comment so the sender knows what to fix.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/approve/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, comment: comment.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Could not record your decision.");
        setBusy(false);
        return;
      }
      setDone({ status: d.status, decision });
    } catch {
      setErr("Network problem — please try again.");
      setBusy(false);
    }
  };

  const shell = (children) => (
    <div style={{ minHeight: "100dvh", background: "#f3eee2", padding: "0 0 40px" }}>
      <div style={{ background: COAL, color: "#fff", padding: "14px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", fontWeight: 900, letterSpacing: ".02em" }}>
          QALIBRATED <span style={{ color: GOLD }}>SYSTEMS</span>
        </div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 16px" }}>{children}</div>
    </div>
  );

  const card = { background: "#fff", border: "1px solid #e6e0d2", borderRadius: 6, padding: 16, marginTop: 14 };

  if (state.loading) return shell(<div style={{ color: MUTE }}>Loading…</div>);

  if (!state.ok) {
    return shell(
      <div style={card}>
        <h1 style={{ fontSize: 20, color: INK, margin: 0 }}>Link unavailable</h1>
        <p style={{ color: MUTE, marginTop: 8 }}>{state.message || "This approval link can't be used."}</p>
        <p style={{ color: MUTE, fontSize: 13 }}>If you still need to act on this report, open the app and sign in.</p>
      </div>
    );
  }

  if (done) {
    const approved = done.decision === "approve";
    const finalWord =
      done.status === "APPROVED" ? "fully approved" : done.status === "PENDING_MANAGER" ? "approved and sent to the Client/Manager" : "returned to the sender";
    return shell(
      <div style={{ ...card, borderColor: approved ? PASS : FAIL, borderLeftWidth: 5 }}>
        <h1 style={{ fontSize: 20, color: approved ? PASS : FAIL, margin: 0 }}>
          {approved ? "✓ Recorded" : "Returned"}
        </h1>
        <p style={{ color: INK, marginTop: 8 }}>
          {state.report.serial} has been <b>{finalWord}</b>. Your decision is stamped on the report’s approval trail.
        </p>
        <p style={{ color: MUTE, fontSize: 13 }}>You can close this page.</p>
      </div>
    );
  }

  const r = state.report;
  const tpl = templateByCode(r.template);
  const data = r.data || {};
  const stageLabel = state.stage === "SUPERVISOR" ? "review (Equipment User)" : "final approval (Client/Manager)";
  const freeFields = Object.entries(data.values || {}).filter(([k, v]) => k !== "weighbridgeId" && v);
  const photos = (r.photos || []).filter((p) => (p.dataUrl || "").startsWith("data:image"));

  return shell(
    <>
      <p style={{ color: WAIT, fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", margin: 0 }}>
        Your {stageLabel}
      </p>
      <h1 style={{ fontSize: 22, color: INK, margin: "4px 0 0" }}>{r.templateName}</h1>
      <div style={{ color: MUTE, fontSize: 13, marginTop: 4 }}>
        <span style={{ fontFamily: "monospace", background: COAL, color: GOLD, padding: "2px 6px" }}>{r.serial}</span>{" "}
        · {r.clientName}
        {r.site ? " – " + r.site : ""} · {r.weighbridgeId || "weighbridge not stated"} · by <b>{r.authorName}</b>
      </div>

      {freeFields.length > 0 && (
        <div style={card}>
          {freeFields.map(([k, v]) => (
            <div key={k} style={{ fontSize: 14, marginBottom: 6 }}>
              <b style={{ textTransform: "uppercase", fontSize: 11, color: MUTE }}>{k}: </b>
              {String(v)}
            </div>
          ))}
        </div>
      )}

      {(tpl?.sections || []).map((sec, si) =>
        sec.type === "checklist" ? (
          <div key={si} style={card}>
            <div style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 12, color: INK, marginBottom: 8 }}>{sec.title}</div>
            {sec.items.map((it, ii) => {
              const v = data.checks?.[`${si}:${ii}`];
              const states = sec.states || defaultStates(sec.yes, sec.no);
              const st = states.find((s) => s.key === v?.state);
              const isGood = st && st.key === states[0].key;
              return (
                <div key={ii} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "5px 0", borderTop: ii ? "1px solid #eee" : "none" }}>
                  <span style={{ color: INK, flex: 1 }}>{it}</span>
                  <span style={{ fontWeight: 800, color: st ? colorFor(st.key) : "#b8af9e", whiteSpace: "nowrap" }}>
                    {st ? `${isGood ? "✓ " : ""}${st.label}` : "—"}
                    {v?.remark ? <span style={{ color: FAIL, fontWeight: 400 }}> · {v.remark}</span> : ""}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null
      )}

      {photos.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 12, color: INK, marginBottom: 8 }}>Photos ({photos.length}) — tap to view</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))", gap: 6 }}>
            {photos.map((p, i) => (
              <button key={i} onClick={() => setLightbox(i)} style={{ padding: 0, border: "1px solid #ccc", borderRadius: 4, overflow: "hidden", cursor: "pointer", background: "#f3eee2" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.dataUrl} alt={p.caption || "photo"} style={{ width: "100%", height: 72, objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* decision */}
      <div style={{ ...card, borderColor: GOLD }}>
        <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK }}>Your decision</div>
        <p style={{ color: MUTE, fontSize: 13, margin: "4px 0 10px" }}>Recorded against {r.serial} with your name and the time.</p>
        <textarea
          className="input"
          rows={3}
          placeholder={action === "reject" ? "What needs to be fixed? (required)" : "Comment (optional; required to reject)"}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 4, border: "1px solid #cfc8ba", fontSize: 14, marginBottom: 10, fontFamily: "inherit" }}
        />
        {err && <div style={{ color: FAIL, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => submit("approve")} disabled={busy} style={{ flex: 1, padding: "13px", background: PASS, color: "#fff", border: 0, borderRadius: 4, fontWeight: 900, textTransform: "uppercase", fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Working…" : "Approve"}
          </button>
          <button onClick={() => submit("reject")} disabled={busy} style={{ flex: 1, padding: "13px", background: comment.trim() ? FAIL : "#d8b4ac", color: "#fff", border: 0, borderRadius: 4, fontWeight: 900, textTransform: "uppercase", fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            Reject
          </button>
        </div>
      </div>

      {lightbox != null && <Lightbox photos={photos} index={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}
