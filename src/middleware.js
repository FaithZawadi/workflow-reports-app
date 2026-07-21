import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";

// Protect the authenticated app area and redirect signed-in users away from login.
const PROTECTED = ["/overview", "/dashboard", "/reports", "/schedule", "/users", "/weighbridges", "/audit", "/account", "/quotations", "/calibration-requests", "/training-feedback"];

// Areas a client-only login must NOT reach (staff tools). They are bounced to
// their own portal home.
const STAFF_ONLY = ["/dashboard", "/reports", "/schedule", "/users", "/weighbridges", "/audit", "/sites", "/feedback", "/projects", "/contracts", "/tasks", "/customer-feedback", "/training-feedback"];
const CLIENT_HOME = "/calibration-requests";

const rolesOf = (claims) => (claims?.roles && claims.roles.length ? claims.roles : claims?.role ? [claims.role] : []);
const isClientOnly = (claims) => {
  const r = rolesOf(claims);
  return r.length > 0 && r.every((x) => x === "CLIENT");
};

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifySession(token) : null;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isProtected && !claims) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // A client-only login is confined to its portal.
  if (claims && isClientOnly(claims)) {
    const hitsStaffArea = STAFF_ONLY.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (hitsStaffArea) {
      const url = req.nextUrl.clone();
      url.pathname = CLIENT_HOME;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if ((pathname === "/login" || pathname === "/") && claims) {
    const url = req.nextUrl.clone();
    // The dashboard (charts) is the landing page after sign-in, for staff and
    // clients alike (the dashboard scopes itself to the viewer's role).
    url.pathname = "/overview";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/overview/:path*",
    "/dashboard/:path*",
    "/reports/:path*",
    "/schedule/:path*",
    "/users/:path*",
    "/weighbridges/:path*",
    "/audit/:path*",
    "/account/:path*",
    "/quotations/:path*",
    "/calibration-requests/:path*",
    "/sites/:path*",
    "/feedback/:path*",
    "/projects/:path*",
    "/contracts/:path*",
    "/tasks/:path*",
    "/customer-feedback/:path*",
    "/training-feedback/:path*",
  ],
};
