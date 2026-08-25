export const APP_NAME = 'Team VB'

export const VITASOY_RED  = '#C21531'
export const NIVEA_BLUE   = '#0032A1'

// ─── Team roster ──────────────────────────────────────────────────────────────
// Order here drives the Home launcher rep grid.
export const REPS = [
  'Melissa Robbie',
  'David Kerr',
  'Dipen Surani',
  'Sam Gowen',
  'Shane Vandewardt',
]

// Which state each rep covers — drives their tile colour on the Home launcher.
export const REP_STATES = {
  'Melissa Robbie':   'NSW',
  'David Kerr':       'QLD',
  'Dipen Surani':     'WA',
  'Sam Gowen':        'SA',
  'Shane Vandewardt': 'VIC',
}

// State colours, matched to the team's folder-icon convention.
// `c` = text/accent, `border` = soft tinted card border.
export const STATE_COLORS = {
  NSW: { c: '#1971c2', border: '#bcd6f0' },
  QLD: { c: '#e03131', border: '#f3c2c2' },
  SA:  { c: '#c98a00', border: '#eddaa6' },
  VIC: { c: '#7048e8', border: '#cfc3f5' },
  WA:  { c: '#e8590c', border: '#f4cbb0' },
}

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
