import { supabase } from '../lib/supabase'
import { MASTER_CATEGORY_MAP } from './productCategory'
import { turnMonthsRemaining } from '../constants'

// GSV engine — values distribution gains using gsv_assumptions.
//
// Formula (verbatim from the FY 2027 GSV Calculator, do not alter):
//   first_order  = N * carton_value
//   reorder_turn = N * turn_months_remaining * carton_value * turn_rate
//   gsv          = first_order + reorder_turn
// where N is the number of cartons gained in a category, landing in a given FY month.
//
// gsv_assumptions is keyed by product_master-style category strings ('UHT CORE' …);
// we re-key by the app category strings ('UHT Core' …) that getProductCategory returns,
// via the same MASTER_CATEGORY_MAP translation layer, so both sides line up. 'UHT TOP UP'
// has no app-category equivalent (top-up deals are out of scope) and is dropped here.

const assumptionsMap = new Map()   // app category → { carton_value, turn_rate }
let assumptionsPromise = null
let provisional = false

// Fetch gsv_assumptions once and cache (same promise-cache pattern as loadProductMaster).
// Resolves to { assumptions: Map, provisional: bool }, or null if the fetch fails —
// callers treat null as "GSV unavailable" and never show a wrong number.
export function loadGsvAssumptions() {
  if (!assumptionsPromise)
    assumptionsPromise = supabase
      .from('gsv_assumptions')
      .select('category, carton_value, turn_rate, status')
      .then(({ data, error }) => {
        if (error || !data) return null
        data.forEach(r => {
          const appCat = MASTER_CATEGORY_MAP[r.category]
          if (!appCat) return
          assumptionsMap.set(appCat, { carton_value: r.carton_value, turn_rate: r.turn_rate })
          if (r.status === 'provisional') provisional = true
        })
        // Empty result (RLS-blocked, or a genuinely empty table) → treat as unavailable,
        // never as "$0 GSV". Callers show GSV as unavailable rather than a wrong number.
        if (assumptionsMap.size === 0) return null
        return { assumptions: assumptionsMap, provisional }
      })
      .catch(() => null)
  return assumptionsPromise
}

// Value a list of gains.
//   gains: [{ category (app string), cartons (default 1), date (Date, gain month) }]
//   assumptions: the Map from loadGsvAssumptions (or null/undefined)
// Returns { total, valuedCount, unvaluedCount, byCategory } — or null if assumptions
// are unavailable. A gain whose category has no assumption or a null carton_value
// (e.g. RTD) contributes 0 and is tallied as unvalued, never silently dropped.
export function computeGSV(gains, assumptions) {
  if (!assumptions) return null

  let total = 0, valuedCount = 0, unvaluedCount = 0
  const byCategory = {}

  for (const g of gains) {
    const N = g.cartons ?? 1
    const a = assumptions.get(g.category)
    if (!a || a.carton_value == null) {
      unvaluedCount += N
      continue
    }
    const firstOrder  = N * a.carton_value
    const reorderTurn = a.turn_rate != null
      ? N * turnMonthsRemaining(g.date) * a.carton_value * a.turn_rate
      : 0                                    // top-up-style: value only, no reorder turn
    const gsv = firstOrder + reorderTurn
    total += gsv
    valuedCount += N
    byCategory[g.category] = (byCategory[g.category] || 0) + gsv
  }

  return { total, valuedCount, unvaluedCount, byCategory }
}
