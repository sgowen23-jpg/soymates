// Pure share-of-shelf logic for the Perfect Store Calculator.
// Kept free of React so it can be tested on its own.

export const FIELDS = [
  { key: 'totalUht',    label: 'Total UHT',         hint: 'Dairy + plant' },
  { key: 'plantUht',    label: 'Plant-based',       hint: 'All brands' },
  { key: 'vitasoyUht',  label: 'Vitasoy',           hint: 'All Vitasoy' },
  { key: 'oatUht',      label: 'Oat milk UHT',      hint: 'Excl. barista' },
  { key: 'vitasoyOat',  label: 'Vitasoy oat UHT',   hint: 'Excl. barista' },
]

export const EMPTY_INPUTS = Object.fromEntries(FIELDS.map(f => [f.key, '']))

const MAX_DIGITS = 4

// Keep digits only: blocks minus signs, decimals, spaces and pasted junk.
export function sanitise(raw) {
  return String(raw ?? '').replace(/\D/g, '').slice(0, MAX_DIGITS)
}

// '' -> null (not entered), otherwise a whole number >= 0.
export function toCount(str) {
  if (str === '' || str == null) return null
  const n = Number(str)
  return Number.isInteger(n) && n >= 0 ? n : null
}

// Field-level errors: a part can never exceed its whole.
export function validate(v) {
  const errors = {}
  const over = (part, whole) => v[part] != null && v[whole] != null && v[part] > v[whole]
  if (over('plantUht', 'totalUht'))     errors.plantUht   = 'Cannot exceed total UHT facings'
  if (over('vitasoyUht', 'plantUht'))   errors.vitasoyUht = 'Cannot exceed plant-based facings'
  if (over('vitasoyOat', 'oatUht'))     errors.vitasoyOat = 'Cannot exceed total oat facings'
  return errors
}

// Smallest additional facings so that (part + x) / whole > target%,
// with the whole held constant. Integer maths avoids float edge cases.
export function facingsNeeded(part, whole, targetPct) {
  const minPart = Math.floor((targetPct * whole) / 100) + 1
  return Math.max(0, minPart - part)
}

function kpi({ id, name, target, part, whole, partKey, wholeKey, errors, needed }) {
  const base = { id, name, target }
  if (errors[partKey] || errors[wholeKey]) return { ...base, status: 'invalid' }
  if (part == null || whole == null || whole === 0) return { ...base, status: 'incomplete' }
  const pct = (part / whole) * 100
  // Compare on whole numbers so 45.0% exactly is a FAIL, never a float fluke.
  const pass = part * 100 > target * whole
  return {
    ...base,
    status: pass ? 'pass' : 'fail',
    pct,
    display: `${pct.toFixed(1)}%`,
    needed: needed ? facingsNeeded(part, whole, target) : null,
  }
}

export function calculate(inputs) {
  const v = Object.fromEntries(FIELDS.map(f => [f.key, toCount(inputs[f.key])]))
  const errors = validate(v)
  const kpis = [
    kpi({ id: 'plantShare', name: 'Plant-Based Share of UHT', target: 45,
          part: v.plantUht, whole: v.totalUht, partKey: 'plantUht', wholeKey: 'totalUht', errors }),
    kpi({ id: 'vitasoyShare', name: 'Vitasoy Share of Plant-Based', target: 30,
          part: v.vitasoyUht, whole: v.plantUht, partKey: 'vitasoyUht', wholeKey: 'plantUht', errors, needed: true }),
    kpi({ id: 'oatShare', name: 'Vitasoy Oat Share', target: 30,
          part: v.vitasoyOat, whole: v.oatUht, partKey: 'vitasoyOat', wholeKey: 'oatUht', errors, needed: true }),
  ]
  return { values: v, errors, kpis }
}

export function formatResults({ values, kpis }, date = new Date()) {
  const d = date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const show = n => (n == null ? '-' : n)
  const lines = [
    `Perfect Store Calculator (${d})`,
    '',
    ...kpis.map(k => {
      if (k.status === 'pass' || k.status === 'fail') {
        let line = `${k.name}: ${k.display} ${k.status.toUpperCase()} (target >${k.target}%)`
        if (k.needed > 0) line += `, +${k.needed} Vitasoy facings needed`
        return line
      }
      return `${k.name}: ${k.status === 'invalid' ? 'Check inputs' : 'Incomplete'} (target >${k.target}%)`
    }),
    '',
    `Facings: Total UHT ${show(values.totalUht)}, Plant-based ${show(values.plantUht)}, ` +
      `Vitasoy ${show(values.vitasoyUht)}, Oat ${show(values.oatUht)}, Vitasoy oat ${show(values.vitasoyOat)}`,
  ]
  return lines.join('\n')
}
