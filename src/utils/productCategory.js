import { supabase } from '../lib/supabase'

const RTD_ITEM_IDS = ['849103', '289772']

// product_master.category → app category strings used everywhere else
const MASTER_CATEGORY_MAP = {
  'UHT CORE':     'UHT Core',
  'UHT NON CORE': 'UHT',
  'CHILLED':      'Fresh',
  'YOGHURT':      'Yoghurt',
  'RTD':          'RTD',
}

const masterMap = new Map()   // item_id (string) → app category
let masterPromise = null

// Fetch product_master once and cache (same pattern as getRules in rangingRules.js).
// Callers that pass item_id await this before categorising; if the fetch fails or
// returns nothing, masterMap stays empty and getProductCategory falls back to the
// original logic below.
export function loadProductMaster() {
  if (!masterPromise)
    masterPromise = supabase
      .from('product_master')
      .select('item_id, category')
      .then(({ data }) => {
        (data || []).forEach(r => {
          const cat = MASTER_CATEGORY_MAP[r.category]
          if (cat) masterMap.set(String(r.item_id), cat)
        })
        return masterMap
      })
      .catch(() => masterMap)  // network failure → empty map, callers fall back to old logic
  return masterPromise
}

export function getProductCategory(itemName, pogCategory = null, itemId = null) {
  if (itemId != null) {
    const fromMaster = masterMap.get(String(itemId))
    if (fromMaster) return fromMaster
    if (RTD_ITEM_IDS.includes(String(itemId))) return 'RTD'
  }
  if (pogCategory) {
    if (pogCategory === 'DAIRY - YOGHURTS & DESSERTS')        return 'Yoghurt'
    if (pogCategory === 'DAIRY - SPECIALTY & FLAVOURED MILK') return 'Fresh'
    if (pogCategory === 'BEVERAGES - MILK & CREAM LONG LIFE')
      return itemName && itemName.trimStart().startsWith('*') ? 'UHT Core' : 'UHT'
    return 'Fresh'
  }
  // Regex fallback when pog_category is not available (store_distribution, promo_calendar)
  if (!itemName) return 'Fresh'
  if (/ygt/i.test(itemName))   return 'Yoghurt'
  if (/frsh|esl/i.test(itemName)) return 'Fresh'
  if (itemName.trimStart().startsWith('*') && /uht/i.test(itemName)) return 'UHT Core'
  if (/uht/i.test(itemName))   return 'UHT'
  return 'Fresh'
}
