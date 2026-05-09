import { supabase } from '../lib/supabase'

let rulesPromise = null

export function getRules() {
  if (!rulesPromise)
    rulesPromise = supabase.from('ranging_rules').select('*').then(({ data }) => data || [])
  return rulesPromise
}

function storeMatchesValue(field, value, store) {
  if (field === 'state')        return store.state === value
  if (field === 'banner')       return store.banner === value
  if (field === 'banner_state') {
    const [banner, state] = value.split('|')
    return store.banner === banner && store.state === state
  }
  return false
}

export function isProductValidForStore(item_name, category, store, rules) {
  const applicable = rules.filter(r =>
    r.item_name === item_name ||
    (r.item_name === 'ALL_YOGHURT' && category === 'Yoghurt')
  )
  if (!applicable.length) return true

  for (const r of applicable)
    if (r.rule_type === 'exclude' && storeMatchesValue(r.field, r.value, store)) return false

  const includes = applicable.filter(r => r.rule_type === 'include_only')
  if (includes.length && !includes.some(r => storeMatchesValue(r.field, r.value, store))) return false

  return true
}
