# Soymates Backlog
**Last updated:** 2026-04-09

---

## Completed

- [x] **Data Upload page** — Master Store Key upload to `stores` table via upsert on `store_id`
- [x] **Weekly Upload page** — Three uploaders: 26wk BNB, 13wk BNB, Distribution (all use Export sheet)
- [x] **Distribution tab rewired to Supabase** — Reads from `bnb_26wk`, `bnb_13wk`, `store_distribution` live
- [x] **StoreMap ListView rewired to Supabase** — Reads from `stores` table (no longer uses static `stores.js`)
- [x] **Perfect Store ranging sync** — `sync_perfect_store_ranging()` RPC updates ranging columns from `bnb_26wk` after each 26wk upload

---

## Critical — Fix Now

- [ ] **Targets page: move to Supabase** — Currently 100% hardcoded in `src/data/targets.js`. Create a `targets` table in Supabase, migrate the data, and have `Targets.jsx` query it live. Will show wrong data the moment a new cycle starts.
- [ ] **MSOPipeline page: move to Supabase** — All 10 deals are hardcoded constants. Create an `mso_pipeline` table, migrate data, and query live. Currently requires a code edit + redeploy to update any deal.
- [ ] **Home pie charts: connect to real data** — `PIE_DATA` is hardcoded percentages (68%, 55%, 40%). Should calculate from `store_distribution` in Supabase so the dashboard reflects reality.
- [ ] **Remove bnbData.js (947 KB)** — Replace with a Supabase query in `MapView.jsx`. `ListView` already fetches the same data live. Biggest single performance win.
- [ ] **Implement RLS** — All Supabase tables are currently UNRESTRICTED. Security risk — any authenticated user can read/write all data. Needs row-level security policies on all tables.
- [ ] **Fix StoreMap MapView** — Still reads store pins from static `src/data/stores.js`. New stores added via DataUpload won't appear on the map until this is migrated to a Supabase query.

## High — Fix Soon

- [ ] **Create shared constants file** — Extract `REPS`, `STATES`, `REP_COLORS`, cycle dates into `src/constants.js`. Currently duplicated 6+ times. Adding or removing a rep means editing 6 files.
- [ ] **Extract shared utils** — Move `getSegment()`, `cleanName()`, `toDateStr()` into `src/utils/`. Fixes silent inconsistency between ByProductView and Promotions.
- [ ] **Replace stores.js with Supabase query** — `src/data/stores.js` (78 KB) is used by MapView, CyclePlanner, and ListView. Should query the `stores` table so new stores from DataUpload are visible everywhere.
- [ ] **Admin access control** — Add a role check so only Sam can access Admin page. Currently any authenticated user can reach it.
- [ ] **Leave entry delete guard** — Add RLS policy or frontend check so users can only delete their own leave entries, not other reps'.
- [ ] **Rep login separation** — Each rep should see only their territory data when logged in; Sam sees all as admin. Needs a `rep_profiles` table mapping auth user IDs to rep names, then RLS policies filtering by rep.
- [ ] **Cycle Planner GSV display bug** — `psC1` data not rendering correctly in store cards. Diagnose with `console.log` before touching any data logic. Do not modify cycle planner tables.
- [ ] **Store Contacts feature** — New table, upload flow, contacts tab on store panel, email builder, and panel integration. See full plan for details.

## Medium — Fix When Ready

- [ ] **ByProductView: server-side filtering** — Currently fetches entire `store_distribution` table (~28K rows) and filters in JS. Add Supabase query filters for state/rep so it only downloads what's needed.
- [ ] **ListView: debounce + cancel requests** — Refetches on every filter change with no debounce. Overlapping requests can show stale results.
- [ ] **Promotions: cache retailer tabs** — Switching tabs refetches every time. Cache previous results so switching back is instant.
- [ ] **Python scripts: use .env** — Move hardcoded Supabase key and `C:\Users\sgowe\` paths to a shared `.env` file. Won't break anything today but makes scripts portable.
- [ ] **Fix REP_COLORS discrepancy** — Shane is `#CC0000` in Targets and `#c0392b` in LeaveCalendar. Shared constants file will fix this.
- [ ] **Contact edit from mobile** — Rep can update a store contact's details directly from the store panel without needing a re-upload.
- [ ] **File attachment library** — Supabase Storage bucket for email attachments. Cap at 5 PDF + 2 Excel files to stay within free-tier storage limits.

## Low — Cleanup

- [ ] **Delete dead files** — Empty `soymates/` folder, `react.svg`, `vite.svg`, `import_perfect_store_c3.py`, `push-to-github.bat`, `PLACEHOLDER_PAGES` array in Dashboard.jsx.
- [ ] **Add .env.example** — Document `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and any other required vars.
- [ ] **Verify hero.png usage** — Audit flagged it as potentially unused. Check before deleting.

## Planned Features (not yet started)

- [ ] **Focus store tracking** — Boss requested. Track which stores are focus stores per rep.
- [ ] **Territory planning** — Boss requested. Visual territory assignment and planning.
- [ ] **Plan vs output reporting** — Boss requested. Compare planned activity against actual results.
- [ ] **RLS for rep-level data** — Each rep sees only their own data; Sam sees all as admin.
- [ ] **Vitasoy brand refresh** — Red, white, navy colour scheme launching May 2026. Redesign app visuals to match.

## Future (month+ away)

- [ ] **Product photo uploads** — Deferred due to Supabase free-tier storage limits.
- [ ] **Mapbox/OpenStreetMap fallback** — Alternative to Google Maps if billing becomes an issue.
