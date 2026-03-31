# Soymates Codebase Audit
**Date:** 2026-03-31
**Framework:** React 19 + Vite 8
**Repo:** https://github.com/sgowen23-jpg/soymates

---

## 1. Folder Structure

### Layout
```
soymates/
├── public/               ← static assets (logo, icons)
├── scripts/              ← Python data import scripts
├── src/
│   ├── assets/           ← images (some unused — see §7)
│   ├── components/       ← shared UI components
│   ├── context/          ← React context (auth)
│   ├── data/             ← static JS data files
│   ├── lib/              ← Supabase client
│   ├── pages/            ← one folder/file per page
│   │   ├── StoreMap/     ← multi-file page
│   │   ├── DataUpload/   ← multi-file page
│   │   └── LeaveCalendar/← multi-file page
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
├── push-to-github.bat
└── soymates/             ← EMPTY FOLDER (dead — see §7)
```

### Assessment

**What works well:** The feature-based page structure is clean. Multi-file pages (StoreMap, DataUpload, LeaveCalendar) correctly use subdirectories with an `index.jsx` entry point. Shared components live in `src/components/`. The `src/lib/` pattern for the Supabase client is conventional and correct.

**Issues:**

- **Empty `soymates/` subfolder at repo root.** A leftover from when the two files were copied from OneDrive. Should be deleted.

- **`src/data/` is a mix of live and stale data.** `stores.js` (78 KB) and `bnbData.js` (947 KB) are large static files embedded in the bundle. `targets.js` and `prodCategories.js` are smaller and used as config. The large files are a performance problem (see §6) and a data freshness problem — they will silently go stale when Supabase data changes.

- **`push-to-github.bat` at the repo root** is a development helper script that has no place in a committed codebase. Once the repo is on GitHub it's redundant.

---

## 2. Database Connection

**File:** `src/lib/supabase.js`

