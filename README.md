# QSL Maintenance Management System

A production full-stack application for **Qalibrated Systems Ltd** that turns the printed
QSL/F/WB-01…06 weighbridge maintenance sheets into a real system with a database, secure
logins, an approval workflow, and server-generated PDF reports.

It runs as a **web app and an installable mobile app** from a single codebase (a Progressive
Web App — technicians install it to their phone home screen; it works on Android and iOS with
no app-store step).

---

## What's in the box

| Capability | How it's implemented |
|---|---|
| Real database | PostgreSQL via Prisma ORM (schema + migration included) |
| Secure login | Email + password, bcrypt-hashed, signed httpOnly session cookies (JWT) |
| Roles & access | Technician, Engineer, Supervisor, Manager, Project Manager, Technical Manager, Admin |
| Approval workflow | Submit → Supervisor review → Manager approval, with full audit trail |
| All 7 forms | WB-01 Daily, WB-02 Weekly Accuracy, WB-03 Monthly, WB-04 Engineer Service, WB-05 Breakdown, WB-06 Calibration |
| PDF reports | True PDF files generated on the server (`@react-pdf/renderer`) — download from any report |
| Photo evidence | Camera capture with GPS + timestamp burned into the image |
| Auto serials | Atomic per-year-per-form numbering (e.g. `QSL-WB01-2026-00001`) |
| Email alerts | SMTP notifications on submit/approve/reject (optional; workflow still logs if off) |
| Mobile | Installable PWA (offline shell, home-screen icon, standalone display) |
| One-command deploy | `docker compose up` (app + Postgres) |

---

## Quick start (Docker — recommended)

Requires Docker and Docker Compose.

```bash
cp .env.example .env
# edit .env: set a strong AUTH_SECRET (openssl rand -base64 48) and the manager codes
docker compose up --build
```

Open **http://localhost:3000**. On first boot the container applies the database
migration and seeds an admin plus demo accounts.

**Seeded logins** (change these immediately in production):

| Role | Email | Password | Extra |
|---|---|---|---|
| Admin | `admin@qalibrated.co.ke` | from `SEED_ADMIN_PASSWORD` | — |
| Technician | `tech@demo.qsl` | `demo1234` | — |
| Engineer | `engineer@demo.qsl` | `demo1234` | — |
| Supervisor | `supervisor@demo.qsl` | `demo1234` | — |
| Manager | `manager@demo.qsl` | `demo1234` | — |
| Project Manager | `pm@demo.qsl` | `demo1234` | + code `MAGADI2026` |
| Technical Manager | `tm@demo.qsl` | `demo1234` | + code `TECH2026` |

Delete the demo accounts once your real staff are onboarded.

---

## Local development (without Docker)

Requires Node.js 18.18+ and a PostgreSQL you can reach.

```bash
npm install
cp .env.example .env          # point DATABASE_URL at your Postgres
npx prisma migrate deploy     # or: npx prisma migrate dev
npm run db:seed
npm run dev
```

App runs on http://localhost:3000.

---

## Configuration (`.env`)

| Key | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Signs session tokens — **must** be long and random in production |
| `SESSION_TTL_HOURS` | Session lifetime (default 12) |
| `APP_URL` | Public URL, used inside notification emails |
| `PROJECT_MANAGER_CODE` / `TECHNICAL_MANAGER_CODE` | Second factor for oversight roles |
| `EMAIL_ENABLED` + `SMTP_*` | Turn on SMTP email notifications |
| `SEED_ADMIN_*` | First admin created by the seed |

---

## How the app works

**Technicians and engineers** file reports. A technician is tied to one client (plant) and
site; engineers pick the client per job. They choose a form, fill it in, add GPS-stamped
photos, name the supervisor and manager emails, and submit. A serial number is assigned
atomically on submit.

**Supervisors** see reports routed to their email address and approve or reject them.
Approval moves the report to the named **manager**, who gives final sign-off. Rejections
require a comment. Every action is written to an immutable audit trail.

**Project Manager** sees every site-technician report (WB-01/02/03) across all plants;
**Technical Manager** sees every engineer report (WB-04/05/06). Both can act as an
overseeing approver. **Admin** sees everything and onboards users (`/api/users`).

Any viewer of a report can **Download PDF** — a branded A4 PDF generated on the server.

---

## Installing on a phone (the "mobile app")

This is a PWA, so there's no store submission:

- **Android / Chrome:** open the site → menu → *Install app* / *Add to Home screen*.
- **iOS / Safari:** open the site → Share → *Add to Home Screen*.

It then launches full-screen with its own icon and a cached shell for fast start-up.
If you later need a store-listed native wrapper, the same codebase can be packaged with
[Capacitor](https://capacitorjs.com/) pointing at your deployed URL — no rewrite required.

---

## Deploying to production

**Any VPS / server with Docker:** copy the repo, set a real `.env` (strong `AUTH_SECRET`,
production `APP_URL`, SMTP), run `docker compose up -d --build`, and put it behind a
reverse proxy (Caddy/Nginx) with HTTPS. Cookies are marked `secure` automatically in
production, so TLS is required for login to work.

**Managed hosting (e.g. Vercel + a managed Postgres like Neon/Supabase/RDS):**
set `DATABASE_URL` and the other env vars in the host's dashboard, run
`prisma migrate deploy` and the seed once against the database, and deploy. The PDF and
email code is pinned to the Node.js runtime and works on standard Node serverless.

**Backups:** the database is the single source of truth. Back up Postgres regularly
(`pg_dump`). The Docker volume is named `qsl_db`.

---

## Security notes

- Passwords are hashed with bcrypt; only the hash is stored.
- Sessions are signed JWTs in httpOnly, SameSite=Lax cookies; middleware guards every
  `/dashboard` and `/reports` route, and every API route re-checks the session and role.
- Report visibility and approval rights are enforced server-side in `src/lib/rbac.js` —
  the client cannot see or act on records outside its scope.
- Change `AUTH_SECRET`, the seeded admin password, and the manager access codes before
  going live, and remove the demo accounts.

---

## Project layout

```
src/
  app/
    login/                 sign-in
    (app)/                 authenticated area (guarded by layout)
      dashboard/           report registry
      reports/new/         create a report
      reports/[serial]/    view / approve / reject / download PDF
    api/                   REST endpoints (auth, reports, clients, users, pdf)
  components/              React UI (form, registry, detail, photos, checklist)
  lib/                     db, auth, jwt, rbac, templates, serial, email, theme
  pdf/ReportDocument.jsx   server-side PDF layout
prisma/                    schema, SQL migration, seed
public/                    PWA manifest, service worker, icons
```

---

## Extending it

The original prototype had a few extras you may want to fold in next: per-site memory of
the usual supervisor/manager emails, CSV of the full register (a per-report CSV export
already ships in the registry), and email reminders for stalled approvals. The data model
and API already support all of these — they're UI additions on top of the same endpoints.

For larger photo volumes, switch `Photo.dataUrl` to object storage (S3/GCS) and store a URL
instead of the base64 string; the PDF and detail views already accept a plain image URL.

---

*Qalibrated Systems Ltd · KENAS ISO/IEC 17025 + ISO/IEC 17020 · ILAC-MRA · +254 714 999 996*
