// Local (per-device) drafts for the report form, so a half-filled report can be
// left and resumed. Keyed by template code. Stored in localStorage — private to
// the browser, never sent anywhere until the report is actually submitted.

const KEY = (tpl) => `qsl:draft:${tpl}`;

export function loadDraft(tpl) {
  if (!tpl || typeof window === "undefined") return null;
  try {
    const s = window.localStorage.getItem(KEY(tpl));
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

// Returns true, "no-photos" (saved but photos dropped for space), or false.
export function saveDraft(tpl, data) {
  if (!tpl || typeof window === "undefined") return false;
  const payload = { ...data, savedAt: Date.now() };
  try {
    window.localStorage.setItem(KEY(tpl), JSON.stringify(payload));
    return true;
  } catch {
    // Most likely the quota was hit by base64 photos — retry without them.
    try {
      window.localStorage.setItem(KEY(tpl), JSON.stringify({ ...payload, photos: [], photosDropped: true }));
      return "no-photos";
    } catch {
      return false;
    }
  }
}

export function clearDraft(tpl) {
  if (!tpl || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY(tpl));
  } catch {}
}

// A draft is worth offering only if it actually holds some input.
export function draftHasContent(d) {
  if (!d) return false;
  const nonEmpty = (o) => o && typeof o === "object" && Object.values(o).some((v) => v !== "" && v != null && !(typeof v === "object" && !Object.keys(v).length));
  return (
    nonEmpty(d.values) ||
    nonEmpty(d.checks) ||
    nonEmpty(d.grids) ||
    nonEmpty(d.runs) ||
    (Array.isArray(d.photos) && d.photos.length > 0) ||
    !!(d.clientName && d.clientName.trim && d.clientName.trim()) ||
    (Array.isArray(d.supervisorEmails) && d.supervisorEmails.some((e) => e))
  );
}
