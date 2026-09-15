# LilBean Fitness

A self-hosted, installable PWA that replaces Hevy (workouts/strength), MyFitnessPal
(nutrition/macros), and adds body-progress tracking and a manual RingConn/health-data
import — all backed by your own Postgres database on your NAS.

Two accounts, fully separate data, shared "today" dashboard concept per user.

## Stack

- **server/** — Node.js + Express + TypeScript API, Prisma ORM, PostgreSQL
- **web/** — React + Vite PWA (installable, offline-capable shell), Tailwind CSS
  (dark theme, pink accents), served by nginx and reverse-proxied to the API
- **backup/** — tiny cron container that nightly `pg_dump`s the database to `./backups`
- **docker-compose.yml** — wires it all together, same one-folder-per-service pattern
  as your other NAS containers

## Feature set

**Workouts**
- Exercise library (30 seeded exercises + your own custom ones)
- Routines/templates you build once and reuse, including superset grouping
  (mark two exercises as a superset in the routine editor or mid-workout)
- Live workout logging: weight/reps/RPE per set, warm-up flag, built-in rest timer
- Plate calculator next to the weight field (configurable bar weight)
- Progressive overload suggestions ("last time: 60kg×8 — try 62.5kg") shown when
  picking an exercise to log and on its detail page
- Per-exercise PR (heaviest set), estimated 1RM (Epley formula), volume-over-time chart
- **PR feed**: a chronological timeline of every weight and 1RM personal record
- **Weekly volume by muscle group** chart on the Lift tab
- Full workout history
- **Offline set logging**: if you lose signal mid-workout, sets you log for the
  exercise you're already on keep working — queued locally and synced automatically
  once you're back online (a "⏳ syncing" tag shows what's still pending). Starting
  a brand-new workout or switching to a different exercise still needs a live
  connection, since those need a fresh server round-trip.
- **Import your history from Hevy**: Settings → Import from Hevy, upload the CSV
  export from Hevy's own Settings → Export Data. Matches exercises to the existing
  library by name where possible (creating custom ones otherwise), skips
  cardio/duration-only sets (this app tracks strength sets as weight × reps), and
  is safe to re-run — already-imported workouts are detected and skipped.

**Nutrition**
- Food database seeded with common staples + barcode scanning via your phone camera
  (in-browser ZXing scanner) backed by the free OpenFoodFacts API
- Custom foods and recipes (built from foods, macros computed per serving)
- **Favorites and recently-logged foods** surfaced at the top of Add Food, so
  logging the same breakfast every day doesn't mean re-searching for it
- Daily diary by meal, daily macro targets with progress rings
- **Copy previous day's diary** — one tap to duplicate yesterday's entries
- **Water tracking** with a quick +250ml button
- **Training-day vs. rest-day macro targets** (optional) — set both in Settings
  and the app picks automatically based on whether you logged a workout that day
- 14-day calorie/macro trend charts

**Body & health**
- Weight / body-fat % / tape measurements, with a chart for weight and for each
  measurement you track (waist, chest, arms, ...)
- **Goal weight** with a projected date, based on your recent rate of change
- Progress photo gallery (uploaded straight from your phone camera), with a
  **before/after comparison view** once you have two or more photos
- Ring/sleep data: manual entry or bulk CSV/JSON import (see note below)

**Combined / household**
- "Today" dashboard: active workout, macro + water totals, workout + logging
  streaks, latest ring/body stats, one tap into any section
- **Household view** (Settings → Household): both accounts' streaks and today's
  status side by side — no diary contents or photos, just a shared status check
- **Data export**: Settings → Export my data, a full JSON dump of your own
  workouts, diary, body metrics, and more, independent of the server-side backups
- **Push notifications** (optional): a daily nudge if nothing's been logged yet.
  Needs a one-time VAPID key setup (see `.env.example`) and, importantly,
  **HTTPS** — see the note below.

### A note on RingConn

RingConn has no public developer API — your ring's data lives in the RingConn app,
with only occasional Apple Health / Google Fit export depending on your plan. There's
no button we can wire up for automatic live sync. What's built instead: a `/body/health`
screen where you can either type in a night's sleep/HR/HRV/steps by hand, or paste a
CSV/JSON export (from RingConn's export feature, or from Apple Health/Google Fit if you
route RingConn data there) for bulk import. If RingConn ships a public API in the future,
`server/src/routes/health.ts` is the only file that needs a real integration added.

### A note on push notifications

Browsers only allow a page to subscribe to push notifications over a secure context
— HTTPS, or `localhost`. Plain-HTTP access over your LAN IP or Tailscale IP (exactly
how this README has you accessing everything else) does **not** qualify, so "Enable
notifications" in Settings won't work until you put an HTTPS reverse proxy in front —
`tailscale serve` is the easiest option and doesn't need a real certificate or public
DNS. Everything else in the app works fine over plain HTTP either way; push is the one
feature that specifically needs it. Leave `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` blank
in `.env` to disable the feature entirely (Settings will just say it's not configured).

## Deploying to your NAS

This follows the same pattern as your other `/volume1/docker/<service>/` containers.

1. **Copy the project to your NAS**, e.g. `/volume1/docker/fitness-app/`.

2. **Create your `.env` file** from the template:
   ```sh
   cd /volume1/docker/fitness-app
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `POSTGRES_PASSWORD` / `JWT_SECRET` — long random strings
   - `DATABASE_URL` — update the password to match `POSTGRES_PASSWORD`
   - `USER1_EMAIL` / `USER1_PASSWORD` and `USER2_EMAIL` / `USER2_PASSWORD` — real
     logins for the two of you (accounts are created once, on first boot)
   - `CORS_ORIGINS` — already set to your LAN IP and Tailscale IP on port 8080;
     adjust if you use a different port or a domain name
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — optional, for push notifications.
     Generate a pair with `npx web-push generate-vapid-keys` (needs Node; run it
     anywhere, including your own laptop). Leave both blank to skip push entirely.

3. **Build and start:**
   ```sh
   docker compose up -d --build
   ```
   First boot: Postgres initializes, the server pushes the Prisma schema and seeds
   the exercise library, sample foods, and your two user accounts, then the web
   container serves the PWA on port 8080.

4. **Access it:**
   - At home: `http://192.168.50.77:8080`
   - Away from home (Tailscale, no port forwarding needed): `http://100.76.202.22:8080`
   - Same access pattern as Immich — just a different port.

5. **Install it on your phone:** open the URL in Safari/Chrome, then "Add to Home
   Screen" (iOS) or "Install app" (Android/Chrome). It behaves like a native app —
   own icon, own window, works offline for the app shell.

   Note: the shipped icon (`web/public/icons/icon-192.png` / `icon-512.png`) is a
   plain placeholder (black square, pink circle) — swap those two files for real
   artwork whenever you want, same filenames, no other changes needed.

### Backups

The `db-backup` container runs `pg_dump` nightly at 03:00 into `./backups/`
(gzip, 14-day retention by default via `BACKUP_RETENTION_DAYS`). Since that's a plain
folder under your project directory, it rides along with whatever you already use to
back up `/volume1/docker/` (Hyper Backup, rsync, etc.) — nothing extra to configure
there. Uploaded photos live in `./data/uploads` and the Postgres data files in
`./data/postgres`; back up (or at minimum snapshot) both the same way.

To restore a backup:
```sh
gunzip -c backups/lilbean-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U lilbean -d lilbean
```

### Updating

```sh
git pull
docker compose up -d --build
```
Prisma runs `db push` on server startup, so schema changes in `server/prisma/schema.prisma`
apply automatically — no manual migration step for this single-environment deployment.

## Local development

```sh
# Terminal 1: Postgres only
docker compose up db

# Terminal 2: API
cd server
cp .env.example .env   # point DATABASE_URL at localhost
npm install
npm run prisma:generate
npx prisma db push
npm run prisma:seed
npm run dev             # http://localhost:4000

# Terminal 3: web app
cd web
npm install
npm run dev              # http://localhost:5173, proxies /api to :4000
```

Barcode scanning and camera photo capture need HTTPS or `localhost` to access the
camera — `localhost:5173` works fine for local dev; on the NAS, LAN/Tailscale access
over plain HTTP is what Immich and friends already rely on, but if your browser
blocks camera access over HTTP on your Tailscale IP, put a reverse proxy with a
Tailscale HTTPS cert in front (`tailscale serve`) the same way you would for any
other camera-using self-hosted app.
