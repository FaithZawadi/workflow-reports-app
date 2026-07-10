"use client";
import { useState } from "react";
import { MUTE, INK } from "@/lib/theme";

// A password field with a show/hide ("reveal") toggle. Passes every other prop
// straight through to the underlying <input>, so it drops in wherever a plain
// password input was used.
export default function PasswordInput({ className = "input", style, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        {...props}
        type={show ? "text" : "password"}
        className={className}
        style={{ ...style, paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: 0,
          cursor: "pointer",
          color: show ? INK : MUTE,
          padding: 0,
        }}
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function Eye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
