# EduScore Lebanon — Deployment Guide

Every push to `main` automatically builds and deploys to Vercel via GitHub Actions.
This guide covers the one-time setup required to make that pipeline work.

**Free-tier services used**
| Service | Free tier |
|---|---|
| GitHub Actions | 2 000 min/month (private repo) · unlimited (public repo) |
| Vercel | Hobby plan — unlimited personal deployments |
| Neon PostgreSQL | 512 MB storage, 1 database, 10 branches |

---

## Prerequisites

- GitHub account with the repo pushed (public or private)
- Vercel account — [vercel.com](https://vercel.com) (sign up free)
- Neon account — [neon.tech](https://neon.tech) (sign up free)

---

## Step 1 — Neon PostgreSQL

1. Go to [console.neon.tech](https://console.neon.tech) → **New project**
2. Name it `eduscore-lebanon`, region closest to your users (e.g. `eu-central-1`)
3. After creation, go to **Connection details**
4. Copy two connection strings:

   | Variable | Which string |
   |---|---|
   | `DATABASE_URL` | **Pooled** connection string (Pgbouncer) |
   | `DIRECT_URL` | **Direct** connection string (non-pooled) |

   Both look like: `postgresql://user:password@ep-xxx.neon.tech/eduscore?sslmode=require`
   The pooled one has `?pgbouncer=true` at the end.

5. Run the initial schema push **once** from your local machine:

   ```bash
   # Switch to production schema
   cp prisma/schema.production.prisma prisma/schema.prisma

   # Set your env vars temporarily
   export DATABASE_URL="postgresql://..."
   export DIRECT_URL="postgresql://..."

   # Push schema + optional seed
   npx prisma db push
   npm run db:seed   # optional — seeds demo universities/professors
   ```

---

## Step 2 — Vercel project setup

1. Go to [vercel.com/new](https://vercel.com/new) → import your GitHub repo
2. Framework preset will auto-detect as **Next.js** — leave defaults
3. **Do not deploy yet** — set env vars first (below)

### Required environment variables

Set all of these under **Settings → Environment Variables** in the Vercel dashboard.
Apply each to the **Production** environment (and Preview if you want preview deploys to work).

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled URL | From Step 1 |
| `DIRECT_URL` | Neon direct URL | From Step 1 |
| `AUTH_SECRET` | Random 32-byte string | Run: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` | Your Vercel URL (no trailing slash) |
| `CRON_SECRET` | Random 32-byte string | Run: `openssl rand -base64 32` |
| `BETA_NO_INDEX` | `true` | Blocks all crawlers during beta |
| `NODE_ENV` | `production` | Required for HSTS + prod behaviours |

Optional (add later):

| Variable | Value |
|---|---|
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics `G-XXXXXXXXXX` |

---

## Step 3 — Vercel token + project IDs

The GitHub Actions workflow needs three Vercel-specific secrets.

### Get your Vercel token

1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Click **Create** → name it `github-actions-eduscore`
3. Set expiry to **No expiration** (or 1 year)
4. Copy the token — you will only see it once

### Get your Org ID and Project ID

Run this once from your local machine inside the project directory:

```bash
npx vercel link
```

- Select your Vercel account / team
- Select (or create) the `eduscore-lebanon` project

This creates `.vercel/project.json`:

```json
{
  "orgId": "team_xxxxxxxxxxxx",
  "projectId": "prj_xxxxxxxxxxxx"
}
```

`orgId` → `VERCEL_ORG_ID`
`projectId` → `VERCEL_PROJECT_ID`

> Note: `.vercel/` is git-ignored by default. You only need to run `vercel link`
> locally to read these values — you do not commit the file.

---

## Step 4 — Add GitHub Actions secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.

Add all seven secrets:

| Secret name | Where to get it |
|---|---|
| `VERCEL_TOKEN` | Step 3 above |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` |
| `DATABASE_URL` | Neon pooled connection string (Step 1) |
| `DIRECT_URL` | Neon direct connection string (Step 1) |
| `AUTH_SECRET` | Same value you set in Vercel dashboard |
| `NEXT_PUBLIC_APP_URL` | Same value you set in Vercel dashboard |

> `CRON_SECRET` and `NODE_ENV` are only used by Vercel at runtime — they don't
> need to be GitHub secrets because they're not needed during the CI build step.

---

## Step 5 — First deployment

Push any commit to `main`:

```bash
git add -A
git commit -m "chore: trigger first CI/CD deployment"
git push origin main
```

Watch the pipeline at **GitHub → Actions → Deploy to Vercel**.

Expected run time: ~4–6 minutes (install → generate → pull → build → deploy).

---

## Step 6 — Verify

After the workflow turns green:

| Check | Expected |
|---|---|
| `https://your-project.vercel.app` | Homepage loads |
| `https://your-project.vercel.app/health` | `{"ok":true,"timestamp":"..."}` |
| `https://your-project.vercel.app/robots.txt` | `Disallow: /` (beta mode) |
| `https://your-project.vercel.app/api/health` | Same 200 response |
| Vercel dashboard → Cron Jobs | Two jobs listed (health-check, seat-alerts) |

---

## Going live (removing beta block)

When you are ready for public launch:

1. In Vercel dashboard → **Settings → Environment Variables**
   Change `BETA_NO_INDEX` from `true` to `false`
2. Remove or comment out the **"Enforce beta indexing block"** step in
   `.github/workflows/deploy.yml` (or leave it — the dashboard value wins
   once that step is removed)
3. Push any commit to `main` to trigger a redeploy
4. Submit `https://your-domain.com/sitemap.xml` to Google Search Console

---

## Cron job security

Both cron endpoints (`/api/cron/health-check` and `/api/seat-alerts/check`)
are secured with `CRON_SECRET`. Vercel automatically sends:

```
Authorization: Bearer <CRON_SECRET>
```

Make sure `CRON_SECRET` is set identically in:
- Vercel dashboard env vars (runtime use)
- Your local `.env` (for manual testing via curl)

Test manually:
```bash
curl -X POST https://your-project.vercel.app/api/seat-alerts/check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
# → {"ok":true,"checked":...,"notified":...}
```

---

## Free-tier limits reference

| Limit | GitHub Actions (private) | Vercel Hobby | Neon Free |
|---|---|---|---|
| Build minutes | 2 000/month | Unlimited | — |
| Deployments | Unlimited | 100/day | — |
| Bandwidth | — | 100 GB/month | — |
| DB storage | — | — | 512 MB |
| DB compute | — | — | 191.9 hrs/month |

A typical push takes ~5 min CI time. At 2 000 free minutes you can deploy
~400 times per month before hitting limits on a private repo. Public repos
have unlimited GitHub Actions minutes.
