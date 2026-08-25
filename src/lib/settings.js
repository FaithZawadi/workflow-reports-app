import { prisma } from "./db";
import { COMPANY, DEFAULT_PAYMENT_DETAILS, DEFAULT_QUOTE_TERMS } from "./company";

// The singleton row id.
const ROW_ID = "app";

// Default settings. Env values seed the defaults so an existing deployment keeps
// its current behaviour until an admin changes something in System Settings.
// The DB row only stores the keys an admin has actually edited; getSettings()
// deep-merges the stored values over these defaults.
export function defaultSettings() {
  return {
    company: {
      name: COMPANY.name,
      postal: COMPANY.postal,
      address: COMPANY.address,
      website: COMPANY.website,
      email: COMPANY.email,
      phone: COMPANY.phone,
      pin: COMPANY.pin,
      tagline: COMPANY.tagline,
    },
    finance: {
      currency: "KES",
      vatRate: 16,
      quoteValidityDays: 30,
      quotePrefix: "Q",
      paymentDetails: DEFAULT_PAYMENT_DETAILS,
      quoteTerms: DEFAULT_QUOTE_TERMS,
    },
    reports: {
      requirePhotos: false, // must a report carry at least one photo?
      requireOnSite: false, // reject a filing taken outside the site fence?
      defaultGeofenceRadius: 150, // metres, applied when a site has no radius set
    },
    workflow: {
      clientApprovalRequired: true, // technician-registered clients need approval
      escalateAfterDays: Number(process.env.ESCALATE_AFTER_DAYS) || 3,
      contractReminderDays: process.env.CONTRACT_REMINDER_DAYS || "30,14,7,1",
      emailEnabled: process.env.EMAIL_ENABLED === "true", // master email switch
    },
  };
}

// Shallow-per-group deep merge: stored group values override defaults, unknown
// groups/keys are ignored so a stale row can never inject junk.
function mergeSettings(stored) {
  const base = defaultSettings();
  if (!stored || typeof stored !== "object") return base;
  const out = {};
  for (const group of Object.keys(base)) {
    out[group] = { ...base[group], ...(stored[group] && typeof stored[group] === "object" ? stored[group] : {}) };
  }
  return out;
}

// Short-lived process cache — settings are read on many hot paths (every report
// submit, every email) but change rarely. Best-effort across serverless
// instances; a save busts this instance immediately.
let _cache = null;
let _cacheAt = 0;
const TTL_MS = 15000;

export async function getSettings({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && _cache && now - _cacheAt < TTL_MS) return _cache;
  let row = null;
  try {
    row = await prisma.setting.findUnique({ where: { id: ROW_ID } });
  } catch {
    // Table missing (pre-migration) or DB hiccup — fall back to defaults.
    return mergeSettings(null);
  }
  _cache = mergeSettings(row?.data);
  _cacheAt = now;
  return _cache;
}

// Persist a patch (per-group partial). Merges over whatever is stored so a save
// of one group never wipes another. Admin-only — enforced by the API route.
export async function saveSettings(patch, user) {
  const existing = await prisma.setting.findUnique({ where: { id: ROW_ID } }).catch(() => null);
  const current = (existing?.data && typeof existing.data === "object") ? existing.data : {};
  const next = { ...current };
  for (const group of Object.keys(patch || {})) {
    if (patch[group] && typeof patch[group] === "object") {
      next[group] = { ...(current[group] || {}), ...patch[group] };
    }
  }
  const saved = await prisma.setting.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, data: next, updatedById: user?.sub || null, updatedByName: user?.name || null },
    update: { data: next, updatedById: user?.sub || null, updatedByName: user?.name || null },
  });
  _cache = mergeSettings(saved.data);
  _cacheAt = Date.now();
  return _cache;
}

// Server-side company identity for PDFs/emails: DB company settings over the
// env/hardcoded COMPANY defaults. Bank block stays from COMPANY (edited via env).
export async function resolveCompany() {
  const s = await getSettings();
  return { ...COMPANY, ...s.company };
}

// PDF Document components read the shared COMPANY object at render time. Rather
// than thread a prop through every document, a PDF route calls this first to
// refresh COMPANY's fields from settings. Safe under concurrency: every request
// reads the same settings, so they all write identical values.
export async function syncCompany() {
  try {
    const s = await getSettings();
    Object.assign(COMPANY, s.company);
  } catch {
    // keep the env/default COMPANY on any failure
  }
  return COMPANY;
}
