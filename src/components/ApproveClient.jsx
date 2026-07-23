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
      <ResultCard
        mood="sleep"
        title="This link has clocked out"
        message={state.message || "This approval link can't be used."}
        sub="If you still need to act on this report, open the app and sign in — everything is waiting for you there."
      />
    );
  }

  if (done) {
    const approved = done.decision === "approve";
    const finalWord =
      done.status === "APPROVED" ? "fully approved" : done.status === "PENDING_MANAGER" ? "approved and sent to the Client/Manager" : "returned to the sender";
    return shell(
      <ResultCard
        mood={approved ? "happy" : "sad"}
        celebrate={approved}
        title={approved ? "Nice one — decision recorded!" : "Sent back to the author"}
        message={<>{state.report.serial} has been <b>{finalWord}</b>. Your decision is stamped on the report’s approval trail.</>}
        sub="You can close this page, or jump into the dashboard."
        serial={state.report?.serial}
      />
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

// ---- Fun result screen (shown after acting, or when the link is spent) -------

const RESULT_CSS = `
/* card + headline spring in like a game "level complete" panel */
.qsl-pop{animation:qslPop .55s cubic-bezier(.18,1.35,.5,1) both}
@keyframes qslPop{0%{transform:scale(.5) translateY(24px);opacity:0}55%{transform:scale(1.07) translateY(-4px)}100%{transform:scale(1);opacity:1}}
.qsl-title-pop{display:inline-block;animation:qslTitle .6s .2s cubic-bezier(.18,1.5,.5,1) both}
@keyframes qslTitle{0%{transform:scale(.4) rotate(-6deg);opacity:0}60%{transform:scale(1.12) rotate(2deg)}100%{transform:scale(1) rotate(0);opacity:1}}

/* big spinning jump (win) / gentle breathing (sleep) */
.qsl-hop{transform-box:fill-box;transform-origin:50% 100%;animation:qslHop 1.5s cubic-bezier(.3,.7,.4,1) infinite}
@keyframes qslHop{0%{transform:translateY(0) scale(1,1) rotate(0)}10%{transform:translateY(0) scale(1.14,.84)}30%{transform:translateY(-46px) scale(.86,1.16) rotate(-7deg)}48%{transform:translateY(-50px) rotate(7deg)}58%{transform:translateY(-46px) rotate(-5deg)}76%{transform:translateY(0) scale(1.18,.8)}88%{transform:translateY(-7px) scale(.96,1.04)}100%{transform:translateY(0) scale(1,1) rotate(0)}}
.qsl-breathe{transform-box:fill-box;transform-origin:50% 100%;animation:qslBreathe 3.2s ease-in-out infinite}
@keyframes qslBreathe{0%,100%{transform:scale(1,1) rotate(-3deg)}50%{transform:scale(1.04,.97) rotate(3deg)}}

/* landing shadow that squashes in sync with the jump */
.qsl-shadow{transform-box:fill-box;transform-origin:center;animation:qslShadow 1.5s cubic-bezier(.3,.7,.4,1) infinite}
@keyframes qslShadow{0%,48%,100%{transform:scaleX(1);opacity:.16}30%{transform:scaleX(.5);opacity:.05}76%{transform:scaleX(1.22);opacity:.2}}

.qsl-blink{transform-box:fill-box;transform-origin:center;animation:qslBlink 3.4s infinite}
@keyframes qslBlink{0%,93%,100%{transform:scaleY(1)}96.5%{transform:scaleY(.08)}}
.qsl-armL{transform-box:fill-box;transform-origin:100% 0%;animation:qslCheer .55s ease-in-out infinite}
.qsl-armR{transform-box:fill-box;transform-origin:0% 0%;animation:qslCheer .55s ease-in-out infinite reverse}
@keyframes qslCheer{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(12deg)}}

/* rotating sunburst backdrop — instant arcade-reward vibe */
.qsl-rays{position:absolute;width:280px;height:280px;bottom:-40px;z-index:0;animation:qslSpin 9s linear infinite}
@keyframes qslSpin{to{transform:rotate(360deg)}}
/* pulsing glow behind the character */
.qsl-glow{position:absolute;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(245,168,0,.6),rgba(245,168,0,0) 68%);z-index:0;bottom:8px;animation:qslGlow 1.8s ease-in-out infinite}
@keyframes qslGlow{0%,100%{transform:scale(.75);opacity:.5}50%{transform:scale(1.2);opacity:.95}}

/* stars orbiting the character */
.qsl-orbit{position:absolute;top:44%;left:50%;width:0;height:0;z-index:2;animation:qslSpin 7s linear infinite}
.qsl-orbit-rev{animation-direction:reverse;animation-duration:9s}

/* twinkling sparkles */
.qsl-spark{position:absolute;z-index:2;animation:qslSpark 1.7s ease-in-out infinite}
@keyframes qslSpark{0%,100%{transform:scale(0) rotate(0);opacity:0}45%{transform:scale(1) rotate(120deg);opacity:1}}

/* one-shot confetti CANNON burst from the centre on load */
.qsl-burst{position:absolute;left:50%;top:44%;z-index:4;opacity:0;animation:qslBurst 1.1s cubic-bezier(.12,.7,.25,1) forwards}
@keyframes qslBurst{0%{transform:translate(-50%,-50%) scale(.3);opacity:1}70%{opacity:1}100%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) rotate(var(--rot));opacity:0}}

/* continuous confetti rain with a side-to-side wiggle */
.qsl-confetti{position:absolute;top:-24px;display:block;z-index:3;animation-name:qslFall;animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes qslFall{0%{transform:translateY(-24px) translateX(0) rotate(0);opacity:0}12%{opacity:1}50%{transform:translateY(200px) translateX(16px) rotate(360deg)}100%{transform:translateY(430px) translateX(-8px) rotate(700deg);opacity:.1}}

/* "APPROVED" stamp that slams in with a shockwave ring */
.qsl-stamp{position:absolute;top:2px;right:9%;z-index:5;animation:qslStamp .55s .3s cubic-bezier(.2,1.7,.4,1) both}
@keyframes qslStamp{0%{transform:scale(2.6) rotate(-24deg);opacity:0}55%{transform:scale(.88) rotate(7deg);opacity:1}100%{transform:scale(1) rotate(-8deg);opacity:1}}
.qsl-shock{position:absolute;top:14px;right:13%;width:54px;height:54px;border:3px solid ${PASS};border-radius:50%;z-index:4;animation:qslShock .7s .32s ease-out both}
@keyframes qslShock{0%{transform:scale(.2);opacity:.7}100%{transform:scale(2);opacity:0}}

/* floating Zzz for the spent-link snooze */
.qsl-z{position:absolute;font-weight:900;color:#8a8172;z-index:2;animation:qslZ 2.6s ease-in-out infinite}
@keyframes qslZ{0%{transform:translateY(6px) scale(.5);opacity:0}25%{opacity:.9}100%{transform:translateY(-50px) scale(1.25) rotate(14deg);opacity:0}}

.qsl-cta{display:inline-block;padding:12px 18px;border-radius:8px;font-weight:800;font-size:14px;text-decoration:none;transition:transform .12s cubic-bezier(.2,1.4,.5,1),box-shadow .12s}
.qsl-cta:hover{transform:translateY(-2px) scale(1.03)}
.qsl-cta:active{transform:translateY(1px) scale(.98)}

@media (prefers-reduced-motion: reduce){.qsl-pop,.qsl-title-pop,.qsl-hop,.qsl-breathe,.qsl-shadow,.qsl-blink,.qsl-armL,.qsl-armR,.qsl-rays,.qsl-glow,.qsl-orbit,.qsl-spark,.qsl-burst,.qsl-confetti,.qsl-stamp,.qsl-shock,.qsl-z{animation:none!important}.qsl-burst,.qsl-shock{opacity:0!important}}
`;

const SPARKS = [
  { x: "10%", y: "6%", s: 20, d: 0 },
  { x: "84%", y: "10%", s: 16, d: 0.3 },
  { x: "4%", y: "50%", s: 14, d: 0.6 },
  { x: "90%", y: "46%", s: 22, d: 0.15 },
  { x: "22%", y: "74%", s: 13, d: 0.5 },
  { x: "76%", y: "76%", s: 17, d: 0.8 },
];

// Orbiting stars: fixed angle/radius inside a slowly rotating container.
const ORBIT = [
  { a: 0, r: 78, s: 15, c: GOLD },
  { a: 120, r: 78, s: 12, c: PASS },
  { a: 240, r: 78, s: 13, c: "#3B82C4" },
];

// Confetti-cannon burst: 26 chips fired radially outward from the centre.
const BURST = Array.from({ length: 26 }).map((_, i) => {
  const ang = (i / 26) * Math.PI * 2 + (i % 2 ? 0.22 : -0.22);
  const dist = 96 + ((i * 41) % 78);
  const colors = [GOLD, PASS, "#3B82C4", FAIL, "#E24AA0", COAL];
  return {
    tx: `${Math.round(Math.cos(ang) * dist)}px`,
    ty: `${Math.round(Math.sin(ang) * dist)}px`,
    rot: `${(i * 57) % 360}deg`,
    c: colors[i % colors.length],
    size: 7 + (i % 3) * 3,
    round: i % 2,
  };
});

function ResultCard({ mood, celebrate, title, message, sub, serial }) {
  const accent = mood === "happy" ? PASS : mood === "sad" ? FAIL : MUTE;
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <style>{RESULT_CSS}</style>
      {celebrate && (
        <>
          <Confetti />
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 }}>
            {BURST.map((b, i) => (
              <span
                key={i}
                className="qsl-burst"
                style={{ "--tx": b.tx, "--ty": b.ty, "--rot": b.rot, width: b.size, height: b.round ? b.size : b.size * 0.55, background: b.c, borderRadius: b.round ? "50%" : 1 }}
              />
            ))}
          </div>
        </>
      )}
      <div className="qsl-pop" style={{ background: "#fff", border: "1px solid #e6e0d2", borderTop: `5px solid ${accent}`, borderRadius: 10, padding: "26px 20px 30px", marginTop: 24, textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* stage for the character + its effects */}
        <div style={{ position: "relative", height: 184, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          {celebrate && (
            <>
              <div className="qsl-rays" aria-hidden style={{ opacity: 0.4 }}><Rays /></div>
              <div className="qsl-glow" />
              <div className="qsl-orbit" aria-hidden>
                {ORBIT.map((o, i) => (
                  <span key={i} style={{ position: "absolute", transform: `rotate(${o.a}deg) translateX(${o.r}px)` }}>
                    <Sparkle size={o.s} color={o.c} />
                  </span>
                ))}
              </div>
              {SPARKS.map((sp, i) => (
                <span key={i} className="qsl-spark" aria-hidden style={{ left: sp.x, top: sp.y, animationDelay: `${sp.d}s` }}>
                  <Sparkle size={sp.s} color={i % 2 ? GOLD : PASS} />
                </span>
              ))}
              <div className="qsl-shock" aria-hidden />
              <div className="qsl-stamp" aria-hidden><Seal /></div>
            </>
          )}
          {mood === "sleep" && (
            <div aria-hidden style={{ position: "absolute", top: 6, left: "58%" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="qsl-z" style={{ left: i * 12, fontSize: 13 + i * 5, animationDelay: `${i * 0.7}s` }}>z</span>
              ))}
            </div>
          )}
          <div style={{ width: 156, height: 172, position: "relative", zIndex: 1 }}>
            <Mascot mood={mood} />
          </div>
        </div>
        <h1 style={{ fontSize: 22, color: INK, margin: "6px 0 0" }}>
          <span className="qsl-title-pop">{title}</span>
        </h1>
        <p style={{ color: INK, marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>{message}</p>
        {sub && <p style={{ color: MUTE, fontSize: 13, marginTop: 6 }}>{sub}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 18 }}>
          <a href="/overview" className="qsl-cta" style={{ background: COAL, color: "#fff" }}>Go to the dashboard →</a>
          {serial && (
            <a href={`/reports/${serial}`} className="qsl-cta" style={{ background: "#fff", color: INK, border: "1px solid #cfc8ba" }}>View the report</a>
          )}
        </div>
      </div>
    </div>
  );
}

function Sparkle({ size = 16, color = GOLD }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "block" }}>
      <path d="M12 0c1 6 5 10 12 12-7 2-11 6-12 12-1-6-5-10-12-12 7-2 11-6 12-12z" />
    </svg>
  );
}

