import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";

// Protect the authenticated app area and redirect signed-in users away from login.
const PROTECTED = ["/dashboard", "/reports", "/schedule"];

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

  if ((pathname === "/login" || pathname === "/") && claims) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/reports/:path*", "/schedule/:path*"],
};
