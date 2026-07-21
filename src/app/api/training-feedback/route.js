import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { TRAINING_ROLES } from "@/lib/roles";
import { TRAINING_CRITERIA_KEYS, RECOMMEND_KEYS } from "@/lib/training";

export const dynamic = "force-dynamic";

const clamp15 = (v) => {
  const n = Math.round(Number(v));
  return n >= 1 && n <= 5 ? n : null;
};

// POST /api/training-feedback — HR (or admin) records one attendee's evaluation.
export async function POST(req) {
  let user;
  try {
    user = await requireUser(TRAINING_ROLES);
  } catch (res) {
    return res;
  }
  const b = await req.json().catch(() => ({}));

  const traineeName = String(b.traineeName || "").trim();
  if (!traineeName) return Response.json({ error: "Enter the attendee's name." }, { status: 400 });

  const criteria = {};
  if (b.criteria && typeof b.criteria === "object") {
    for (const k of TRAINING_CRITERIA_KEYS) {
      const v = clamp15(b.criteria[k]);
      if (v) criteria[k] = v;
    }
  }
  const overall = clamp15(b.overall);
  const recommend = RECOMMEND_KEYS.includes(b.recommend) ? b.recommend : null;
  const trainingDate = b.trainingDate ? new Date(b.trainingDate) : null;

  const created = await prisma.trainingFeedback.create({
    data: {
      trainingTitle: String(b.trainingTitle || "").trim() || "QSL Maintenance App Training",
      trainingDate: trainingDate && !isNaN(trainingDate) ? trainingDate : null,
      trainer: String(b.trainer || "").trim() || null,
      traineeName,
      traineeRole: String(b.traineeRole || "").trim() || null,
      department: String(b.department || "").trim() || null,
      criteria: Object.keys(criteria).length ? criteria : undefined,
      overall,
      didWell: String(b.didWell || "").trim().slice(0, 4000) || null,
      improve: String(b.improve || "").trim().slice(0, 4000) || null,
      recommend,
      recordedById: user.sub,
      recordedByName: user.name || null,
    },
  });
  return Response.json({ ok: true, id: created.id });
}

// GET /api/training-feedback — HR/admin review the recorded feedback.
export async function GET() {
  let user;
  try {
    user = await requireUser(TRAINING_ROLES);
  } catch (res) {
    return res;
  }
  void user;

  const list = await prisma.trainingFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
  const rated = list.filter((f) => f.overall);
  const average = rated.length
    ? Math.round((rated.reduce((s, f) => s + (f.overall || 0), 0) / rated.length) * 10) / 10
    : 0;
  const recommends = list.filter((f) => f.recommend === "YES").length;
  return Response.json({ feedback: list, stats: { count: list.length, average, rated: rated.length, recommends } });
}
