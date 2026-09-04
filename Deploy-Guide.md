# Rising Rankers — manual deploy guide

This is the runbook for the **current staging setup**. Use it to ship a new GitHub commit (for example `v1`) by hand.

Repo: [https://github.com/Zonicks/Rising-Rankers](https://github.com/Zonicks/Rising-Rankers)

| Piece | Where it runs |
|-------|----------------|
| API + Postgres | AWS EC2 `rising-rankers-api-staging` |
| Student web | Vercel, root directory `apps/web` |
| Admin CMS | Vercel, root directory `apps/admin` |
| Mobile | Flutter APK / IPA built on your machine |

EC2 only serves the API. Web and admin do **not** update when you rebuild Docker.

---

## Current staging (as of 4 Sep 2026)

| Item | Value |
|------|--------|
| AWS profile | `rising-rankers` |
| Region | `ap-south-1` |
| Instance name | `rising-rankers-api-staging` |
| Instance ID | `i-09c0744c37d6a8a93` |
| Public IP | `15.252.43.40` |
| Login | AWS SSM (no SSH key on this instance) |
| Code on the box | `/opt/Rising-Rankers` |
| Secrets file | `/etc/learning.env` |
| Health (direct) | http://15.252.43.40:4000/health |
| Health (nginx) | http://15.252.43.40/health |

`/etc/learning.env` keys (values stay on the server, never commit them):

```bash
POSTGRES_PASSWORD
JWT_SECRET
CORS_ORIGINS
```

---

## 0. Push code to GitHub first

EC2 and Vercel pull from GitHub, not from `Project/` on this PC.

From the workspace:

```powershell
cd "d:\Projects\Learning App"
.\Delivery\sync-rising-rankers.ps1
cd "d:\Projects\Learning App\Delivery\Rising-Rankers"
git add -A
git status
git commit -m "v2"
git push origin main
```

Confirm the commit is on `main`: [https://github.com/Zonicks/Rising-Rankers/commits/main](https://github.com/Zonicks/Rising-Rankers/commits/main)

---

## 1. AWS login (your PC)

The `rising-rankers` profile uses `aws login` and **expires**. If a command says the session expired:

```powershell
aws login --profile rising-rankers
aws --profile rising-rankers sts get-caller-identity
```

Expected account: `946656175153`.

Install the [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) if `start-session` is missing.

---

## 2. Open a shell on EC2

```powershell
aws ssm start-session --target i-09c0744c37d6a8a93 --profile rising-rankers --region ap-south-1
```

You land as **root**. Every command below is run **on the instance**.

If SSM is unavailable and you later add an SSH key + port 22:

```powershell
ssh -i "$env:USERPROFILE\.ssh\<your-key>.pem" ubuntu@15.252.43.40
```

---

## 3. Update the API (everyday deploy)

This is the path used to ship **v1**.

```bash
cd /opt/Rising-Rankers

# see what is live now
git log -1 --oneline

# pull the commit you just pushed
git fetch origin
git pull --ff-only origin main
git log -1 --oneline

# rebuild API image and recreate the api container
# always pass --env-file: compose requires JWT_SECRET
docker compose --env-file /etc/learning.env up -d --build

# apply Prisma schema changes (does not wipe data)
docker compose --env-file /etc/learning.env exec -T api pnpm exec prisma db push

# confirm
curl -fsS http://127.0.0.1:4000/health
docker compose --env-file /etc/learning.env ps
```

Healthy response:

```json
{"status":"ok","service":"learning-api"}
```

**Do not** run `db:seed` on an instance that already has users. Seed is first boot only.

From your PC you can also check:

```powershell
curl.exe http://15.252.43.40:4000/health
curl.exe http://15.252.43.40/health
```

### If `git pull` refuses (local edits on the server)

```bash
cd /opt/Rising-Rankers
git status
git stash --include-untracked
git pull --ff-only origin main
```

---

## 4. First-time EC2 (only if you rebuild the box)

Skip this section when the staging instance already exists.

### 4.1 Launch

- Ubuntu 22.04, `t3.micro` or larger (`t3.small` is more comfortable for Docker builds).
- Security group:
  - **80** from `0.0.0.0/0` (nginx)
  - **443** from `0.0.0.0/0` once TLS is on
  - **4000** from `0.0.0.0/0` only if you still want the API on that port
  - **22** only from your IP if you use SSH
- Attach instance profile `rising-rankers-api-staging-role` so SSM works.

### 4.2 Docker + git + nginx

```bash
apt-get update
apt-get install -y git nginx docker.io docker-compose-v2
systemctl enable --now docker nginx
```

### 4.3 Clone and secrets

```bash
git clone https://github.com/Zonicks/Rising-Rankers.git /opt/Rising-Rankers
install -d -m 700 /opt/Rising-Rankers

cat >/etc/learning.env <<'EOF'
POSTGRES_PASSWORD=<strong-password>
JWT_SECRET=<at-least-32-random-chars>
CORS_ORIGINS=https://<student-vercel>.vercel.app,https://<admin-vercel>.vercel.app
EOF
chmod 600 /etc/learning.env
```

Replace the placeholders. After Vercel URLs exist, put the real origins in `CORS_ORIGINS`.

### 4.4 First boot

```bash
cd /opt/Rising-Rankers
docker compose --env-file /etc/learning.env up -d --build
docker compose --env-file /etc/learning.env exec -T api pnpm exec prisma db push
docker compose --env-file /etc/learning.env exec -T api pnpm db:seed
curl -fsS http://127.0.0.1:4000/health
```

Change the seed admin password before anyone else uses the box.

### 4.5 Nginx (matches staging today)

```bash
cat >/etc/nginx/sites-available/rising-rankers <<'EOF'
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  client_max_body_size 20m;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF

ln -sfn /etc/nginx/sites-available/rising-rankers /etc/nginx/sites-enabled/rising-rankers
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

TLS later: point a DNS A record at `15.252.43.40` (or the new Elastic IP), then Certbot on port 443.

Keep Postgres on `127.0.0.1:5432` only. Compose already does that.

---

## 5. Student web + Admin (Vercel)

Create **two** Vercel projects from the same GitHub repo `Zonicks/Rising-Rankers`.

| Vercel project | Root directory | Environment variable |
|----------------|----------------|----------------------|
| Student web | `apps/web` | `NEXT_PUBLIC_API_URL=http://15.252.43.40:4000` |
| Admin CMS | `apps/admin` | `NEXT_PUBLIC_API_URL=http://15.252.43.40:4000` |

When you have HTTPS on the API, switch both to `https://api.yourdomain.com` (no trailing slash).

Settings that matter for this pnpm monorepo:

1. Framework: Next.js
2. Root Directory: `apps/web` or `apps/admin`
3. Enable **Include source files outside of the Root Directory in the Build Step**
4. Install command if Vercel cannot see the workspace:

```bash
cd ../.. && corepack enable && pnpm install --frozen-lockfile
```

5. Redeploy after each GitHub push (or leave Production auto-deploy on `main`).

Then put the Vercel origins into `/etc/learning.env` as `CORS_ORIGINS` (comma-separated, including preview URLs if you use them) and restart the API:

```bash
cd /opt/Rising-Rankers
nano /etc/learning.env
docker compose --env-file /etc/learning.env up -d
```

---

## 6. Flutter release

API URL must match the live API (no trailing slash).

```powershell
$env:Path = "C:\Users\Celestial\Documents\Flutter SDK\flutter\bin;" + $env:Path
cd "d:\Projects\Learning App\Project\apps\mobile"
flutter build apk --dart-define=API_BASE_URL=http://15.252.43.40:4000
```

APK output:

```text
apps\mobile\build\app\outputs\flutter-apk\app-release.apk
```

iOS (when certificates exist):

```powershell
flutter build ipa --dart-define=API_BASE_URL=http://15.252.43.40:4000
```

Local device against this PC instead of EC2:

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.1.3:4000
```

---

## 7. Rollback the API

On the instance, go back one commit (or any known SHA) and rebuild:

```bash
cd /opt/Rising-Rankers
git log --oneline -10
git checkout 73a3903
docker compose --env-file /etc/learning.env up -d --build
curl -fsS http://127.0.0.1:4000/health
```

Return to latest `main`:

```bash
git checkout main
git pull --ff-only origin main
docker compose --env-file /etc/learning.env up -d --build
```

If a schema change already ran (`prisma db push`), rolling back code may not undo database columns. Restore a `pg_dump` if you need the old schema.

Nightly dump example:

```bash
docker compose --env-file /etc/learning.env exec -T db pg_dump -U postgres learning_platform > /root/learning_platform-$(date +%F).sql
```

---

## 8. Useful checks

```bash
# git
cd /opt/Rising-Rankers && git log -1 --oneline && git status -sb

# containers
docker compose --env-file /etc/learning.env ps
docker compose --env-file /etc/learning.env logs -n 80 api

# health
curl -fsS http://127.0.0.1:4000/health
curl -fsS http://127.0.0.1/health
```

---

## 9. Go-live checklist

- [ ] Seed admin password changed
- [ ] `JWT_SECRET` is not the local dev value
- [ ] `CORS_ORIGINS` matches real Vercel URLs
- [ ] TLS on the API (stop exposing port 4000 once nginx+443 works)
- [ ] Web and admin `NEXT_PUBLIC_API_URL` use that HTTPS URL
- [ ] Flutter `--dart-define=API_BASE_URL` matches
- [ ] Postgres backups exist
