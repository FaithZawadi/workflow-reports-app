import { requireUser } from "@/lib/auth";
import { canGenerateReports, rolesOf } from "@/lib/roles";
import { buildManagementReport } from "@/lib/managementReport";
import { ROLE_LABEL } from "@/lib/theme";

export const dynamic = "force-dynamic";

// GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// The role-scoped management report as JSON (for the on-screen page).
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canGenerateReports(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  const client = (searchParams.get("client") || "").trim() || null;

  const data = await buildManagementReport(user, { from, to, client });
  const role = rolesOf(user)[0] || "";
  return Response.json({
    ...data,
    generatedByName: user.name || user.email,
    generatedByRole: ROLE_LABEL[role] || role.replace(/_/g, " "),
  });
}
