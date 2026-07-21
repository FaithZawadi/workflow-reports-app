import { prisma } from "@/lib/db";
import { requireUser, getCurrentUser } from "@/lib/auth";
import { TRAINING_ROLES } from "@/lib/roles";
import { TRAINING_CRITERIA_KEYS, RECOMMEND_KEYS, TRAINING_MODE_KEYS } from "@/lib/training";

export const dynamic = "force-dynamic";

const clamp15 = (v) => {
  const n = Math.round(Number(v));
  return n >= 1 && n <= 5 ? n : null;
};

// POST /api/training-feedback — PUBLIC. A participant completes the MMS Training
// Feedback Form (reached via a shared link). If an HR user happens to be signed
// in (recording a paper response), the submission is attributed to them.
export async function POST(req) {
  const b = await req.json().catch(() => ({}));

  const traineeName = String(b.traineeName || "").trim();
  if (!traineeName) return Response.json({ error: "Please enter your name." }, { status: 400 });

  const criteria = {};
  if (b.criteria && typeof b.criteria === "object") {
    for (const k of TRAINING_CRITERIA_KEYS) {
      const v = clamp15(b.criteria[k]);
      if (v) criteria[k] = v;
    }
  }
  const overall = clamp15(b.overall);

  // Require at least one rating or comment so the form isn't empty spam.
  const answered =
    overall || Object.keys(criteria).length > 0 ||
    String(b.didWell || "").trim() || String(b.improve || "").trim() || String(b.additionalSupport || "").trim();
  if (!answered) return Response.json({ error: "Please rate at least one item or leave a comment." }, { status: 400 });

  const recommend = RECOMMEND_KEYS.includes(b.recommend) ? b.recommend : null;
  const mode = TRAINING_MODE_KEYS.includes(b.mode) ? b.mode : null;
  const trainingDate = b.trainingDate ? new Date(b.trainingDate) : null;

  // Optional attribution when an HR user records a response themselves.
  let recordedById = null, recordedByName = null;
  const user = await getCurrentUser().catch(() => null);
  if (user) { recordedById = user.sub; recordedByName = user.name || null; }

  const created = await prisma.trainingFeedback.create({
    data: {
      trainingTitle: String(b.trainingTitle || "").trim() || "Qalibrated Systems MMS Training",
      trainingDate: trainingDate && !isNaN(trainingDate) ? trainingDate : null,
      trainer: String(b.trainer || "").trim() || null,
      organization: String(b.organization || "").trim() || null,
      mode,
      traineeName,
      traineeRole: String(b.traineeRole || "").trim() || null,
      department: String(b.department || "").trim() || null,
      criteria: Object.keys(criteria).length ? criteria : undefined,
      overall,
      didWell: String(b.didWell || "").trim().slice(0, 4000) || null,
      improve: String(b.improve || "").trim().slice(0, 4000) || null,
      additionalSupport: String(b.additionalSupport || "").trim().slice(0, 4000) || null,
      recommend,
      recordedById,
      recordedByName,
    },
  });
  return Response.json({ ok: true, id: created.id });
}

// GET /api/training-feedback — HR/admin review the recorded feedback.
export async function GET() {
  try {
    await requireUser(TRAINING_ROLES);
  } catch (res) {
    return res;
  }

  const list = await prisma.trainingFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
  const rated = list.filter((f) => f.overall);
  const average = rated.length
    ? Math.round((rated.reduce((s, f) => s + (f.overall || 0), 0) / rated.length) * 10) / 10
    : 0;
  const recommends = list.filter((f) => f.recommend === "YES").length;
  return Response.json({ feedback: list, stats: { count: list.length, average, rated: rated.length, recommends } });
}
