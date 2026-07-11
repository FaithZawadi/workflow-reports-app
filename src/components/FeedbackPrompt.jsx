"use client";
import { useEffect, useState } from "react";
import { GOLD, COAL } from "@/lib/theme";

const KEY = "qsl-feedback";
const DAY = 86400000;
// How long to wait before the prompt may appear again, by outcome.
const SNOOZE = { submitted: 120 * DAY, later: 3 * DAY, dismissed: 30 * DAY };
// Delay before it surfaces in a session, so it never interrupts the first click.
const APPEAR_AFTER_MS = 25000;

function readState() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function writeState(reason) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ until: Date.now() + (SNOOZE[reason] || SNOOZE.dismissed) }));
  } catch {}
}

// A gentle, periodic "how's the app working?" prompt. Appears once per session
// after a short delay, then snoozes for a while based on what the user did.
export default function FeedbackPrompt() {
  const [show, setShow] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const st = readState();
    if (st.until && Date.now() < st.until) return; // still snoozed
    const t = setTimeout(() => {
      // Don't nag while offline — the submit needs the network.
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      setShow(true);
    }, APPEAR_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  const close = (reason) => {
    writeState(reason);
    setShow(false);
  };

  const submit = async () => {
    if (!rating) return;
    setBusy(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
    } catch {
      /* best-effort — still snooze so we don't loop */
    }
    setBusy(false);
    writeState("submitted");
    setDone(true);
    setTimeout(() => setShow(false), 1600);
  };

  if (!show) return null;

  const stars = [1, 2, 3, 4, 5];
  return (
    <div
      role="dialog"
      aria-label="Rate the QSL app"
      className="app-toast"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 46,
        maxWidth: 520,
        margin: "0 auto",
        background: COAL,
        color: "#fff",
        border: `1px solid ${GOLD}`,
        borderRadius: 6,
        padding: 14,
        boxShadow: "0 8px 24px rgba(0,0,0,.28)",
      }}
    >
      {done ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ fontSize: 22 }}>🙏</span>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Thank you — your feedback was sent.</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>How is the QSL app working for you?</div>
            <button
              onClick={() => close("dismissed")}
              aria-label="Close"
              style={{ background: "none", border: 0, color: "#cfc8ba", fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 0 }}
            >
              ×
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#e7e0cf", marginTop: 2 }}>Tap a star to rate it — add a note if you like.</div>

          <div style={{ display: "flex", gap: 4, margin: "10px 0" }} onMouseLeave={() => setHover(0)}>
            {stars.map((n) => {
              const on = (hover || rating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                  style={{ background: "none", border: 0, cursor: "pointer", padding: 2, fontSize: 28, lineHeight: 1, color: on ? GOLD : "#5a5348" }}
                >
                  {on ? "★" : "☆"}
                </button>
              );
            })}
          </div>

          <textarea
            className="input"
            rows={2}
            placeholder="What's working well, or what could be better? (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ resize: "vertical", fontSize: 13 }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button onClick={() => close("later")} className="btn" style={{ fontSize: 12, padding: "8px 10px", background: "transparent", color: "#fff", borderColor: "#5a5348" }}>
              Maybe later
            </button>
            <button onClick={submit} disabled={!rating || busy} className="btn" style={{ fontSize: 12, padding: "8px 14px", background: rating ? GOLD : "#5a5348", color: rating ? COAL : "#cfc8ba", borderColor: rating ? GOLD : "#5a5348", fontWeight: 800 }}>
              {busy ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
