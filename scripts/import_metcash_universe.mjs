// Adds every Metcash store from a B&B export to the `stores` table.
// Existing stores are left alone. New stores go in as rep 'Unassigned' and
// in_universe = false (unless the export marks them IN UNIVERSE = Yes).
//
// Needs scripts/migrations/add_store_universe.sql run first.
// Dry run:  node scripts/import_metcash_universe.mjs "<export.xlsx>"
// Apply:    node scripts/import_metcash_universe.mjs "<export.xlsx>" --apply
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const here = path.dirname(fileURLToPath(import.meta.url))

const env = Object.fromEntries(
  fs.readFileSync(path.join(here, '.env'), 'utf8').split(/\r?\n/)
    .filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_ = env.SUPABASE_URL
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` }

const file  = process.argv[2]
const apply = process.argv.includes('--apply')
if (!file) { console.error('Usage: node scripts/import_metcash_universe.mjs <export.xlsx> [--apply]'); process.exit(1) }

const wb   = XLSX.readFile(file)
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })

// One record per store
const byId = new Map()
for (const r of rows) {
  const id = parseInt(r['STORE ID'], 10)
  if (!id || byId.has(id)) continue
  byId.set(id, {
    store_id:    id,
    store_name:  r['STORE NAME'],
    state:       r['STATE'],
    mso:         r['MSO'] || null,
    banner:      r['BANNER'] || null,
    rep_name:    'Unassigned',
    in_universe: String(r['IN UNIVERSE']).trim().toLowerCase() === 'yes',
  })
}

// Existing store ids (match on store_id or store_id_26)
const existing = new Set()
for (let from = 0; ; from += 1000) {
  const res  = await fetch(`${URL_}/rest/v1/stores?select=store_id,store_id_26,in_universe&order=store_id`, { headers: { ...H, Range: `${from}-${from + 999}` } })
  const data = await res.json()
  if (data?.code === '42703') { console.error('stores.in_universe column missing — run scripts/migrations/add_store_universe.sql first.'); process.exit(1) }
  if (!Array.isArray(data)) { console.error('Could not read stores:', data); process.exit(1) }
  if (from === 0 && data.length && !('in_universe' in data[0])) {
    console.error('stores.in_universe column missing — run scripts/migrations/add_store_universe.sql first.'); process.exit(1)
  }
  data.forEach(s => { existing.add(s.store_id); if (s.store_id_26) existing.add(s.store_id_26) })
  if (data.length < 1000) break
}

const toAdd = [...byId.values()].filter(s => !existing.has(s.store_id))
const byState = {}
toAdd.forEach(s => { byState[s.state] = (byState[s.state] || 0) + 1 })
console.log(`Export stores: ${byId.size}. Already in table: ${byId.size - toAdd.length}. To add: ${toAdd.length}`, byState)

if (!apply) { console.log('Dry run — re-run with --apply to insert.'); process.exit(0) }

for (let i = 0; i < toAdd.length; i += 200) {
  const res = await fetch(`${URL_}/rest/v1/stores?on_conflict=store_id`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(toAdd.slice(i, i + 200)),
  })
  if (!res.ok) { console.error('Insert failed:', res.status, await res.text()); process.exit(1) }
}
console.log(`Inserted ${toAdd.length} stores.`)
