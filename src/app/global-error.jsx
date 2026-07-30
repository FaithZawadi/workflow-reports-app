"use client";
import { useEffect } from "react";

// Last-resort boundary for errors thrown in the root layout itself. It must
// render its own <html>/<body> because the normal layout has failed.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F5F0", padding: 24 }}>
          <div style={{ background: "#fff", border: "1px solid #DDD6C8", borderRadius: 16, padding: "34px 30px", maxWidth: 440, textAlign: "center", boxShadow: "0 8px 30px rgba(20,16,10,.10)" }}>
            <h1 style={{ fontSize: 21, fontWeight: 900, color: "#26221C", margin: "0 0 8px" }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#6B6355", lineHeight: 1.5, margin: "0 0 18px" }}>The app hit an unexpected error and has logged it. Please try again.</p>
            <button onClick={() => reset()} style={{ background: "#161310", color: "#F5A800", border: "1px solid #161310", fontWeight: 800, fontSize: 13.5, padding: "11px 20px", borderRadius: 10, cursor: "pointer" }}>Try again</button>
          </div>
        </div>
      </body>
    </html>
  );
}
