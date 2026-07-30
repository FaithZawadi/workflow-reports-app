"use client";
import { useEffect } from "react";

// Route-level error boundary — catches render/data errors in any page and shows
// a branded recovery screen instead of a raw crash.
export default function Error({ error, reset }) {
  useEffect(() => {
    // Surface to the browser console; server logs capture the full stack.
    console.error(error);
  }, [error]);

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={badge}>Something went wrong</div>
        <h1 style={h1}>We hit an unexpected error</h1>
        <p style={p}>The problem has been logged. You can try again, or head back to your dashboard.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => reset()} style={btnDark}>Try again</button>
          <a href="/dashboard" style={btn}>Go to dashboard</a>
        </div>
      </div>
    </div>
  );
}

const wrap = { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F5F0", padding: 24 };
const card = { background: "#fff", border: "1px solid #DDD6C8", borderRadius: 16, padding: "34px 30px", maxWidth: 440, textAlign: "center", boxShadow: "0 8px 30px rgba(20,16,10,.10)" };
const badge = { display: "inline-block", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "#B03A2E", background: "rgba(176,58,46,.1)", padding: "5px 11px", borderRadius: 999 };
const h1 = { fontSize: 21, fontWeight: 900, color: "#26221C", margin: "12px 0 8px" };
const p = { fontSize: 14, color: "#6B6355", lineHeight: 1.5, margin: "0 0 18px" };
const btn = { display: "inline-block", background: "#fff", color: "#26221C", border: "1px solid #DDD6C8", fontWeight: 800, fontSize: 13.5, padding: "11px 18px", borderRadius: 10, textDecoration: "none" };
const btnDark = { background: "#161310", color: "#F5A800", border: "1px solid #161310", fontWeight: 800, fontSize: 13.5, padding: "11px 18px", borderRadius: 10, cursor: "pointer" };
