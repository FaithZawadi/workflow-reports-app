import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clip = (v, n) => (v == null ? null : String(v).slice(0, n));

// Coarse device class from the User-Agent — enough for a mobile/desktop split.
function deviceFromUA(ua) {
  const s = (ua || "").toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return "tablet";
  if (/mobi|android|iphone|ipod|phone/.test(s)) return "mobile";
  return "desktop";
}

// Referrer reduced to its host (external) or kept as an internal path — we never
// store query strings or anything identifying.
function refClass(ref) {
  if (!ref) return null;
  try {
    return new URL(ref).host || null;
  } catch {
    return clip(ref, 120);
  }
}

// POST /api/track  { type, path, ref?, label?, sessionId }
// Public — page views are counted for signed-out visitors too. The signed-in
// user (if any) is attached server-side; the client never sends identity.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const type = body.type === "click" ? "click" : body.type === "pageview" ? "pageview" : null;
  const path = clip(body.path, 200);
  const sessionId = clip(body.sessionId, 80);
  if (!type || !path || !sessionId) return Response.json({ ok: false }, { status: 400 });

  const ua = headers().get("user-agent") || "";
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    /* signed-out visitor */
  }

  try {
    await prisma.visitEvent.create({
      data: {
        type,
        path,
        ref: refClass(body.ref),
        label: clip(body.label, 120),
        sessionId,
        userId: user?.sub || null,
        role: user ? (user.roles?.[0] || user.role || null) : null,
        device: deviceFromUA(ua),
      },
    });
  } catch {
    // Analytics must never break the app — swallow write errors.
  }
  return Response.json({ ok: true });
}
