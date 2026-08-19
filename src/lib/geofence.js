// Geofencing helpers — distance between two GPS points and the on-site verdict.

// Great-circle distance in metres between two lat/lng points (haversine).
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius, metres
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const valid = (v) => v !== null && !Number.isNaN(v);

// Evaluate a filed location against a site's fence.
// Returns { status, distanceM }:
//   NO_LOCATION — the filer gave no location.
//   NO_FENCE    — the site has no coordinates to measure against.
//   LOCATED     — site has coordinates but no radius; distance recorded, no pass/fail.
//   INSIDE      — within the radius.
//   OUTSIDE     — beyond the radius.
export function evalGeofence({ filedLat, filedLng, siteLat, siteLng, radiusM }) {
  const fLat = num(filedLat), fLng = num(filedLng);
  const sLat = num(siteLat), sLng = num(siteLng);
  const r = num(radiusM);
  if (!valid(fLat) || !valid(fLng)) return { status: "NO_LOCATION", distanceM: null };
  if (!valid(sLat) || !valid(sLng)) return { status: "NO_FENCE", distanceM: null };
  const distanceM = Math.round(haversineMeters(fLat, fLng, sLat, sLng));
  if (!valid(r) || r <= 0) return { status: "LOCATED", distanceM };
  return { status: distanceM <= r ? "INSIDE" : "OUTSIDE", distanceM };
}

// Human-friendly distance: "42 m" / "1.2 km".
export function fmtDistance(m) {
  if (m === null || m === undefined) return "";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

// Presentation metadata for a geofence status (label + tone key).
export const GEOFENCE_META = {
  INSIDE: { label: "On-site", tone: "pass", icon: "📍" },
  OUTSIDE: { label: "Off-site", tone: "fail", icon: "⚠" },
  LOCATED: { label: "Location recorded", tone: "ink", icon: "📍" },
  NO_FENCE: { label: "No site fence", tone: "mute", icon: "" },
  NO_LOCATION: { label: "No location", tone: "mute", icon: "" },
};

// One-line summary for a report, e.g. "On-site · 42 m from site" or
// "Off-site · 1.2 km from site". Returns "" when there is nothing to show.
export function geofenceSummary(status, distanceM, siteName) {
  const meta = GEOFENCE_META[status];
  if (!meta || status === "NO_LOCATION" || status === "NO_FENCE") return "";
  const dist = distanceM != null ? ` · ${fmtDistance(distanceM)} from ${siteName || "site"}` : "";
  return `${meta.label}${dist}`;
}
