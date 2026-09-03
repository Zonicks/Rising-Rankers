# Rising Rankers

Competitive Learning & Scholarship Platform.

## Apps

| Path | Stack | Port |
|------|--------|------|
| `apps/api` | Node.js + Fastify + Prisma | `4000` |
| `apps/web` | Next.js student portal | `3000` |
| `apps/admin` | Next.js admin CMS | `3001` |
| `apps/mobile` | Flutter | device / emulator |

Shared libraries live in `packages/shared-types` and `packages/shared-validation`.

## Local setup

Requires Node.js 20+ and [pnpm](https://pnpm.io/) 9.15.

```bash
pnpm install
pnpm --filter @learning/shared-types build
pnpm --filter @learning/shared-validation build
pnpm --filter @learning/api db:generate
pnpm --filter @learning/api db:push
pnpm --filter @learning/api db:seed
```

Copy each app's `.env.example` to `.env` / `.env.local` before running.

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:admin
```

```bash
cd apps/mobile
flutter run --dart-define=API_BASE_URL=http://localhost:4000
```

Seed admin (change this password before any real deploy):

```
admin@learning.local / Admin123!
```

| App | URL |
|-----|-----|
| API | http://localhost:4000 |
| Student web | http://localhost:3000/auth |
| Admin CMS | http://localhost:3001/signin |

## Deploy

### API + Postgres (EC2)

1. Launch Ubuntu 22.04+ with Docker Compose. Open **443** (and 22 for SSH).
2. Clone this repo on the server.
3. Create `/etc/learning.env`:

```bash
POSTGRES_PASSWORD=<strong>
JWT_SECRET=<32+ chars>
CORS_ORIGINS=https://web.yourdomain.com,https://admin.yourdomain.com
```

4. From the repo root:

```bash
docker compose --env-file /etc/learning.env up -d --build
docker compose exec api pnpm db:push
docker compose exec api pnpm db:seed
```

5. Confirm `curl http://127.0.0.1:4000/health`, then put Nginx + TLS in front of port `4000`. Keep Postgres bound to localhost.

### Student web + Admin (Vercel)

Create two Vercel projects from this repo:

| Project | Root directory | Env |
|---------|----------------|-----|
| Student web | `apps/web` | `NEXT_PUBLIC_API_URL=https://api.yourdomain.com` |
| Admin CMS | `apps/admin` | `NEXT_PUBLIC_API_URL=https://api.yourdomain.com` |

Use pnpm. Update `CORS_ORIGINS` on the API and restart it.

### Flutter

```bash
cd apps/mobile
flutter build apk --dart-define=API_BASE_URL=https://api.yourdomain.com
```

## Refresh this folder

This tree is a clean snapshot of `Project/`. From the workspace:

```powershell
.\Delivery\sync-rising-rankers.ps1
```
