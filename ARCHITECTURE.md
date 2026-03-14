# EduScore Lebanon – Architecture Overview

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (via Prisma ORM) |
| Auth | NextAuth.js v5 (Google OAuth + Magic Link) |
| Job Queue | BullMQ + Redis |
| Styling | Tailwind CSS |
| Hosting | Vercel (app) + Railway/Supabase (DB) |

## Project Structure

```
eduscore-lebanon/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (login)
│   ├── (main)/                   # Main site layout
│   │   ├── page.tsx              # Homepage
│   │   ├── universities/         # University browse pages
│   │   ├── professors/[slug]/    # SEO professor pages
│   │   ├── courses/[slug]/       # SEO course pages
│   │   ├── schedule-builder/     # Schedule planner
│   │   ├── search/               # Full-text search
│   │   ├── terms/                # Legal pages
│   │   ├── privacy/
│   │   └── guidelines/
│   ├── admin/                    # Admin dashboard (role-gated)
│   │   ├── page.tsx              # Dashboard with stats
│   │   ├── reviews/              # Moderation queue
│   │   ├── professors/           # Professor management
│   │   ├── sync/                 # Data sync monitoring
│   │   └── analytics/            # Usage analytics
│   ├── api/                      # REST API routes
│   │   ├── auth/                 # NextAuth handlers
│   │   ├── professors/           # CRUD + search
│   │   ├── courses/              # CRUD + search
│   │   ├── reviews/              # Submit, list, helpful, report
│   │   ├── schedule/             # Schedule generation
│   │   ├── search/               # Unified search
│   │   ├── watchlist/            # Watch/unwatch
│   │   ├── analytics/            # Event tracking
│   │   ├── universities/         # University list
│   │   ├── schedules/            # Saved schedules
│   │   └── admin/                # Admin-only endpoints
│   ├── sitemap.ts                # Dynamic XML sitemap
│   └── robots.ts                 # Robots.txt
│
├── components/
│   ├── layout/                   # Header, Footer, UniversityGrid
│   ├── professors/               # ProfessorCard, RatingBar, WatchButton
│   ├── courses/                  # CourseCard, ProfessorCompareCard
│   ├── reviews/                  # ReviewCard, ReviewForm
│   ├── schedule/                 # ScheduleBuilderClient, ScheduleCalendar
│   ├── search/                   # SearchBar (with autocomplete), SearchFilters
│   ├── ads/                      # AdBanner (AdSense wrapper)
│   └── auth/                     # LoginButtons
│
├── lib/
│   ├── db.ts                     # Prisma client singleton
│   ├── auth.ts                   # NextAuth config
│   ├── schedule-engine.ts        # Core schedule generation algorithm
│   ├── content-filter.ts         # Automated review moderation
│   ├── analytics.ts              # Event tracking + dashboard stats
│   ├── utils.ts                  # Shared utilities
│   └── sync/
│       └── index.ts              # Upsert helpers + stats recomputation
│
├── prisma/
│   ├── schema.prisma             # Complete database schema
│   └── seed.ts                   # Seed data (6+ universities, courses)
│
└── jobs/
    ├── worker.ts                 # BullMQ worker (sync, notifications, stats)
    └── scrapers/
        └── university-scraper.ts # Per-university data scrapers
```

## Key Systems

### Schedule Generation Engine (`lib/schedule-engine.ts`)
- Recursive backtracking algorithm
- O(sections^courses) with early pruning on conflicts
- Conflict detection: per-day, time-overlap check
- Scoring by 7 preferences (professors, workload, days, gaps, timing, balance)
- Returns top-N schedules sorted by score

### Content Moderation Pipeline (`lib/content-filter.ts`)
- Regex-based hard blocks: harassment, personal info, accusations, spam
- Soft flags: political, religious → enters human moderation queue
- Duplicate review detection via Jaccard similarity
- IP hashing for abuse detection
- Human moderation via admin dashboard

### Data Sync System (`jobs/`)
- BullMQ worker handles scheduled + manual sync jobs
- Scrapers per university (Banner SIS / custom portals)
- `upsertProfessor`, `upsertCourse`, `upsertSection` with full deduplication
- Exponential backoff retry (max 3 retries)
- Comprehensive sync logs stored in DB
- Stats recomputed after every approved review

### SEO Architecture
- Dynamic sitemap.ts covering all professor/course/university pages
- robots.ts excluding admin/API routes
- JSON-LD Schema.org markup on professor, course, university pages
- SEO-friendly slugged URLs: `/professors/hazem-hajj-aub`
- Open Graph meta tags on all pages

### Monetization
- AdBanner component wrapping Google AdSense `<ins>` tags
- Placements: homepage, professor page, course page, search, schedule builder
- Development mode shows placeholder boxes
- Revenue-ready: just set `NEXT_PUBLIC_ADSENSE_CLIENT_ID` in env

## Database Schema Highlights

- **13 main models** covering the full academic hierarchy
- University → Faculty → Department → Course → Section (per term)
- Professor ↔ Course (many-to-many via ProfessorCourse)
- Section ↔ Professor (per-section assignment via SectionProfessor)
- Review system: structured ratings (7 dimensions) + free text + moderation
- Watchlist + Notifications for engagement
- SavedSchedule for returning users
- SyncJob + SyncLog for operational monitoring
- AnalyticsEvent for usage tracking

## Deployment Checklist

1. Set all environment variables (see .env.example)
2. `npm run db:migrate` to apply schema
3. `npm run db:seed` to populate university data
4. `npm run build` + deploy to Vercel
5. Start Redis instance (Railway/Upstash)
6. `npm run jobs:start` on a background process (Railway worker)
7. Configure Google OAuth in Google Cloud Console
8. Submit sitemap to Google Search Console
9. Add AdSense client ID when approved
