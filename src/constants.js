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