// A gold sunburst used as the celebratory backdrop.
function Rays() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: "block" }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <path key={i} d="M50 50 L45 0 L55 0 Z" fill={GOLD} opacity={i % 2 ? 0.22 : 0.4} transform={`rotate(${i * 30} 50 50)`} />
      ))}
    </svg>
  );
}

// The green "APPROVED ✓" reward seal.
function Seal() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="24" fill={PASS} stroke="#fff" strokeWidth="3" />
      <path d="M17 29 l7 7 15 -16" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Confetti() {
  const colors = [GOLD, PASS, "#3B82C4", FAIL, "#E24AA0", COAL];
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}>
      {Array.from({ length: 26 }).map((_, i) => {
        const left = (i * 3.9 + (i % 3) * 4) % 100;
        const size = 7 + (i % 3) * 3;
        return (
          <span
            key={i}
            className="qsl-confetti"
            style={{
              left: `${left}%`,
              background: colors[i % colors.length],
              width: size,
              height: size * 0.6,
              animationDelay: `${(i % 10) * 0.2}s`,
              animationDuration: `${2.4 + (i % 5) * 0.35}s`,
              borderRadius: i % 2 ? 2 : 0,
            }}
          />
        );
      })}
    </div>
  );
}

// A bouncy QSL calibration test-weight character. mood: happy | sad | sleep.
function Mascot({ mood }) {
  const lively = mood !== "sleep";
  const eyes =
    mood === "sleep" ? (
      <>
        <path d="M44 62 q6 5 12 0" />
        <path d="M64 62 q6 5 12 0" />
      </>
    ) : (
      <g className="qsl-blink">
        <circle cx="50" cy="61" r="4.8" fill="#161310" stroke="none" />
        <circle cx="70" cy="61" r="4.8" fill="#161310" stroke="none" />
        {/* sparkle glints */}
        <circle cx="51.6" cy="59.4" r="1.4" fill="#fff" stroke="none" />
        <circle cx="71.6" cy="59.4" r="1.4" fill="#fff" stroke="none" />
      </g>
    );
  const mouth =
    mood === "happy" ? (
      <>
        <path d="M44 72 q16 17 32 0" fill="#7a2f24" stroke="#161310" />
        <path d="M51 79 q9 7 18 0" fill="#e0563f" stroke="none" />
      </>
    ) : mood === "sad" ? (
      <path d="M48 80 q12 -11 24 0" />
    ) : (
      <path d="M55 78 h10" />
    );
  return (
    <svg viewBox="0 0 120 132" width="100%" height="100%" fill="none" stroke="#161310" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      {/* ground shadow */}
      <ellipse className="qsl-shadow" cx="60" cy="128" rx="30" ry="5" fill="#161310" stroke="none" />
      <g className={lively ? "qsl-hop" : "qsl-breathe"}>
        {/* arms — both thrown up cheering on a win */}
        {mood === "happy" ? (
          <>
            <g className="qsl-armL"><path d="M42 74 q-12 -6 -14 -20" /><circle cx="28" cy="52" r="3" fill={GOLD} /></g>
            <g className="qsl-armR"><path d="M78 74 q12 -6 14 -20" /><circle cx="92" cy="52" r="3" fill={GOLD} /></g>
          </>
        ) : (
          <>
            <path d="M42 80 q-8 6 -8 15" />
            <path d="M78 80 q8 6 8 15" />
          </>
        )}
        {/* carry handle */}
        <path d="M50 40 q10 -16 20 0" />
        {/* body — a calibration test weight */}
        <path d="M42 44 h36 l8 58 h-52 z" fill={GOLD} />
        {/* little feet */}
        {lively && (
          <>
            <ellipse cx="48" cy="104" rx="7" ry="4" fill="#161310" stroke="none" />
            <ellipse cx="72" cy="104" rx="7" ry="4" fill="#161310" stroke="none" />
          </>
        )}
        {eyes}
        {mouth}
        {lively && (
          <>
            <circle cx="41" cy="71" r="3.6" fill="#e8763a" stroke="none" opacity="0.6" />
            <circle cx="79" cy="71" r="3.6" fill="#e8763a" stroke="none" opacity="0.6" />
          </>
        )}
      </g>
    </svg>
  );
}
