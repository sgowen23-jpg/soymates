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
    ├── DataUpload/           ← Uploads Master Store Key to stores table via upsert on store_id
    ├── WeeklyUpload/         ← Three uploaders: 26wk BNB, 13wk BNB, Distribution (all use Export sheet). After 26wk upload calls sync_perfect_store_ranging() RPC.
    ├── LeaveCalendar/        ← Leave/availability calendar
    └── StoreMap/             ← Store map (MapView, ListView, StoreProfile)
scripts/                      ← Python data import scripts (run manually)
```

## Database (Supabase)
Tables currently in use:
- `stores` — store master list (upserted via DataUpload)
  - `store_id` (bigint PK), `store_id_26`, `location_id_dist`, `store_name`, `state`, `store_region`, `mso`, `rep_name`, `group_name`, `address`, `suburb`, `postcode`, `classification`, `latitude`, `longitude`
- `bnb_26wk` — 26-week buy/not-buy scan data
  - `id`, `store_id`, `store_name`, `state`, `store_region`, `mso`, `item_name`, `item_id`, `pog_category`, `rep_name`, `count_of_ranging`, `sum_of_ranging`, `distribution_percentage`, `ranging_gap`, `to_target_percentage`, `buy_rate_latest`, `uploaded_at`
- `bnb_13wk` — 13-week buy/not-buy scan data (same structure as bnb_26wk)
- `store_distribution` — product distribution by store
  - `id`, `rep_name`, `location_id`, `store_name`, `state`, `banner_group`, `item_code`, `item_name`, `latest_distribution`, `total_gains_gross`, `total_losses`, `total_net_gains`, `movement_type`, `uploaded_at`
- `promo_calendar` — promotion schedule
- `perfect_store` — perfect store scoring (ranging columns synced weekly from bnb_26wk via `sync_perfect_store_ranging()` RPC)
- `leave_entries` — team leave/availability
- `birthdays` — team birthdays

## Data Flow
- **Distribution tab** reads from `bnb_26wk`, `bnb_13wk`, `store_distribution` via Supabase (not static files)
- **StoreMap ListView** reads from `stores` table (not static `stores.js`)
- **StoreMap StoreProfile** reads from `bnb_26wk`, `bnb_13wk`, `store_distribution`
- **Perfect Store** reads from `perfect_store` table, synced weekly from `bnb_26wk` via `sync_perfect_store_ranging()` RPC

## Known Issues (from audit 2026-03-31)

### Critical — hardcoded pages
- `Targets.jsx` — 100% hardcoded from `src/data/targets.js`. Needs a Supabase table.
- `MSOPipeline.jsx` — 100% hardcoded. All 10 deals are compile-time constants.
- `Home.jsx` — Pie chart percentages (`PIE_DATA`) are hardcoded, not from Supabase.

### High — performance
- `src/data/bnbData.js` is 947 KB of static data baked into the bundle. Only used by MapView. ListView fetches the same data live from Supabase. MapView should do the same.
- `src/data/stores.js` is 78 KB. StoreMap MapView still uses this static file — needs migrating to Supabase queries.

### Medium — duplication
- `REPS` is defined 6+ times across the codebase. Needs a shared constants file.
- `STATES` is duplicated in StoreMap and Distribution.
- `getSegment()` is implemented twice (ByProductView + Promotions) with slightly different logic.
- `cleanName()` / `clean()` are the same function with different names in two files.
- `REP_COLORS` is defined twice with a colour discrepancy for Shane.

### Medium — auth gaps
- No role-based access. Any authenticated user can access Admin.
- No "delete own only" constraint on leave_entries or birthdays.
- All Supabase tables are currently UNRESTRICTED — RLS not yet implemented.

### Low — housekeeping
- BACKLOG.md needs updating to reflect completed work and new priorities.

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
8. **Never touch cycle planner data.** Do not modify `cycle_planner` tables, `cycle_day_runs`, `cycle_week_templates`, or any focus store data unless explicitly instructed.
9. **Never touch perfect_store rows from prior cycles.** Do not modify `perfect_store` rows where `cycle` is not the current cycle unless explicitly instructed.
10. **Always check CLAUDE.md for table structure** before writing queries or making assumptions about column names.
