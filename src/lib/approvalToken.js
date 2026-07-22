import crypto from "crypto";
import { prisma } from "./db";

// One-click email approval tokens. A random token is emailed to the routed
// reviewer; only its SHA-256 hash is stored. The token is single-use, expires,
// and is scoped to a specific report + stage + reviewer email.

const TTL_DAYS = 14;

const hash = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

// Create a token for the reviewer routed to this stage. Returns the raw token
// and the ready-to-use links for the email. Best-effort: if the DB write fails
// we still return the app deep-link so the email is useful.
export async function createApprovalLinks(report, stage, emailOverride) {
  // When several Equipment Users are routed, each gets a link scoped to their own
  // email so any of them can act with one click.
  const email = emailOverride || (stage === "SUPERVISOR" ? report.supervisorEmail : report.managerEmail);
  const review = `${appUrl()}/reports/${report.serial}`;
  try {
    const raw = crypto.randomBytes(32).toString("base64url");
    await prisma.approvalToken.create({
      data: {
        tokenHash: hash(raw),
        reportSerial: report.serial,
        stage,
        email: String(email || "").trim().toLowerCase(),
        expiresAt: new Date(Date.now() + TTL_DAYS * 86400 * 1000),
      },
    });
    const base = `${appUrl()}/approve/${raw}`;
    return {
      review,
      open: base,
      approve: `${base}?action=approve`,
      reject: `${base}?action=reject`,
      hasToken: true,
    };
  } catch {
    return { review, open: review, approve: review, reject: review, hasToken: false };
  }
}

// Validate a raw token WITHOUT consuming it (for the landing page to show the
// report). Returns the token row + report, or a reason it's invalid.
export async function inspectToken(raw) {
  if (!raw) return { ok: false, reason: "missing" };
  const row = await prisma.approvalToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!row) return { ok: false, reason: "invalid" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };
  const report = await prisma.report.findUnique({
    where: { serial: row.reportSerial },
    include: { photos: { orderBy: { order: "asc" } }, trailEvents: { orderBy: { at: "asc" } } },
  });
  if (!report) return { ok: false, reason: "invalid" };
  // The token's stage must still match the report's current pending stage.
  const currentStage =
    report.status === "PENDING_SUPERVISOR" ? "SUPERVISOR" : report.status === "PENDING_MANAGER" ? "MANAGER" : null;
  if (currentStage !== row.stage) return { ok: false, reason: "stale", report };
  return { ok: true, row, report };
}

// Atomically consume a token (mark used) if it is still valid. Returns the row
// or null. The single-use guard is enforced by updating only when usedAt is null.
export async function consumeToken(raw) {
  const check = await inspectToken(raw);
  if (!check.ok) return { ok: false, reason: check.reason };
  const res = await prisma.approvalToken.updateMany({
    where: { id: check.row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (res.count !== 1) return { ok: false, reason: "used" };
  return { ok: true, row: check.row, report: check.report };
}
