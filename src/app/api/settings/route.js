import { requireUser } from "@/lib/auth";
import { rolesOf } from "@/lib/roles";
import { getSettings, saveSettings } from "@/lib/settings";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// System Settings are admin-only. GET returns the full merged config; PUT saves
// a per-group patch.
async function requireAdmin() {
  const user = await requireUser();
  if (!rolesOf(user).includes("ADMIN")) {
    throw Response.json({ error: "Only an administrator can change system settings." }, { status: 403 });
  }
  return user;
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res;
  }
  const settings = await getSettings({ fresh: true });
  return Response.json({ settings });
}

// Sanitise incoming values by group so the stored blob only ever holds the
// known keys with sane types.
function clean(patch) {
  const out = {};
  const str = (v) => (v == null ? "" : String(v)).trim();
  const num = (v, min, max, dflt) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.min(max, Math.max(min, n));
  };
  const bool = (v) => v === true || v === "true";

  if (patch.company) {
    const c = patch.company;
    out.company = {
      name: str(c.name), postal: str(c.postal), address: str(c.address),
      website: str(c.website), email: str(c.email), phone: str(c.phone),
      pin: str(c.pin), tagline: str(c.tagline),
    };
  }
  if (patch.finance) {
    const f = patch.finance;
    out.finance = {
      currency: str(f.currency).toUpperCase().slice(0, 4) || "KES",
      vatRate: num(f.vatRate, 0, 100, 16),
      quoteValidityDays: Math.round(num(f.quoteValidityDays, 1, 365, 30)),
      quotePrefix: str(f.quotePrefix).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "Q",
      paymentDetails: str(f.paymentDetails),
      quoteTerms: str(f.quoteTerms),
    };
  }
  if (patch.reports) {
    const r = patch.reports;
    out.reports = {
      requirePhotos: bool(r.requirePhotos),
      requireOnSite: bool(r.requireOnSite),
      defaultGeofenceRadius: Math.round(num(r.defaultGeofenceRadius, 0, 100000, 150)),
    };
  }
  if (patch.workflow) {
    const w = patch.workflow;
    out.workflow = {
      clientApprovalRequired: bool(w.clientApprovalRequired),
      escalateAfterDays: Math.round(num(w.escalateAfterDays, 0, 90, 3)),
      contractReminderDays: str(w.contractReminderDays).replace(/[^0-9,]/g, "") || "30,14,7,1",
      emailEnabled: bool(w.emailEnabled),
    };
  }
  return out;
}

export async function PUT(req) {
  let user;
  try {
    user = await requireAdmin();
  } catch (res) {
    return res;
  }
  const body = await req.json().catch(() => ({}));
  const patch = clean(body || {});
  if (Object.keys(patch).length === 0) return Response.json({ error: "Nothing to save." }, { status: 400 });

  const settings = await saveSettings(patch, user);
  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: "app",
    summary: `System settings updated by ${user.name} (${Object.keys(patch).join(", ")})`,
  });
  return Response.json({ settings });
}