```js
const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**This is correctly set up.** Credentials are loaded from Vite environment variables, not hardcoded. The anon key will be visible in the compiled JavaScript bundle — this is by design for Supabase's client-side SDK. The anon key is safe to expose as long as RLS policies are in place (see §5).

**One gap:** There is no `.env.example` file in the repo. A new developer cloning this has no record of which environment variables are required. The app will silently create a broken Supabase client (`createClient(undefined, undefined)`) with no error message if the `.env` file is missing.

**Python scripts:** All four scripts in `scripts/` hardcode the same Supabase URL and anon key directly in source:
```python
SUPABASE_KEY = "sb_publishable_pFWQYGJhjM-BGPNbvwGUQg_dK0izygj"
```
Since this key is already the public anon key this is not a secrets leak, but it is inconsistent with the frontend convention and means the scripts will break if the key rotates.

---

## 3. Data Fetching — Page by Page

| Page | Supabase tables queried | Hardcoded data used |
|---|---|---|
| **Home** | `leave_entries` (SELECT today's active entries) | `PIE_DATA` (distribution pie charts), `CYCLE_START`, `REPS`, and all of `targets.js` |
| **Targets** | **None** | Entirely from `src/data/targets.js` |
| **Distribution** | Delegates to ListView / ByProductView / StoreProfile | — |
| **ListView** | `store_distribution` (SELECT store_id, ranging WHERE store_id IN visibleIds) | `STORES` from `src/data/stores.js` |
| **StoreProfile** | `store_distribution` + `bnb_13wk` or `bnb_26wk` (both SELECT by store_id) | — |
| **ByProductView** | `store_distribution` (SELECT all, paginated, with state/rep filter) | — |
| **StoreMap** | Delegates to MapView / StoreProfile | — |
| **MapView** | **None** | `STORES` from `src/data/stores.js`, `BNB_DATA` from `src/data/bnbData.js` |
| **Promotions** | `promo_calendar` (SELECT by retailer, year ≥ 2026, ordered by sort_order) | Metcash week map hardcoded |
| **PerfectStore** | `perfect_store` (SELECT all with state filter) | KPI definitions hardcoded |
| **CyclePlanner** | `perfect_store` (reads store data) | `STORES` from `src/data/stores.js`, `CYCLE_STARTS` hardcoded |
| **LeaveCalendar** | `leave_entries` (SELECT/INSERT/DELETE), `birthdays` (SELECT/UPSERT/DELETE) | `REPS` list hardcoded |
| **DataUpload** | `stores` (UPSERT on conflict store_name) | — |
| **MSOPipeline** | **None** | Entirely hardcoded `PIPELINE` constant (10 deals, all data inline) |
| **Admin** | None | Placeholder only |

### Critical findings

**`Targets` is fully hardcoded.** Every number — stores, current points, gap, baseline — is a static JS object last updated for Cycle 4. The page will show wrong data as soon as a new cycle begins unless a developer edits the file and redeploys.

**`MSOPipeline` is fully hardcoded.** All 10 deal records (MSO name, stage, value, products, notes, next steps) are compile-time constants. Updating a deal requires a code change and redeploy.

**`MapView` uses `bnbData.js` (947 KB static file) for gap counts** while `ListView` (showing the same stores) queries Supabase live for the same information. The same data is sourced in two different ways for two components that appear on the same page. The static file will go stale; the Supabase query is always fresh.

**`Home` pie charts (`PIE_DATA`) are hardcoded** with fixed percentages (68%, 55%, 40% etc.). They do not reflect real distribution data from Supabase.

**`CyclePlanner` uses `STORES` from the static `stores.js` file** rather than querying the `stores` table in Supabase, meaning the planner will not see stores added via the Data Upload page.

---

## 4. Component Architecture

### What works well

- **`Sidebar`** is a clean, shared navigation component with sign-out wired correctly.
- **`StoreSearchInput`** is a well-extracted shared component used by StoreMap and Distribution.
- **`Dashboard`** uses `React.lazy` + `Suspense` for all 12 pages — good for bundle splitting.
- **Sub-components** like `KpiBar`, `StorePanel`, `ProfileSection`, and `ProductPicker` are cleanly scoped inside their parent files.

### Duplication problems

**`REPS` array is defined 6+ times:**
The same list of 6 rep names appears as a constant in: `Home.jsx`, `StoreMap/index.jsx`, `Distribution.jsx`, `CyclePlanner.jsx`, `PerfectStore.jsx`, `LeaveCalendar/index.jsx` (exported), and `Sidebar.jsx`. If a rep joins or leaves, all of these files need updating simultaneously.

**`STATES` array is duplicated:**
`['All', 'NSW', 'QLD', 'SA', 'VIC', 'WA']` appears in both `StoreMap/index.jsx` and `Distribution.jsx`.

**`getSegment(product)` is implemented twice with near-identical logic:**
- `ByProductView.jsx:7` — classifies products as UHT Core / UHT / Fresh / Yoghurt / Other
- `Promotions.jsx:47` — classifies as UHT / Fresh / Yoghurt / Other

Both use the same regex patterns (`/ygt/i`, `/frsh|esl/i`, `/uht/i`). These should be a single shared utility.

**`cleanName()` / `clean()` are the same function with different names:**
- `ByProductView.jsx:17` — `function cleanName(p) { return p.replace(/^\*\s*/, '').trim() }`
- `StoreProfile.jsx:8` — `function clean(name) { return name.replace(/^\*\s*/, '').trim() }`

**`toDateStr()` is defined twice:**
- `Home.jsx:47`
- `LeaveCalendar/index.jsx:25`

**`REP_COLORS` is defined twice:**
- `LeaveCalendar/index.jsx:16` (exported)
- `Targets.jsx:5` (different color for one rep: Shane Vandewardt is `#CC0000` in Targets, `#c0392b` in LeaveCalendar)

**`PieChart` SVG component is duplicated:**
- `Home.jsx:74` — slightly different implementation (uses `stroke` prop)
- The original `OneDrive/soymates/Home.jsx` had its own version too

All of the above should be extracted into `src/utils/` or `src/constants/` files.

---

## 5. Auth and RLS

### Frontend auth

The auth implementation is correct:

```jsx
// App.jsx
if (session === undefined) return null  // loading
return session ? <Dashboard /> : <Login />
```

- `AuthContext` subscribes to `onAuthStateChange` and cleans up the subscription — no memory leak.
- The loading state (`session === undefined`) is handled to prevent a flash of the login screen.
- `Login.jsx` uses `signInWithPassword` — email + password auth, correct.
- Sign-out is in the Sidebar, calling `supabase.auth.signOut()` — correct.
- There is no sign-up page. Access requires an account created in the Supabase dashboard — appropriate for a closed team tool.

### Issues

**No role-based access control.** Any authenticated user can access every page including Admin. The Sidebar shows "Admin" to all users with no guard. `Admin.jsx` itself says "Restricted" in its header but has no actual access check. If Admin grows to include real functionality (data deletion, user management), this will need a `user_role` check.

