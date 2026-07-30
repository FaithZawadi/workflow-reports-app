import Link from "next/link";

// Branded 404 shown for any unknown route.
export const metadata = { title: "Not found · QSL" };

export default function NotFound() {
  return (
    <div style={wrap}>
      <div style={card}>
        <div style={code}>404</div>
        <h1 style={h1}>Page not found</h1>
        <p style={p}>The page you’re looking for doesn’t exist or may have moved.</p>
        <Link href="/dashboard" style={btn}>Go to dashboard</Link>
      </div>
    </div>
  );
}

const wrap = { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F5F0", padding: 24 };
const card = { background: "#fff", border: "1px solid #DDD6C8", borderRadius: 16, padding: "34px 30px", maxWidth: 420, textAlign: "center", boxShadow: "0 8px 30px rgba(20,16,10,.10)" };
const code = { fontSize: 52, fontWeight: 900, color: "#F5A800", letterSpacing: "-.03em", fontFamily: "ui-monospace, Menlo, monospace" };
const h1 = { fontSize: 22, fontWeight: 900, color: "#26221C", margin: "6px 0 8px" };
const p = { fontSize: 14, color: "#6B6355", lineHeight: 1.5, margin: "0 0 18px" };
const btn = { display: "inline-block", background: "#161310", color: "#F5A800", fontWeight: 800, fontSize: 13.5, padding: "11px 20px", borderRadius: 10, textDecoration: "none" };
