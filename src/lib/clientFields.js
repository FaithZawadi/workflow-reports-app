// Shared sanitiser for the optional Client registration fields. Only keys that
// are present in the request body are returned, so a PATCH updates just what
// was sent. Empty strings become null (clears the field).
const TEXT_FIELDS = [
  "displayName",
  "clientType",
  "contactPerson",
  "contactEmail",
  "contactPhone",
  "billingEmail",
  "taxPin",
  "regNo",
  "address",
  "city",
  "country",
  "website",
  "notes",
];

const STATUSES = ["ACTIVE", "PROSPECT", "INACTIVE"];

export function clientDetailData(body = {}) {
  const data = {};
  for (const k of TEXT_FIELDS) {
    if (body[k] !== undefined) {
      const v = String(body[k] ?? "").trim();
      data[k] = v || null;
    }
  }
  if (body.status !== undefined) {
    const s = String(body.status || "").toUpperCase();
    data.status = STATUSES.includes(s) ? s : "ACTIVE";
  }
  if (body.accountManagerId !== undefined) {
    const id = String(body.accountManagerId || "").trim();
    data.accountManagerId = id || null;
  }
  if (body.onboardedAt !== undefined) {
    const d = body.onboardedAt ? new Date(body.onboardedAt) : null;
    data.onboardedAt = d && !isNaN(d.getTime()) ? d : null;
  }
  return data;
}

// Location fields for a Site.
const SITE_TEXT = ["address", "city", "contactPerson", "contactPhone", "notes"];
export function siteDetailData(body = {}) {
  const data = {};
  for (const k of SITE_TEXT) {
    if (body[k] !== undefined) {
      const v = String(body[k] ?? "").trim();
      data[k] = v || null;
    }
  }
  for (const k of ["lat", "lng"]) {
    if (body[k] !== undefined) {
      if (body[k] === "" || body[k] === null) {
        data[k] = null;
      } else {
        const n = Number(body[k]);
        data[k] = isNaN(n) ? null : n;
      }
    }
  }
  return data;
}
