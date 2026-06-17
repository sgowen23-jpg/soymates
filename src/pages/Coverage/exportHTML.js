const REP_ORDER = [
  'David Kerr', 'Shane Vandewardt', 'Sam Gowen', 'Dipen Surani',
  'Sean Cooper', 'David Saleeb', 'Ashleigh Tasdarian', 'Azra Horell',
]

const REP_COLORS = {
  'Sam Gowen':          '#1a2b5e',
  'Shane Vandewardt':   '#CC0000',
  'David Kerr':         '#16a085',
  'Dipen Surani':       '#e67e22',
  'Ashleigh Tasdarian': '#8e44ad',
  'Azra Horell':        '#2980b9',
  'David Saleeb':       '#888888',
  'Sean Cooper':        '#aaaaaa',
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri']

function repColor(rep) { return REP_COLORS[rep] || '#555' }

function toDS(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtDate(ds) {
  if (!ds) return '—'
  const [, m, d] = ds.split('-')
  return `${parseInt(d)} ${MONTHS[parseInt(m)-1]}`
}

function fmtDay(d) {
  const idx = d.getDay() - 1
  return `${DAY_SHORT[idx] || ''} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function daysSince(ds) {
  if (!ds) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((today - new Date(ds + 'T00:00:00')) / 86400000)
}

function staleColor(n) {
  if (n == null) return '#888'
  if (n > 28) return '#CC0000'
  if (n > 14) return '#e67e22'
  return '#16a085'
}

export function exportCoverageHTML({ filtered, weeks, cycleLabelStr, repLabel, filterState, showAllStates }) {
  const exportedAt  = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stateLabel  = filterState !== 'All' ? filterState : 'All States'
  const statusLabel = showAllStates ? 'All visit states' : 'Successful visits only'
  const title       = `Coverage — ${cycleLabelStr} — ${stateLabel} — ${repLabel}`

  // ── Index by date ──────────────────────────────────────────────────────────
  const byDate = {}
  filtered.forEach(v => {
    if (!v.date_scheduled) return
    if (!byDate[v.date_scheduled]) byDate[v.date_scheduled] = []
    byDate[v.date_scheduled].push(v)
  })

  // ── Per-rep per-day counts (for active-day denominator) ───────────────────
  const repDayData = {}
  filtered.forEach(v => {
    if (!v.rep || !v.date_scheduled) return
    if (!repDayData[v.rep]) repDayData[v.rep] = {}
    repDayData[v.rep][v.date_scheduled] = (repDayData[v.rep][v.date_scheduled] || 0) + 1
  })

  // ── Rep order ─────────────────────────────────────────────────────────────
  const allReps = [...new Set(filtered.map(v => v.rep).filter(Boolean))]
  const reps = [
    ...REP_ORDER.filter(r => allReps.includes(r)),
    ...allReps.filter(r => !REP_ORDER.includes(r)).sort(),
  ]

  // ── Weekly visit counts per rep ───────────────────────────────────────────
  const cycleStart = new Date(toDS(weeks[0][0]) + 'T00:00:00')
  const heatmapData = {}
  reps.forEach(r => { heatmapData[r] = Array(weeks.length).fill(0) })
  filtered.forEach(v => {
    if (!v.rep || !v.date_scheduled || !heatmapData[v.rep]) return
    const w = Math.floor((new Date(v.date_scheduled + 'T00:00:00') - cycleStart) / 604800000)
    if (w >= 0 && w < weeks.length) heatmapData[v.rep][w]++
  })

  function activeDays(rep, week) {
    const days = repDayData[rep] || {}
    return week.filter(d => (days[toDS(d)] || 0) > 0).length
  }

  // Max avg for colour intensity
  let maxAvg = 1
  reps.forEach(rep => {
    ;(heatmapData[rep] || []).forEach((count, wi) => {
      const active = activeDays(rep, weeks[wi])
      const avg = active > 0 ? count / active : 0
      if (avg > maxAvg) maxAvg = avg
    })
  })

  // ── Store list (one row per store, sorted neglected-first) ─────────────────
  const storeMap = {}
  filtered.forEach(v => {
    const key = v.location_no ?? v.store_name
    if (!storeMap[key]) storeMap[key] = { store_name: v.store_name, state: v.state, dates: [] }
    if (v.date_scheduled) storeMap[key].dates.push(v.date_scheduled)
  })
  const storeList = Object.values(storeMap).map(s => {
    const sorted = [...s.dates].sort()
    const last   = sorted[sorted.length - 1]
    return { ...s, visit_count: s.dates.length, first_visit: sorted[0] || null, last_visit: last || null, days_since: daysSince(last) }
  }).sort((a, b) => (b.days_since ?? -1) - (a.days_since ?? -1))

  // ── HTML fragments ─────────────────────────────────────────────────────────

  const weekHeaders = weeks.map((week, wi) =>
    `<th style="padding:4px 6px;text-align:center;font-size:11px;font-weight:700;color:#1a2b5e;border-bottom:2px solid #e8e8e8;min-width:46px">W${wi+1}<br><span style="font-weight:400;font-size:10px;color:#aaa">${week[0].getDate()} ${MONTHS[week[0].getMonth()]}</span></th>`
  ).join('')

  const avgDayRows = reps.map(rep => {
    const counts          = heatmapData[rep] || Array(weeks.length).fill(0)
    const totalVisits     = counts.reduce((a, b) => a + b, 0)
    const totalActiveDays = weeks.reduce((s, week) => s + activeDays(rep, week), 0)
    const cycleAvg        = totalActiveDays > 0 ? (totalVisits / totalActiveDays).toFixed(1) : '—'
    const dot             = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${repColor(rep)};margin-right:6px;flex-shrink:0"></span>`
    const cells = counts.map((count, wi) => {
      const active    = activeDays(rep, weeks[wi])
      const avg       = active > 0 ? count / active : 0
      const intensity = maxAvg > 0 ? avg / maxAvg : 0
      const bg        = count === 0 ? '#f5f5f5' : `rgba(26,43,94,${(0.15 + intensity * 0.85).toFixed(2)})`
      const color     = intensity > 0.55 ? '#fff' : '#1a1a1a'
      return `<td style="text-align:center;width:46px;height:36px;background:${bg};color:${color};font-weight:600;font-size:12px;border:1px solid #f0f0f0" title="${rep} · W${wi+1}: ${count} visits · ${avg.toFixed(1)}/day">${count > 0 ? avg.toFixed(1) : ''}</td>`
    }).join('')
    return `<tr><td style="padding:8px 16px 8px 8px;white-space:nowrap;font-size:12px;font-weight:600"><span style="display:inline-flex;align-items:center">${dot}${rep.split(' ')[0]}</span></td>${cells}<td style="padding:0 10px;text-align:center;font-weight:700;font-size:13px;color:#1a2b5e;border-left:1px solid #e0e0e0">${cycleAvg}</td></tr>`
  }).join('\n')

  const rankedRows = storeList.map((s, i) => {
    const sc  = staleColor(s.days_since)
    const bg  = i % 2 === 0 ? '#ffffff' : '#fafafa'
    return `<tr style="background:${bg};border-bottom:1px solid #f0f0f0"><td style="padding:9px 14px;font-size:13px;font-weight:500">${s.store_name || '—'}</td><td style="padding:9px 14px;font-size:13px;text-align:center">${s.state || '—'}</td><td style="padding:9px 14px;font-size:13px;text-align:center;font-weight:700;color:#1a2b5e">${s.visit_count}</td><td style="padding:9px 14px;font-size:13px;text-align:center">${fmtDate(s.first_visit)}</td><td style="padding:9px 14px;font-size:13px;text-align:center">${fmtDate(s.last_visit)}</td><td style="padding:9px 14px;font-size:13px;text-align:center;font-weight:600;color:${sc}">${s.days_since != null ? s.days_since + 'd' : '—'}</td></tr>`
  }).join('\n')

  // ── Assemble full HTML ─────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#f0f2f5;color:#1a1a1a;padding:20px}
.page{max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:0}
.hd{background:#1a2b5e;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0}
.hd h1{font-size:20px;font-weight:800;margin-bottom:4px}
.hd .meta{font-size:12px;opacity:.75}
.hd .badge{display:inline-block;background:rgba(255,255,255,.2);font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px;margin-left:10px}
.sec{background:#fff;border:1.5px solid #e8e8e8;border-top:none;padding:20px 24px}
.sec:last-of-type{border-radius:0 0 10px 10px}
.sec-title{font-size:14px;font-weight:700;color:#1a2b5e;padding-bottom:8px;border-bottom:2px solid #e8e8e8;margin-bottom:12px}
.hint{font-size:12px;color:#aaa;margin-bottom:12px}
.scroll{overflow-x:auto}
table{border-collapse:collapse}
.list-table{width:100%}
.list-table th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.04em;background:#f8f8f8;border-bottom:1.5px solid #e8e8e8;white-space:nowrap}
.list-table th.c{text-align:center}
.footer{text-align:center;font-size:11px;color:#bbb;margin-top:14px;padding:0 0 10px}
</style>
</head>
<body>
<div class="page">

<div class="hd">
  <h1>${title}<span class="badge">${filtered.length} visits</span></h1>
  <div class="meta">${statusLabel} · Exported ${exportedAt} · Frozen snapshot — no live data</div>
</div>

<div class="sec">
  <div class="sec-title">Avg Visits / Day</div>
  <p class="hint">Average visits per working day (active days only) per rep per week. Hover a cell for details.</p>
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th style="padding:8px 16px 8px 8px;text-align:left;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e8e8e8;white-space:nowrap">Rep</th>
          ${weekHeaders}
          <th style="padding:4px 10px;text-align:center;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e8e8e8;border-left:1px solid #e0e0e0;white-space:nowrap">Cycle avg/day</th>
        </tr>
      </thead>
      <tbody>
        ${avgDayRows}
      </tbody>
    </table>
  </div>
</div>

<div class="sec">
  <div class="sec-title">Ranked List — ${storeList.length} stores visited</div>
  <p class="hint">Sorted by days since last visit — neglected stores surface first.</p>
  <div class="scroll">
    <table class="list-table">
      <thead>
        <tr>
          <th>Store</th>
          <th class="c">State</th>
          <th class="c">Visits</th>
          <th class="c">First Visit</th>
          <th class="c">Last Visit</th>
          <th class="c">Days Since Last</th>
        </tr>
      </thead>
      <tbody>
        ${rankedRows}
      </tbody>
    </table>
  </div>
</div>

<div class="footer">Snapshot exported from Soymates · ${exportedAt} · Contains only the filtered data visible at time of export</div>

</div>
</body>
</html>`

  // ── Trigger download ───────────────────────────────────────────────────────
  const blob    = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url     = URL.createObjectURL(blob)
  const a       = document.createElement('a')
  const dateStr = new Date().toISOString().slice(0, 10)
  const slug    = [cycleLabelStr, filterState !== 'All' ? filterState : null, repLabel !== 'All Reps' ? repLabel : null]
    .filter(Boolean).join('-').replace(/\s+/g, '-').toLowerCase()
  a.href        = url
  a.download    = `coverage-${slug}-${dateStr}.html`
  a.click()
  URL.revokeObjectURL(url)
}
