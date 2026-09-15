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
- Routines/templates you build once and reuse
- Live workout logging: weight/reps/RPE per set, warm-up flag, built-in rest timer
- Per-exercise PR (heaviest set), estimated 1RM (Epley formula), volume-over-time chart
- Full workout history

**Nutrition**
- Food database seeded with common staples + barcode scanning via your phone camera
  (in-browser ZXing scanner) backed by the free OpenFoodFacts API
- Custom foods and recipes (built from foods, macros computed per serving)
- Daily diary by meal, daily macro targets with progress rings
- 14-day calorie/macro trend charts

**Body & health**
- Weight / body-fat % / tape measurements with a weight-over-time chart
- Progress photo gallery (uploaded straight from your phone camera)
- Ring/sleep data: manual entry or bulk CSV/JSON import (see note below)

**Combined**
- "Today" dashboard: active workout, macro rings, workout + logging streaks,
  latest ring/body stats, one tap into any section

### A note on RingConn

RingConn has no public developer API — your ring's data lives in the RingConn app,
with only occasional Apple Health / Google Fit export depending on your plan. There's
no button we can wire up for automatic live sync. What's built instead: a `/body/health`
screen where you can either type in a night's sleep/HR/HRV/steps by hand, or paste a
CSV/JSON export (from RingConn's export feature, or from Apple Health/Google Fit if you
route RingConn data there) for bulk import. If RingConn ships a public API in the future,
`server/src/routes/health.ts` is the only file that needs a real integration added.

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
