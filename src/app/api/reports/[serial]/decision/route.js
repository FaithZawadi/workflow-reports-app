import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canAct } from "@/lib/rbac";
import { applyDecision } from "@/lib/decision";

export async function POST(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const decision = body.decision === "reject" ? "reject" : "approve";
  const comment = String(body.comment || "").trim();
  if (decision === "reject" && !comment)
    return Response.json({ error: "A comment is required to reject." }, { status: 400 });

  const report = await prisma.report.findUnique({ where: { serial: params.serial } });
  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });

  const stage = canAct(report, user); // "SUPERVISOR" | "MANAGER" | null
  if (!stage) return Response.json({ error: "You can't act on this report now." }, { status: 403 });

  const result = await applyDecision({
    report,
    stage,
    decision,
    comment,
    actor: { name: user.name, sub: user.sub, role: user.role },
  });

  return Response.json(result);
}
