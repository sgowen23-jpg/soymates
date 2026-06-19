const CLASS_COLORS = {
  'PERFECT STORE': '#2e7d32',
  'GROW':          '#0e7490',
  'DEVELOP':       '#e67e22',
  'EXPAND':        '#546e7a',
}

function classColor(val) {
  return CLASS_COLORS[val?.toUpperCase?.().trim()] || '#888'
}

function fmtPct(v)  { return v == null ? '—' : `${(v * 100).toFixed(1)}%` }
function fmtSos(v)  {
  if (v == null || v === '') return '—'
  const n = parseFloat(v)
  return isNaN(n) ? String(v) : `${(n * 100).toFixed(1)}%`
}
function fmtNum(v)  { return v == null ? '—' : v }

const COLS = [
  { label: 'State',            key: 'state' },
  { label: 'Location',         key: 'location' },
  { label: 'Store ID',         key: 'store_id' },
  { label: 'Store Name',       key: 'store_name' },
  { label: 'Cluster',          key: 'cluster' },
  { label: 'MSO',              key: 'mso' },
  { label: 'Banner',           key: 'banner' },
  { label: 'Catalogue',        key: 'catalogue_format' },
  { label: 'Classification',   key: 'classification' },
  { label: 'Focus Store',      key: 'focus_store' },
  { label: 'Distribution %',   key: 'distribution_pct' },
  { label: 'Eligible?',        key: 'eligible' },
  { label: 'UHT Core Gaps',    key: 'uht_core_gaps' },
  { label: 'UHT NonCore Gaps', key: 'uht_noncore_gaps' },
  { label: 'Chilled Opp',      key: 'chilled_opp' },
  { label: 'RTD Opp',          key: 'rtd_opp' },
  { label: 'Yoghurt Opp',      key: 'yoghurt_opp' },
  { label: 'Total Opp',        key: 'total_opp' },
  { label: 'Metcash Rank',     key: 'metcash_ranking' },
  { label: 'Vitasoy Rank',     key: 'vitasoy_ranking' },
  { label: 'Assumed Sales',    key: 'vitasoy_assumed_sales' },
  { label: 'GSV Potential',    key: 'gsv_potential' },
  { label: 'UHT SOS',          key: 'uht_sos' },
  { label: 'T/Up Previous',    key: 'tup_previous' },
  { label: 'Call Freq Target', key: 'call_freq_target' },
  { label: 'Actual Visits',    key: 'actual_visits' },
]

const fmtCurrency = v => v == null ? '—' : `$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

function cellValue(r, key) {
  switch (key) {
    case 'distribution_pct':       return fmtPct(r[key])
    case 'vitasoy_assumed_sales':
    case 'gsv_potential':          return fmtCurrency(r[key])
    case 'uht_sos':                return fmtSos(r[key])
    default:                       return fmtNum(r[key])
  }
}

function cellHtml(r, key) {
  if (key === 'eligible') {
    const val = r.eligible
    if (!val) return ''
    return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#e67e2220;color:#e67e22;white-space:nowrap">${val}</span>`
  }
  if (key === 'call_freq_target') {
    // rows passed to export already have `eligible` computed but not derived call_freq —
    // export the stored value with a mismatch marker if the row carries it
    const stored  = r.call_freq_target
    const derived = r._rule_call_freq ?? null
    const mismatch = derived != null && stored != null && derived !== stored
    const display = derived ?? stored ?? '—'
    return mismatch ? `${display} <span style="color:#e67e22" title="Stored value (${stored}) differs from rulebook">⚠</span>` : String(display)
  }
  if (key === 'classification') {
    const val = r[key]
    if (!val) return '<span style="color:#888">—</span>'
    const color = classColor(val)
    return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${color}20;color:${color};white-space:nowrap">${val}</span>`
  }
  if (key === 'total_opp') {
    const v = fmtNum(r[key])
    return `<span style="font-weight:600;color:#CC0000">${v}</span>`
  }
  if (key === 'actual_visits') {
    const actual = r.actual_visits ?? 0
    const target = r.call_freq_target
    if (!target) return `<span style="color:#888">${actual}</span>`
    const ratio = actual / target
    const color = ratio >= 1 ? '#2e7d32' : ratio >= 0.5 ? '#e67e22' : '#b71c1c'
    return `<span style="font-weight:600;color:${color}">${actual}</span>`
  }
  return String(cellValue(r, key) ?? '—')
}

export function exportPerfectStoreHTML({ rows, cycleLabel, filterDesc }) {
  const exportedAt = new Date().toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const thead = COLS.map(c => `<th>${c.label}</th>`).join('')
  const tbody = rows.map(r =>
    `<tr>${COLS.map(c => `<td>${cellHtml(r, c.key)}</td>`).join('')}</tr>`
  ).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Perfect Store — ${cycleLabel}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; padding: 16px; }
  h2 { font-size: 16px; margin: 0 0 4px; }
  p.meta { font-size: 11px; color: #888; margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; white-space: nowrap; }
  th { background: #f0f0f0; font-weight: 600; font-size: 11px; text-align: left; padding: 6px 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; }
  td { padding: 5px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
  tr:hover td { background: #fff8f8; }
</style>
</head>
<body>
<h2>Perfect Store — ${cycleLabel}</h2>
<p class="meta">${filterDesc} · Exported ${exportedAt} · ${rows.length.toLocaleString()} stores</p>
<table>
<thead><tr>${thead}</tr></thead>
<tbody>
${tbody}
</tbody>
</table>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `perfect-store-${cycleLabel.replace(/\s+/g, '-').toLowerCase()}.html`
  a.click()
  URL.revokeObjectURL(url)
}
