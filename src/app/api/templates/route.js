import { requireUser } from "@/lib/auth";
import { TEMPLATES, templatesForRoles } from "@/lib/templates";
import { rolesOf } from "@/lib/roles";

export const dynamic = "force-dynamic";

// GET /api/templates — the report form catalogue, so the mobile app renders the
// exact same forms as the web app (single source of truth). Returns all
// templates plus which codes the signed-in user may file.
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const allowed = templatesForRoles(rolesOf(user)).map((t) => t.code);
  return Response.json({ templates: TEMPLATES, allowed });
}
