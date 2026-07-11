import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { rolesOf } from "@/lib/roles";

export const dynamic = "force-dynamic";

// GET /api/feedback?manage=1 — administrators read submitted feedback.
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const { searchParams } = new URL(req.url);
  if (!searchParams.get("manage") || !rolesOf(user).includes("ADMIN"))
    return Response.json({ error: "Not allowed." }, { status: 403 });

  const list = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const count = list.length;
  const avg = count ? Math.round((list.reduce((s, f) => s + f.rating, 0) / count) * 10) / 10 : 0;
  return Response.json({
    feedback: list.map((f) => ({
      id: f.id,
      rating: f.rating,
      comment: f.comment,
      userName: f.userName,
      userEmail: f.userEmail,
      createdAt: f.createdAt,
    })),
    stats: { count, average: avg },
  });
}

// POST /api/feedback — any signed-in user submits a rating (1..5) + comment.
export async function POST(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const b = await req.json().catch(() => ({}));
  const rating = Math.round(Number(b.rating));
  if (!(rating >= 1 && rating <= 5))
    return Response.json({ error: "Choose a rating from 1 to 5 stars." }, { status: 400 });
  const comment = String(b.comment || "").trim().slice(0, 2000) || null;

  await prisma.feedback.create({
    data: {
      userId: user.sub,
      userName: user.name || "",
      userEmail: user.email || "",
      rating,
      comment,
    },
  });
  return Response.json({ ok: true });
}
