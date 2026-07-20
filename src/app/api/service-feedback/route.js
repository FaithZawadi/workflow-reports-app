import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageTasks } from "@/lib/roles";
import { SURVEY_SERVICE_KEYS, SURVEY_CRITERIA_KEYS, COMPLAINT_HANDLING, YES_NO_UNSURE_KEYS } from "@/lib/survey";

export const dynamic = "force-dynamic";

const clamp15 = (v) => {
  const n = Math.round(Number(v));
  return n >= 1 && n <= 5 ? n : null;
};
const COMPLAINT_KEYS = COMPLAINT_HANDLING.map((c) => c.key);

// POST /api/service-feedback — PUBLIC. A customer submits the Customer
// Satisfaction Survey (CSSF). No app account required (reached via a shared link).
export async function POST(req) {
  const b = await req.json().catch(() => ({}));

  const clientName = String(b.clientName || "").trim();
  if (!clientName) return Response.json({ error: "Enter your organization name." }, { status: 400 });

  // §1 service types (multi-select).
  const serviceTypes = (Array.isArray(b.serviceTypes) ? b.serviceTypes : [])
    .map(String)
    .filter((s) => SURVEY_SERVICE_KEYS.includes(s));

  // §2 criteria ratings.
  const criteria = {};
  if (b.criteria && typeof b.criteria === "object") {
    for (const k of SURVEY_CRITERIA_KEYS) {
      const v = clamp15(b.criteria[k]);
      if (v) criteria[k] = v;
    }
  }

  const overall = clamp15(b.overall);
  const comments = String(b.comments || "").trim().slice(0, 4000) || null;

  // Require at least something meaningful so the form isn't empty spam.
  const answered =
    overall || Object.keys(criteria).length > 0 || comments || String(b.didWell || "").trim() || String(b.improve || "").trim();
  if (!answered) return Response.json({ error: "Please rate at least one item or leave a comment." }, { status: 400 });

  const serviceDate = b.serviceDate ? new Date(b.serviceDate) : null;
  const useAgain = YES_NO_UNSURE_KEYS.includes(b.useAgain) ? b.useAgain : null;
  const recommend = YES_NO_UNSURE_KEYS.includes(b.recommend) ? b.recommend : null;
  const complaintHandling = COMPLAINT_KEYS.includes(b.complaintHandling) ? b.complaintHandling : null;
  const hadProblem = typeof b.hadProblem === "boolean" ? b.hadProblem : null;

  const created = await prisma.serviceFeedback.create({
    data: {
      serviceTypes,
      clientName,
      contactName: String(b.contactName || "").trim() || null,
      contactEmail: String(b.contactEmail || "").trim() || null,
      contactPhone: String(b.contactPhone || "").trim() || null,
      weighbridge: String(b.weighbridge || "").trim() || null,
      serviceDate: serviceDate && !isNaN(serviceDate) ? serviceDate : null,
      rating: overall, // mirror for the list average
      overall,
      comments,
      criteria: Object.keys(criteria).length ? criteria : undefined,
      hadProblem,
      problemDetail: String(b.problemDetail || "").trim().slice(0, 4000) || null,
      complaintHandling,
      didWell: String(b.didWell || "").trim().slice(0, 4000) || null,
      improve: String(b.improve || "").trim().slice(0, 4000) || null,
      additionalServices: String(b.additionalServices || "").trim().slice(0, 4000) || null,
      useAgain,
      recommend,
    },
  });
  return Response.json({ ok: true, id: created.id });
}

// GET /api/service-feedback?manage=1 — managers/admin read submissions.
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const { searchParams } = new URL(req.url);
  if (!searchParams.get("manage") || !canManageTasks(user))
    return Response.json({ error: "Not allowed." }, { status: 403 });

  const list = await prisma.serviceFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const rated = list.filter((f) => f.overall || f.rating);
  const average = rated.length
    ? Math.round((rated.reduce((s, f) => s + (f.overall || f.rating || 0), 0) / rated.length) * 10) / 10
    : 0;
  const recommends = list.filter((f) => f.recommend === "YES").length;
  return Response.json({ feedback: list, stats: { count: list.length, average, rated: rated.length, recommends } });
}
