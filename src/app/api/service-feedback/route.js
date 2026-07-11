import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageTasks } from "@/lib/roles";
import { SERVICE_TYPE_KEYS } from "@/lib/serviceTypes";

export const dynamic = "force-dynamic";

// POST /api/service-feedback — PUBLIC. A customer submits feedback / an enquiry
// after a service. No app account required (usually reached via a shared link).
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const serviceType = String(b.serviceType || "");
  if (!SERVICE_TYPE_KEYS.includes(serviceType))
    return Response.json({ error: "Choose the type of service." }, { status: 400 });
  const clientName = String(b.clientName || "").trim();
  if (!clientName) return Response.json({ error: "Enter your company name." }, { status: 400 });

  const rating = b.rating ? Math.round(Number(b.rating)) : null;
  const comments = String(b.comments || "").trim().slice(0, 4000) || null;
  if (!comments && !(rating >= 1 && rating <= 5))
    return Response.json({ error: "Add a rating or a comment." }, { status: 400 });

  const serviceDate = b.serviceDate ? new Date(b.serviceDate) : null;

  await prisma.serviceFeedback.create({
    data: {
      serviceType,
      clientName,
      contactName: String(b.contactName || "").trim() || null,
      contactEmail: String(b.contactEmail || "").trim() || null,
      contactPhone: String(b.contactPhone || "").trim() || null,
      weighbridge: String(b.weighbridge || "").trim() || null,
      serviceDate: serviceDate && !isNaN(serviceDate) ? serviceDate : null,
      rating: rating >= 1 && rating <= 5 ? rating : null,
      comments,
    },
  });
  return Response.json({ ok: true });
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
  const rated = list.filter((f) => f.rating);
  const average = rated.length ? Math.round((rated.reduce((s, f) => s + f.rating, 0) / rated.length) * 10) / 10 : 0;
  return Response.json({ feedback: list, stats: { count: list.length, average, rated: rated.length } });
}
