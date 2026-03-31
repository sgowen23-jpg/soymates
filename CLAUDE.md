# Soymates — Claude Code Context

## What is this?
Soymates is an internal sales team web app for Vitasoy field reps in SA and VIC. It replaces Excel and Teams workflows for a 6-person team. It is NOT a public-facing product.

## Team
- **Sam Gowen** — field sales rep, app creator, admin
- **Reps:** Ashleigh Tasdarian, Shane Vandewardt, David Kerr, Dipen Surani, Azra Horell
- Sam's boss also has visibility but is not a daily user

## Tech Stack
- **Frontend:** React 19 + Vite 8
- **Backend/DB:** Supabase (PostgreSQL, Auth, RLS)
- **Hosting:** Vercel (auto-deploys from `main` branch)
- **Repo:** https://github.com/sgowen23-jpg/soymates
- **Local path:** `C:/Users/sgowe/soymates/`

All tiers are free (Supabase, Vercel, GitHub). Storage and usage limits are active constraints — avoid features that consume significant storage (e.g. image uploads).

## Folder Structure
```
src/
├── lib/supabase.js          ← Supabase client (env vars, correct)
├── context/AuthContext.jsx   ← Auth state provider
├── components/               ← Shared UI (Sidebar, StoreSearchInput)
├── constants.js              ← [TO CREATE] Shared REPS, STATES, REP_COLORS
├── utils/                    ← [TO CREATE] Shared getSegment, cleanName, toDateStr
├── data/                     ← Static data files (some stale — see Known Issues)
└── pages/
    ├── Home.jsx              ← Dashboard home
    ├── Login.jsx             ← Auth login
    ├── Dashboard.jsx         ← Main layout + lazy-loaded routing
    ├── Distribution.jsx      ← Distribution data (delegates to ListView/ByProductView)
    ├── ByProductView.jsx     ← Distribution by product
    ├── Targets.jsx           ← Targets tracker [HARDCODED — needs Supabase]
    ├── Promotions.jsx        ← Promo calendar
    ├── PerfectStore.jsx      ← Perfect store scoring
    ├── CyclePlanner.jsx      ← Cycle planner
    ├── MSOPipeline.jsx       ← MSO pipeline [HARDCODED — needs Supabase]
    ├── Tools.jsx             ← Tools page
    ├── Admin.jsx             ← Admin panel (no access control yet)
    ├── DataUpload/           ← Excel upload to Supabase
    ├── LeaveCalendar/        ← Leave/availability calendar
    └── StoreMap/             ← Store map (MapView, ListView, StoreProfile)
scripts/                      ← Python data import scripts (run manually)
```

## Database (Supabase)
Tables currently in use:
- `store_distribution` — product distribution by store
- `bnb_13wk` / `bnb_26wk` — buy/not-buy scan data
- `promo_calendar` — promotion schedule
- `perfect_store` — perfect store scoring
- `leave_entries` — team leave/availability
- `birthdays` — team birthdays
- `stores` — store master list (upserted via DataUpload)

## Known Issues (from audit 2026-03-31)

### Critical — hardcoded pages
- `Targets.jsx` — 100% hardcoded from `src/data/targets.js`. Needs a Supabase table.
- `MSOPipeline.jsx` — 100% hardcoded. All 10 deals are compile-time constants.
- `Home.jsx` — Pie chart percentages (`PIE_DATA`) are hardcoded, not from Supabase.

### High — performance
- `src/data/bnbData.js` is 947 KB of static data baked into the bundle. Only used by MapView. ListView fetches the same data live from Supabase. MapView should do the same.
- `src/data/stores.js` is 78 KB, used by 3 components that should query Supabase instead.

### Medium — duplication
- `REPS` is defined 6+ times across the codebase. Needs a shared constants file.
- `STATES` is duplicated in StoreMap and Distribution.
- `getSegment()` is implemented twice (ByProductView + Promotions) with slightly different logic.
- `cleanName()` / `clean()` are the same function with different names in two files.
- `REP_COLORS` is defined twice with a colour discrepancy for Shane.

### Medium — auth gaps
- No role-based access. Any authenticated user can access Admin.
- No "delete own only" constraint on leave_entries or birthdays.

## Conventions
- Pages are in `src/pages/`, one file per page or a subfolder with `index.jsx` for multi-file pages
- Supabase client is imported from `src/lib/supabase.js`
- Auth context wraps the app via `AuthContext.jsx`
- Lazy loading via `React.lazy` + `Suspense` in `Dashboard.jsx`
- CSS is co-located with components (e.g. `Home.jsx` + `Home.css`)

## Rules for Claude Code
1. **Do not modify files unless explicitly asked.** Default to analysis and reporting.
2. **Always read BACKLOG.md before starting work** to understand current priorities.
3. **Never hardcode data that changes.** If data will update over time, it belongs in Supabase.
4. **Use shared constants.** Check `src/constants.js` before defining REPS, STATES, or colours inline.
5. **Test before committing.** Run `npm run build` to verify no build errors.
6. **Keep bundle size small.** We're on free tiers. Don't add large dependencies without asking.
7. **Respect the existing patterns.** New pages go in `src/pages/`, new shared components in `src/components/`.
