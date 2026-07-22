# Deploying on a headless server (SSH-only, no desktop/VNC)

This is the full path to run the QSL Maintenance System on a plain Linux VPS you
reach only over SSH — no graphical desktop needed. Everything is done in the
terminal with Docker. At the end the app is live over HTTPS, installable as a
mobile app, with a real PostgreSQL database.

## 0. What you need
- A Linux server (Ubuntu 22.04+ / Debian 12 recommended), 1 vCPU / 1 GB RAM is enough to start.
- SSH access: `ssh user@YOUR_SERVER_IP`
- A domain name (e.g. `qsl.example.com`) with a **DNS A record pointing at the server's IP**
  (required for HTTPS, and HTTPS is required to install the app on phones).
- Ports **80** and **443** open in the firewall / cloud security group.

## 1. Install Docker (once)
```bash
ssh user@YOUR_SERVER_IP
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER    # run docker without sudo
newgrp docker                    # apply the group now (or log out/in)
docker --version                 # confirm
```

## 2. Get the code
```bash
git clone https://github.com/FaithZawadi/workflow-reports-app.git qsl
cd qsl
git checkout main                # or the branch you deploy
```

## 3. Configure the environment
```bash
cp .env.example .env
nano .env        # (nano is a terminal editor: edit, Ctrl-O to save, Ctrl-X to exit)
```
Set at least:
```ini
AUTH_SECRET="<paste: openssl rand -base64 48>"
CRON_SECRET="<paste: openssl rand -hex 24>"
SEED_ADMIN_EMAIL="you@yourdomain"
SEED_ADMIN_PASSWORD="<a strong password>"
PROJECT_MANAGER_CODE="..."     ;  TECHNICAL_MANAGER_CODE="..."
DOMAIN="qsl.example.com"        # your real domain
APP_URL="https://qsl.example.com"
# EMAIL_ENABLED / SMTP_* — fill in if you want email notifications
```
Leave `COOKIE_SECURE` unset — HTTPS is on, so keep the secure default.
(Run `openssl rand ...` on the server to generate the secrets.)

## 4. Launch with HTTPS
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
This starts three containers: **Postgres**, the **app** (runs the DB migration +
seed automatically on first boot), and **Caddy**, which fetches a Let's Encrypt
TLS certificate for `DOMAIN` on first request. Give it ~30 seconds.

Check it:
```bash
docker compose ps                       # all should be "running"/"healthy"
docker compose logs -f app              # watch startup (Ctrl-C to stop watching)
curl -fsS https://qsl.example.com/api/health   # -> {"ok":true,"db":true,...}
```

## 5. First login & lock down
- Open `https://qsl.example.com/login`, sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
- Change the admin password, onboard real staff.
- Demo/sample data is **off by default** — the seed only ensures the admin
  account, so re-deploys never re-create records you've deleted. If you want the
  sample client/staff/schedules on a fresh install to try things out, set
  `SEED_DEMO_ACCOUNTS="true"` in `.env` before the first `up`. Leave it unset
  (or `false`) for a clean production database.

## 6. Install as a mobile app
On the phone browser, open `https://qsl.example.com`:
- **Android / Chrome:** menu → *Install app* / *Add to Home screen*.
- **iOS / Safari:** Share → *Add to Home Screen*.
It then launches full-screen with the QSL icon. (Install only appears over HTTPS —
that's why step 4 matters.)

## 7. Daily maintenance reminders (optional)
Add a host cron so overdue/due-soon emails go out once a day:
```bash
crontab -e
# add (uses the CRON_SECRET from your .env):
0 6 * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://qsl.example.com/api/schedule/reminders
```

## Operating it
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build   # deploy / update
docker compose logs -f app         # app logs
docker compose ps                  # status
docker compose down                # stop (data kept in the qsl_db + caddy volumes)
```

### Database
PostgreSQL runs in the `db` container; its data persists in the named Docker
volume **`qsl_db`** (survives restarts and redeploys). Back it up regularly:
```bash
docker compose exec db pg_dump -U qsl qsl > qsl-backup-$(date +%F).sql
```
Restore into a fresh DB:
```bash
cat qsl-backup-YYYY-MM-DD.sql | docker compose exec -T db psql -U qsl -d qsl
```
For a shared/production server, change the demo Postgres password in
`docker-compose.yml` (`POSTGRES_PASSWORD`) and the matching `DATABASE_URL`.

## Updating to a new version
```bash
cd qsl
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
Migrations run automatically on boot; the database volume is preserved.
