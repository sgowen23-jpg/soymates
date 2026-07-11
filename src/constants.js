export const APP_NAME = 'Team VB'

export const VITASOY_RED  = '#C21531'
export const NIVEA_BLUE   = '#0032A1'

// ─── Current cycle ────────────────────────────────────────────────────────────
export const CURRENT_CYCLE = 1
export const CURRENT_YEAR  = 2026

// Maps cycle number → the calendar year it runs in
export const CYCLE_YEAR_MAP = {
  1: 2026,
  2: 2026,
  3: 2025,
  4: 2025,
}

// Maps cycle number → Monday start date (YYYY-MM-DD)
// Single source of truth — import here, never redefine locally
export const CYCLE_STARTS = {
  1: '2026-03-30',
  2: '2026-06-22',
  3: '2026-09-14',
}

// ─── Financial year ───────────────────────────────────────────────────────────
// FY runs April → March. Single source of truth for the FY boundary — the GSV
// reorder-turn calc depends on which FY month a gain lands in.
export const FY_START_MONTH = 4  // April

// Reorder-turn months left in the FY for a gain landing on `date`:
// April = 11 remaining … March = 0. Driven by FY_START_MONTH so the boundary
// lives in one place.
export function turnMonthsRemaining(date) {
  const m = date.getMonth() + 1                          // 1-12 calendar month
  const fyMonthIndex = (m - FY_START_MONTH + 12) % 12    // 0 = FY start (April)
  return 11 - fyMonthIndex
}
