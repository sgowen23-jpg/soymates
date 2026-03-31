# Soymates Backlog
**Last updated:** 2026-03-31

---

## Critical — Fix Now

- [ ] **Targets page: move to Supabase** — Currently 100% hardcoded in `src/data/targets.js`. Create a `targets` table in Supabase, migrate the data, and have `Targets.jsx` query it live. Will show wrong data the moment a new cycle starts.
- [ ] **MSOPipeline page: move to Supabase** — All 10 deals are hardcoded constants. Create an `mso_pipeline` table, migrate data, and query live. Currently requires a code edit + redeploy to update any deal.
- [ ] **Home pie charts: connect to real data** — `PIE_DATA` is hardcoded percentages (68%, 55%, 40%). Should calculate from `store_distribution` in Supabase so the dashboard reflects reality.
- [ ] **Remove bnbData.js (947 KB)** — Replace with a Supabase query in `MapView.jsx`. `ListView` already fetches the same data live. Biggest single performance win.

## High — Fix Soon

- [ ] **Create shared constants file** — Extract `REPS`, `STATES`, `REP_COLORS`, cycle dates into `src/constants.js`. Currently duplicated 6+ times. Adding or removing a rep means editing 6 files.
- [ ] **Extract shared utils** — Move `getSegment()`, `cleanName()`, `toDateStr()` into `src/utils/`. Fixes silent inconsistency between ByProductView and Promotions.
- [ ] **Replace stores.js with Supabase query** — `src/data/stores.js` (78 KB) is used by MapView, CyclePlanner, and ListView. Should query the `stores` table so new stores from DataUpload are visible everywhere.
- [ ] **Admin access control** — Add a role check so only Sam can access Admin page. Currently any authenticated user can reach it.
- [ ] **Leave entry delete guard** — Add RLS policy or frontend check so users can only delete their own leave entries, not other reps'.

## Medium — Fix When Ready

- [ ] **ByProductView: server-side filtering** — Currently fetches entire `store_distribution` table (~28K rows) and filters in JS. Add Supabase query filters for state/rep so it only downloads what's needed.
- [ ] **ListView: debounce + cancel requests** — Refetches on every filter change with no debounce. Overlapping requests can show stale results.
- [ ] **Promotions: cache retailer tabs** — Switching tabs refetches every time. Cache previous results so switching back is instant.
- [ ] **Python scripts: use .env** — Move hardcoded Supabase key and `C:\Users\sgowe\` paths to a shared `.env` file. Won't break anything today but makes scripts portable.
- [ ] **Fix REP_COLORS discrepancy** — Shane is `#CC0000` in Targets and `#c0392b` in LeaveCalendar. Shared constants file will fix this.

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
