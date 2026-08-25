import { prisma } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { USER_ADMIN_ROLES, MANAGER_ASSIGNABLE_ROLES, ALL_ROLES, assignableRoles, rolesOf } from "@/lib/roles";
import { sendMail, invitationEmail } from "@/lib/email";
import { ROLE_LABEL } from "@/lib/theme";
import crypto from "crypto";

const rolesOfRow = (u) => (u.roles && u.roles.length ? u.roles : [u.role]);

// A readable temporary password: easy to type once, still hard to guess.
function tempPassword() {
  const words = ["Weigh", "Scale", "Bridge", "Calib", "Metric", "Load", "Zero", "Deck", "Gauge", "Trust"];
  const w = words[crypto.randomInt(words.length)];
  const n = String(crypto.randomInt(1000, 9999));
  const sym = "!@#$%".charAt(crypto.randomInt(5));
  return `${w}${n}${sym}`;
}

export async function GET() {
  let me;
  try {
    me = await requireUser(USER_ADMIN_ROLES);
  } catch (res) {
    return res;
  }
  // Admins see everyone; managers see only the staff they can fully manage —
  // users who have at least one manageable role and none outside it.
  const elevated = ALL_ROLES.filter((r) => !MANAGER_ASSIGNABLE_ROLES.includes(r));
  const where = rolesOf(me).includes("ADMIN")
    ? {}
    : { AND: [{ roles: { hasSome: MANAGER_ASSIGNABLE_ROLES } }, { NOT: { roles: { hasSome: elevated } } }] };
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      servingClient: { select: { id: true, name: true } },
      assignedClients: { select: { id: true, name: true } },
      weighbridges: { select: { id: true, label: true } },
    },
  });
  return Response.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      roles: rolesOfRow(u),
      site: u.site,
      // Home organisation the person works for.
      orgType: u.orgType || "QSL",
      orgName: u.orgType === "CLIENT" ? u.client?.name || "Client" : "Qalibrated Systems",
      client: u.client?.name || null,
      // The client they are currently serving / deployed to.
      servingClientId: u.servingClientId || null,
      servingClient: u.servingClient?.name || null,
      // Explicit clients this user may file reports for.
      assignedClientIds: (u.assignedClients || []).map((c) => c.id),
      assignedClientNames: (u.assignedClients || []).map((c) => c.name),
      active: u.active,
      weighbridges: u.weighbridges,
    })),
  });
}

export async function POST(req) {
  let me;
  try {
    me = await requireUser(USER_ADMIN_ROLES);
  } catch (res) {
    return res;
  }
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  // Accept a `roles` array (multi-role) or a single `role` for backward compat.
  const roles = [...new Set((Array.isArray(body.roles) ? body.roles : [body.role]).map(String).filter(Boolean))];
  const site = String(body.site || "").trim() || null;
  const clientName = String(body.clientName || "").trim();

  const allowedRoles = assignableRoles(me);
  if (!email || !name || roles.length === 0 || !roles.every((r) => allowedRoles.includes(r)))
    return Response.json(
      { error: "Name, email and at least one role you are allowed to assign are required." },
      { status: 400 }
    );
  const role = roles[0]; // primary role
  // The account is invited with a temporary password (the admin may supply one,
  // otherwise it's generated) and the user must change it on first sign-in.
  if (password && password.length < 8)
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  const temp = password && password.length >= 8 ? password : tempPassword();

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return Response.json({ error: "A user with that email already exists." }, { status: 409 });

  // Home organisation: QSL (internal) or a client (employed by them).
  const orgType = String(body.orgType || "").toUpperCase() === "CLIENT" ? "CLIENT" : "QSL";
  const upsertClientByName = async (nm) => {
    const n = String(nm || "").trim();
    if (!n) return null;
    const c = await prisma.client.upsert({ where: { name: n }, create: { name: n }, update: {} });
    return c.id;
  };
  const resolveClientId = async (idVal, nameVal) => {
    const id = String(idVal || "").trim();
    if (id) return id;
    return upsertClientByName(nameVal);
  };

  // Employer client only applies to CLIENT-org people; for QSL staff the old
  // "client / plant" field is treated as who they serve.
  let clientId = null;
  let servingClientId = await resolveClientId(body.servingClientId, body.servingClientName);
  if (orgType === "CLIENT") {
    clientId = await resolveClientId(body.clientId, clientName || body.employerClientName);
    if (!servingClientId) servingClientId = clientId; // a client's own staff serve their own org
  } else if (!servingClientId && clientName) {
    servingClientId = await upsertClientByName(clientName);
  }

  // Optional explicit client assignment at creation.
  const assignIds = Array.isArray(body.assignedClientIds) ? body.assignedClientIds.map(String).filter(Boolean) : [];

  const user = await prisma.user.create({
    // passwordChangedAt=null keeps the account flagged as never-rotated; the
    // mustChangePassword gate forces the change on first sign-in.
    data: { email, name, passwordHash: await hashPassword(temp), passwordChangedAt: null, mustChangePassword: true, role, roles, site, orgType, clientId, servingClientId, ...(assignIds.length ? { assignedClients: { connect: assignIds.map((id) => ({ id })) } } : {}) },
  });
  await recordAudit({
    actor: me,
    action: "CREATE",
    entity: "USER",
    entityId: user.id,
    summary: `Invited ${roles.join(", ")} ${name} <${email}>`,
  });

  // Email the invitation with the temporary password (best-effort). The temp
  // password is also returned so the admin can pass it on if email is disabled.
  const rolesLabel = roles.map((r) => ROLE_LABEL?.[r] || r).join(", ");
  const mail = invitationEmail(email, name, temp, rolesLabel);
  const { sent } = await sendMail(mail).catch(() => ({ sent: false }));

  return Response.json({ user: { id: user.id, email: user.email, role: user.role }, tempPassword: temp, emailed: !!sent });
}
