# Security overview

How the QSL Maintenance system (web + mobile) is protected against common
threats, and what to keep an eye on.

## Controls in place

**Transport & headers (web)** — every response carries a strict set of headers
(`next.config.mjs`):

- Content-Security-Policy (self-only scripts/styles/connect; `object-src 'none'`,
  `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`).
- HSTS (2 years, `includeSubDomains; preload`) + `upgrade-insecure-requests`.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` limiting camera/geolocation to self, disabling mic/USB/payment.
- `Cross-Origin-Opener-Policy` + `Cross-Origin-Resource-Policy: same-origin`,
  `X-Permitted-Cross-Domain-Policies: none`, `X-DNS-Prefetch-Control: off`.
- `X-Powered-By` disabled.

**Authentication & sessions**

- Passwords hashed with bcrypt (`src/lib/auth.js`); login returns a generic
  "wrong email or password" (no account enumeration).
- Sessions are signed JWTs (`jose`) with an enforced 32+ char `AUTH_SECRET` —
  the app refuses to mint tokens on a weak/missing secret (`src/lib/jwt.js`).
- Session cookie is `HttpOnly`, `Secure` (in production), `SameSite=Lax`, scoped
  to `/` — mitigates XSS token theft and cross-site request forgery.
- The mobile app authenticates with a bearer JWT and stores the token in the OS
  keychain/keystore via `flutter_secure_storage` (never plaintext prefs).

**Brute-force throttling** — both `/api/auth/login` and `/api/auth/mobile-login`
are rate-limited per IP (20 / 15 min) and per account (5 / 15 min), returning
`429` with `Retry-After` (`src/lib/rateLimit.js`).

**Authorization** — every API route independently calls `requireUser()` and
role/ownership checks (`src/lib/roles.js`, `src/lib/rbac.js`); middleware is only
a redirect convenience, not the security boundary, so a middleware bypass cannot
expose data. Reports/quotations are scoped to what the caller may see.

**Injection** — all DB access goes through Prisma (parameterised); the only raw
SQL is a `SELECT 1` health check. React escapes output by default; the single
`dangerouslySetInnerHTML` is app-controlled JSON-LD, not user input.

**Uploads** — report photos are capped at 8 per report and each must be a real
image ≤ 5 MB (`src/lib/upload.js`); LPO scans are validated as images ≤ 2 MB.
Server-side validation, so a direct API call cannot bloat storage.

**Mobile transport** — the server URL is HTTPS and baked in at build time; the
release build disables cleartext (HTTP) traffic (`build_apk.sh` sets
`android:usesCleartextTraffic="false"`).

## Operational must-dos

- Set a strong random **`AUTH_SECRET`** (32+ bytes) in the server environment.
  Rotating it signs everyone out (expected).
- Keep `COOKIE_SECURE` unset/`true` in production (only set `false` on a trusted
  TLS-less LAN).
- Terminate TLS at the proxy and keep the `X-Forwarded-For`/`X-Real-IP` headers
  intact so rate limiting sees real client IPs.
- If you scale beyond one app container, move the rate limiter to Redis (the
  in-memory limiter is per-process).

## Outstanding (require scheduled, breaking upgrades)

`npm audit` reports issues that only resolve with **major** version bumps — not
applied automatically to avoid breaking production. Plan and test these:

- **Next.js 14 → 15/16** — pick up the latest security patches. Test the app
  router, middleware and `@react-pdf` server usage after upgrading.
- **nodemailer** major — verify SMTP send still works.
- **exceljs / uuid** (moderate, transitive) — low real risk (uuids are generated
  internally, not from user input); clears when exceljs ships an updated uuid.

Run `npm audit` before each release and address anything **high/critical** with a
non-breaking fix promptly (`npm audit fix`).

## Reporting

Found a vulnerability? Email **info@qalibrated.co.ke** — please don't open a
public issue.