**All frontend data operations use the anon key.** Every `supabase.from(...)` call — reads, inserts, deletes — uses the anon key. This means RLS policies in Supabase are the only access control layer. This is the correct pattern for a Supabase app, but it means:
- If RLS is disabled on any table, any authenticated (or unauthenticated) user can read/write it.
- The `leave_entries` and `birthdays` tables allow any authenticated user to delete any other user's entries — there is no "only delete your own" constraint enforced in the frontend code (anyone can click the ✕ on another rep's leave).

**`DataUpload` upserts into `stores` with no server-side validation.** Any authenticated user can overwrite the store list. There is no check that the user is an admin before the upload proceeds.

---

## 6. Performance Risks

### `src/data/bnbData.js` — 947 KB static bundle entry

This file is imported by `MapView.jsx` and is compiled directly into the JavaScript bundle. On a mobile connection this adds significant load time. The data is already in Supabase (`store_distribution` / `bnb_13wk`); `ListView` fetches it live. `MapView` should do the same. This is both a performance problem and a data-staleness problem.

### `ByProductView` loads the entire `store_distribution` table client-side

```js
// ByProductView.jsx — fetches ALL rows in a while loop
while (true) {
  let q = supabase.from('store_distribution').select('...').range(from, from + 999)
  ...
}
```

At ~700 stores × ~40 products = ~28,000 rows today, this is manageable. At 1,000 stores × 60 products = 60,000 rows, the fetch will take several seconds and hold 60,000 objects in memory. All filtering and grouping is done in JavaScript after fetching. As the dataset grows this will visibly degrade.

### `STORES` from `src/data/stores.js` (78 KB) is imported by 3 components

`ListView`, `MapView`, and `CyclePlanner` all import the full `STORES` array from the static file. Even with code splitting, any page that imports this will pull in 78 KB of parsed JSON. Combined with `bnbData.js` this represents over 1 MB of static data in the bundle before any actual app code.

### `ListView` refetches `store_distribution` on every filter change

```js
useEffect(() => { fetchGaps() }, [filters?.state, filters?.rep])
```

Each time the user changes the state or rep dropdown, a new Supabase query fires. There is no debouncing and no cache — rapid filter changes will fire overlapping requests. The last one to resolve wins, which can produce incorrect results if a slower earlier request arrives after a faster later one (no cancellation or sequence guard).

### `Promotions` re-fetches on every retailer tab change, no cache

Switching between IGA → Ritchies → IGA fires two separate fetches. A simple in-memory cache keyed by retailer would eliminate the second one.

---

## 7. Dead Code

| Item | Location | Why it's dead |
|---|---|---|
| `soymates/` folder | repo root | Empty directory, leftover from OneDrive copy |
| `src/assets/react.svg` | `src/assets/` | Vite scaffold boilerplate — not imported by any file |
| `src/assets/vite.svg` | `src/assets/` | Vite scaffold boilerplate — not imported by any file |
| `src/assets/hero.png` | `src/assets/` | Not imported by any source file (check before deleting) |
| `PLACEHOLDER_PAGES = []` | `Dashboard.jsx:28` | Empty array — the conditional block `{PLACEHOLDER_PAGES.includes(activePage) && ...}` can never render |
| `import_perfect_store_c3.py` | `scripts/` | Cycle 3 version, superseded by `import_perfect_store.py` (Cycle 4). Keeping it causes confusion about which to run. |
| `push-to-github.bat` | repo root | One-time setup script, no longer needed once the repo is on GitHub |
| `src/data/bnbData.js` (947 KB) | `src/data/` | Only used by `MapView.jsx` for gap counts. `ListView` (same page) fetches this from Supabase live. The static file is stale the moment data is updated. Should be replaced with a Supabase query. |

---

## 8. Python Scripts

### `import_promo_calendar.py` — Good

The most mature script in the folder. It has:
- A `--live` CLI flag with dry-run mode as the safe default
- Batch processing with error reporting per batch
- A `delete then insert` strategy for clean re-imports
- Proper handling of edge cases (multi-buy strings, long annotation text, datetime cells)
- Sheet-to-retailer mapping that handles Excel whitespace variants

**Issues:** Hardcoded credential and absolute Windows path. Both should be environment variables / relative paths.

### `import_perfect_store.py` — Functional but fragile

