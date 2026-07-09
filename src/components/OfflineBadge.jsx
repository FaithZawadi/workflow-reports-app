"use client";
import { useEffect, useState } from "react";
import { WAIT } from "@/lib/theme";

// A thin strip under the header shown whenever the device loses its connection,
// so users know why live data may be stale and that new entries will sync later.
export default function OfflineBadge() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      style={{
        background: WAIT,
        color: "#fff",
        fontSize: 12,
        fontWeight: 800,
        textAlign: "center",
        padding: "5px 12px",
        letterSpacing: ".02em",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
      Offline — showing saved data. New reports will sync when you&apos;re back online.
    </div>
  );
}