- Uses **column indices** (`r.iloc[4]`, `r.iloc[14]`, etc.) instead of column names. If the Excel sheet gains or loses a column, the entire mapping silently shifts and imports corrupt data with no error.
- Uses `iterrows()` which is 10–100× slower than `df.to_dict('records')`.
- The null-checking logic on line 40 is a complex, hard-to-read one-liner that mixes multiple conditions.
- No dry-run mode — running it immediately writes to Supabase.
- Hardcoded credential and absolute Windows path.

### `import_perfect_store_c3.py` — Dead (see §7)

Cycle 3 version. Should be deleted to avoid confusion about which script to run.

### `insert_public_holidays_2026.py` — One-off, year-specific

A once-per-year script to insert 2026 public holidays. The year is baked into the filename and likely the data. Not a concern for day-to-day use, but will need a new version for 2027.

### Common problems across all scripts

1. **Hardcoded anon key** — should be in a `.env` file loaded with `python-dotenv`
2. **Hardcoded `C:\Users\sgowe\Downloads\...` paths** — will fail on any other machine. Should use `pathlib.Path` with a configurable path argument or environment variable.
3. **No shared HTTP helper** — each script reimplements its own `requests`/`urllib` Supabase calls. A 10-line shared module would remove this duplication.

---

## 9. Quick Wins

### 1. Create a shared `src/constants.js` file (30 minutes)

Move `REPS`, `STATES`, `REP_COLORS`, and cycle constants into a single shared file. This removes 6+ copies of the same data and means rep list changes require one edit, not six.

```js
// src/constants.js
export const REPS = ['Azra Horell', 'Ashleigh Tasdarian', ...]
export const STATES = ['All', 'NSW', 'QLD', 'SA', 'VIC', 'WA']
export const REP_COLORS = { 'Azra Horell': '#CC0000', ... }
export const CYCLE_START = new Date('2026-03-30')
```

### 2. Create a `.env.example` file (5 minutes)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_GOOGLE_MAPS_KEY=your-maps-key-here
```

Prevents a broken silent failure for anyone cloning the repo, and documents that three env vars are required.

### 3. Delete the dead assets (5 minutes)

Remove:
- `soymates/` (empty folder at repo root)
- `src/assets/react.svg`
- `src/assets/vite.svg`
- `scripts/import_perfect_store_c3.py`
- `push-to-github.bat`
- `PLACEHOLDER_PAGES = []` line and its dead conditional block in `Dashboard.jsx`

Reduces noise and prevents future confusion.

### 4. Extract `getSegment()` and `cleanName()` to `src/utils/products.js` (15 minutes)

Two functions are currently duplicated across pages. Extracting them ensures consistent classification logic (ByProductView and Promotions currently classify segments slightly differently because they're separate copies):

```js
// src/utils/products.js
export function getSegment(product) { ... }
export function cleanName(product) { return product.replace(/^\*\s*/, '').trim() }
```

### 5. Replace `bnbData.js` with a Supabase query in `MapView` (1–2 hours)

Remove the 947 KB static file from the bundle. `MapView` already renders alongside `ListView`, which fetches live gap data from `store_distribution`. Pass the `gapMap` from `ListView` as a prop to `MapView`, or have `MapView` make its own Supabase query the same way `ListView` does. This is the single change that will have the biggest impact on initial load performance.

---

## Summary

| Area | Status | Priority |
|---|---|---|
| Folder structure | Good overall; one empty dead folder | Low |
| Database connection (frontend) | Correct — env vars, proper client | ✓ |
| Database connection (scripts) | Credential hardcoded in all 4 scripts | Medium |
| Targets page | 100% hardcoded — will show wrong data next cycle | High |
| MSO Pipeline page | 100% hardcoded — requires code edit to update a deal | High |
| Home pie charts | Hardcoded distribution percentages | High |
| MapView using 947 KB static file | Major bundle size + stale data risk | High |
| REPS/STATES duplication | 6+ copies across the codebase | Medium |
| getSegment / cleanName duplication | 2 copies each, slightly inconsistent | Medium |
| ByProductView full-table fetch | Will degrade as data grows | Medium |
| No .env.example | Silent failure risk for new developers | Low |
| Auth gates | Any user can access Admin; no delete-own guard | Medium |
| Dead files | 7 items identified | Low |
| Python script quality | import_promo_calendar is good; perfect_store is fragile | Medium |
