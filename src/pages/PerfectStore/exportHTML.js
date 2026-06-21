import { CURRENT_CYCLE, CYCLE_STARTS } from '../../constants'

// ── Shared constants ──────────────────────────────────────────────────────────

const CLASS_COLORS = {
  'PERFECT STORE': '#2e7d32',
  'GROW':          '#0e7490',
  'DEVELOP':       '#e67e22',
  'EXPAND':        '#546e7a',
}

const COLS = [
  { label: 'State',            key: 'state',                 type: 'str' },
  { label: 'Location',         key: 'location',              type: 'str' },
  { label: 'Store ID',         key: 'store_id',              type: 'str' },
  { label: 'Store Name',       key: 'store_name',            type: 'str' },
  { label: 'Cluster',          key: 'cluster',               type: 'str' },
  { label: 'MSO',              key: 'mso',                   type: 'str' },
  { label: 'Banner',           key: 'banner',                type: 'str' },
  { label: 'Catalogue',        key: 'catalogue_format',      type: 'str' },
  { label: 'Classification',   key: 'classification',        type: 'str' },
  { label: 'Focus Store',      key: 'focus_store',           type: 'str' },
  { label: 'Distribution %',   key: 'distribution_pct',      type: 'num' },
  { label: 'Eligible?',        key: 'eligible',              type: 'str' },
  { label: 'UHT Core Gaps',    key: 'uht_core_gaps',         type: 'num' },
  { label: 'UHT NonCore Gaps', key: 'uht_noncore_gaps',      type: 'num' },
  { label: 'Chilled Opp',      key: 'chilled_opp',           type: 'num' },
  { label: 'RTD Opp',          key: 'rtd_opp',               type: 'num' },
  { label: 'Yoghurt Opp',      key: 'yoghurt_opp',           type: 'num' },
  { label: 'Total Opp',        key: 'total_opp',             type: 'num' },
  { label: 'Metcash Rank',     key: 'metcash_ranking',       type: 'num' },
  { label: 'Vitasoy Rank',     key: 'vitasoy_ranking',       type: 'num' },
  { label: 'Assumed Sales',    key: 'vitasoy_assumed_sales', type: 'num' },
  { label: 'GSV Potential',    key: 'gsv_potential',         type: 'num' },
  { label: 'UHT SOS',         key: 'uht_sos',               type: 'num' },
  { label: 'T/Up Previous',    key: 'tup_previous',          type: 'str' },
  { label: 'Call Freq Target', key: 'call_freq_target',      type: 'num' },
  { label: 'Actual Visits',    key: 'actual_visits',         type: 'num' },
]

const MONTHS_12    = ['APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC','JAN','FEB','MAR']
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December']
const TOPUP_TARGETS = [300,1300,1300,350,1350,1350,300,1350,1350,350,1350,1350]
const REPS         = ['Sam Gowen','Dipen Surani','Shane Vandewardt','David Kerr','NSW']

// ── Cycle helpers ─────────────────────────────────────────────────────────────

function getCycleMonthNums() {
  const start = new Date(CYCLE_STARTS[CURRENT_CYCLE] + 'T00:00:00')
  const sm    = start.getMonth()
  const first = start.getDate() > 15 ? (sm + 1) % 12 : sm
  return [first, (first + 1) % 12, (first + 2) % 12]
}

// ── Static tab: Metrics ───────────────────────────────────────────────────────

function metricsHTML(rules) {
  const ORDER = ['EXPAND', 'DEVELOP', 'GROW', 'PERFECT STORE']
  const FREQ_SUFFIX = { DEVELOP: ' (fortnightly)', GROW: ' (monthly)', 'PERFECT STORE': ' (monthly)' }
  const cards = ORDER.map(cls => {
    const rule  = rules[cls] ?? rules[Object.keys(rules).find(k => k.toUpperCase().trim() === cls)]
    const color = CLASS_COLORS[cls] ?? '#888'
    const freq  = rule?.call_freq != null
      ? `${rule.call_freq} calls${FREQ_SUFFIX[cls] ?? ''}`
      : '—'
    const t     = rule ? (rule.upgrade_threshold ?? rule.distribution_threshold ?? rule.min_distribution ?? null) : null
    const threshold = t != null ? `&gt;${(t * 100).toFixed(0)}%` : '—'
    const focus = rule?.strategic_focus ?? rule?.focus ?? rule?.target ?? rule?.notes ?? '—'
    return `<div class="m-card" style="border-top:4px solid ${color}">
      <span class="m-badge" style="background:${color}20;color:${color}">${cls}</span>
      <dl class="m-dl">
        <div class="m-row"><dt>Call frequency</dt><dd>${freq}</dd></div>
        <div class="m-row"><dt>Min. distribution</dt><dd>${threshold}</dd></div>
        <div class="m-row m-focus"><dt>Strategic focus</dt><dd>${focus}</dd></div>
      </dl>
    </div>`
  }).join('')
  return `<div class="tab-panel" id="tab-metrics">
    <p class="export-note">Classification rules — snapshot at export time.</p>
    <div class="m-grid">${cards}</div>
  </div>`
}

// ── Static tab: Scorecard ─────────────────────────────────────────────────────

function scorecardHTML(rows, cycleLabel) {
  const total      = rows.length
  const ps         = rows.filter(r => r.classification?.toUpperCase().trim() === 'PERFECT STORE').length
  const uhtCore    = rows.filter(r => r.uht_core_gaps    === 0).length
  const uhtNonCore = rows.filter(r => r.uht_noncore_gaps === 0).length
  const chilled    = rows.filter(r => r.chilled_opp      === 0).length
  const rtd        = rows.filter(r => r.rtd_opp          === 0).length
  const yoghurt    = rows.filter(r => r.yoghurt_opp      === 0).length
  const withDist   = rows.filter(r => r.distribution_pct != null)
  const avgDist    = withDist.length
    ? withDist.reduce((s, r) => s + r.distribution_pct, 0) / withDist.length
    : null

  const P  = (reason) => `<span class="sc-pending">— <span class="sc-note">${reason}</span></span>`
  const PM = P('Pending movement tracking')
  const PV = P('Pending visit-history join')
  const PS = P('SOS data manual/incomplete')
  const PP = P('Not in data')

  function scRow(label, value) {
    return `<tr><td class="sc-label">${label}</td><td class="sc-value">${value}</td></tr>`
  }
  function scSection(title) {
    return `<tr class="sc-section"><td colspan="2">${title}</td></tr>`
  }

  const body = [
    scSection('Store counts'),
    scRow('No of stores (total)', total),
    scRow('No of Perfect Stores', `${ps} <span class="sc-note">per current classification (definition under review)</span>`),
    scRow('No of stores called', PV),
    scSection('Ranging'),
    scRow('Stores ranging UHT Core',     uhtCore),
    scRow('&nbsp;&nbsp;↳ cycle-over-cycle change', PM),
    scRow('Stores ranging UHT Non-Core', uhtNonCore),
    scRow('&nbsp;&nbsp;↳ cycle-over-cycle change', PM),
    scRow('Stores ranging Chilled',      chilled),
    scRow('&nbsp;&nbsp;↳ cycle-over-cycle change', PM),
    scRow('Stores ranging RTD',          rtd),
    scRow('&nbsp;&nbsp;↳ cycle-over-cycle change', PM),
    scRow('Stores ranging Yoghurt',      yoghurt),
    scRow('&nbsp;&nbsp;↳ cycle-over-cycle change', PM),
    scSection('Distribution'),
    scRow('Overall distribution % (avg)', avgDist != null ? `${(avgDist * 100).toFixed(1)}%` : '—'),
    scRow('&nbsp;&nbsp;↳ cycle-over-cycle change', PM),
    scSection('In-store execution'),
    scRow('SOS &gt; 30% (count)',    PS),
    scRow('Planograms compliant', PP),
  ].join('')

  return `<div class="tab-panel" id="tab-scorecard">
    <p class="export-note">${cycleLabel}</p>
    <table class="sc-table">
      <thead><tr><th>Metric</th><th style="text-align:right;width:200px">Current cycle</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`
}

// ── Static tab: Team Activity ─────────────────────────────────────────────────

function svgChart(data, caption) {
  const PL=42, PR=12, PT=12, PB=48, W=680, H=180
  const iW = W-PL-PR, iH = H-PT-PB
  const maxTarget = Math.max(...data.map(d => d.target ?? 0), 1)
  const mag  = Math.pow(10, Math.floor(Math.log10(maxTarget)))
  const maxY = Math.ceil(maxTarget / mag) * mag
  const gW = iW / data.length
  const bW = Math.max(4, gW * 0.28)
  const gap = Math.max(2, gW * 0.06)
  const ys  = v => iH - (v / maxY) * iH
  let s = ''
  // gridlines
  ;[0, 0.25, 0.5, 0.75, 1].forEach(f => {
    const y = PT + ys(f * maxY)
    const lbl = Math.round(f * maxY).toLocaleString()
    s += `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W-PR}" y2="${y.toFixed(1)}" stroke="#e8e8e8" stroke-width="1"/>`
    s += `<text x="${PL-5}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="9" fill="#bbb">${lbl}</text>`
  })
  // bars
  data.forEach((d, i) => {
    const cx = PL + i * gW + gW / 2
    const tH  = Math.max(0, (d.target / maxY) * iH)
    const tx  = cx - gap / 2 - bW
    s += `<rect x="${tx.toFixed(1)}" y="${(PT+ys(d.target)).toFixed(1)}" width="${bW.toFixed(1)}" height="${tH.toFixed(1)}" fill="#d0d5db" rx="1"/>`
    s += `<text x="${cx.toFixed(1)}" y="${(H-PB+14).toFixed(1)}" text-anchor="middle" font-size="9" fill="#aaa">${d.label}</text>`
  })
  // legend
  s += `<rect x="${PL}" y="${H-PB+22}" width="8" height="8" fill="#d0d5db" rx="1"/>
        <text x="${PL+11}" y="${H-PB+29}" font-size="9" fill="#aaa">Target</text>
        <rect x="${PL+52}" y="${H-PB+22}" width="8" height="8" fill="#CC0000" rx="1"/>
        <text x="${PL+63}" y="${H-PB+29}" font-size="9" fill="#aaa">Actual</text>`
  return `<div class="chart-wrap">
    <svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;max-width:680px;height:auto">${s}</svg>
    ${caption ? `<p class="chart-caption">${caption}</p>` : ''}
  </div>`
}

function gridTable(gridRows) {
  const head = `<tr><th class="g-lh"></th>${MONTHS_12.map(m => `<th class="g-mh">${m}</th>`).join('')}</tr>`
  const body = gridRows.map(r => {
    const cls   = r.isTarget ? 'g-target' : ''
    const cells = MONTHS_12.map((_, j) => {
      const v = r.values[j]
      return `<td class="g-cell">${v != null ? v : '<span style="color:#ccc">—</span>'}</td>`
    }).join('')
    return `<tr class="${cls}"><td class="g-label">${r.label}</td>${cells}</tr>`
  }).join('')
  return `<div class="g-wrap"><table class="g-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`
}

function teamActivityHTML(rows, visitMonthCounts, cycleLabel) {
  const cycleMonthNums   = getCycleMonthNums()
  const cycleMonthLabels = cycleMonthNums.map(m => MONTH_NAMES[m])
  const visitsByCol      = cycleMonthNums.map(m => visitMonthCounts[m] ?? 0)
  const drakes = rows.filter(r => r.banner?.toLowerCase().includes('drakes')).length
  const cc = {
    total:   rows.length,
    ps:      rows.filter(r => r.classification?.toUpperCase().trim() === 'PERFECT STORE').length,
    grow:    rows.filter(r => r.classification?.toUpperCase().trim() === 'GROW').length,
    develop: rows.filter(r => r.classification?.toUpperCase().trim() === 'DEVELOP').length,
    expand:  rows.filter(r => r.classification?.toUpperCase().trim() === 'EXPAND').length,
    drakes,
  }
  const PM = `<span style="color:#aaa">— <span style="font-size:11px;font-style:italic;color:#ccc">Pending movement tracking</span></span>`
  const PS = `<span style="color:#aaa">— <span style="font-size:11px;font-style:italic;color:#ccc">Not tracked in system</span></span>`

  // Section 1 — 4-column activity table
  function actRow(label, vals) {
    return `<tr><td class="sc-label">${label}</td>${vals.map(v => `<td class="sc-value">${v}</td>`).join('')}</tr>`
  }
  function actSection(title, colCount) {
    return `<tr class="sc-section"><td colspan="${colCount + 1}">${title}</td></tr>`
  }
  const colCount = 3
  const actHead = `<tr><th>Metric</th>${cycleMonthLabels.map(m => `<th style="text-align:right;width:120px">${m}</th>`).join('')}</tr>`
  const actBody = [
    actSection('Store visits', colCount),
    actRow('Total store visits', visitsByCol),
    actSection('Ranging activity', colCount),
    ...['UHT Core gaps closed','UHT Non-Core gaps closed','Chilled gaps closed','Yoghurt gaps closed']
      .map(l => actRow(l, Array(colCount).fill(PM))),
    actSection('In-store execution', colCount),
    ...['Total POGs','Additional facings','Top-up stores','Top-up volume','Orders placed','Stores activity achieved','Strike rate']
      .map(l => actRow(l, Array(colCount).fill(PS))),
  ].join('')
  const section1 = `<div class="ta-sec"><div class="ta-sec-title">Activity summary</div>
    <table class="sc-table"><thead>${actHead}</thead><tbody>${actBody}</tbody></table></div>`

  // Section 2 — classification counts
  function s2row(label, val, note) {
    return `<tr><td class="sc-label">${label}${note ? ` <span class="sc-note">${note}</span>` : ''}</td><td class="sc-value">${val}</td></tr>`
  }
  const section2 = `<div class="ta-sec"><div class="ta-sec-title">Stores by classification</div>
    <table class="sc-table">
      <thead><tr><th>Classification</th><th style="text-align:right;width:140px">Store count</th></tr></thead>
      <tbody>
        ${s2row('Total stores', cc.total)}
        ${s2row('Perfect Store', cc.ps, '(definition under review)')}
        ${s2row('Grow', cc.grow)}
        ${s2row('Develop', cc.develop)}
        ${s2row('Expand', cc.expand)}
        ${s2row('Drakes', cc.drakes)}
      </tbody>
    </table></div>`

  // Section 3 — Planograms
  const section3 = `<div class="ta-sec"><div class="ta-sec-title">Planograms forecast vs actual</div>
    ${gridTable([
      { label: 'Target / no of planograms', isTarget: true,  values: MONTHS_12.map(() => 20) },
      { label: 'Planograms completed',       isTarget: false, values: MONTHS_12.map(() => null) },
    ])}
    ${svgChart(MONTHS_12.map(m => ({ label: m, target: 20 })), 'Actuals will populate once planogram tracking is added.')}
  </div>`

  // Section 4 — Top-up volume
  const section4 = `<div class="ta-sec"><div class="ta-sec-title">Top-up volume forecast vs actual</div>
    ${gridTable([
      { label: 'Target volume / cartons', isTarget: true,  values: TOPUP_TARGETS },
      { label: 'Actual volume',           isTarget: false, values: MONTHS_12.map(() => null) },
      { label: 'Off locations / no of',   isTarget: false, values: MONTHS_12.map(() => null) },
    ])}
    ${svgChart(MONTHS_12.map((m, i) => ({ label: m, target: TOPUP_TARGETS[i] })), 'Actuals will populate once top-up volume tracking is added.')}
  </div>`

  // Section 5 — EDI Orders
  const section5 = `<div class="ta-sec"><div class="ta-sec-title">EDI orders by rep</div>
    ${gridTable(REPS.map(rep => ({ label: rep, isTarget: false, values: MONTHS_12.map(() => null) })))}
  </div>`

  // Section 6 — EDI GSV
  const section6 = `<div class="ta-sec"><div class="ta-sec-title">EDI order GSV value by rep</div>
    ${gridTable(REPS.map(rep => ({ label: rep, isTarget: false, values: MONTHS_12.map(() => null) })))}
  </div>`

  return `<div class="tab-panel" id="tab-activity">
    <p class="export-note">${cycleLabel} — successful visits only</p>
    ${section1}${section2}${section3}${section4}${section5}${section6}
  </div>`
}

// ── Main export ───────────────────────────────────────────────────────────────

export function exportPerfectStoreHTML({ rows, rules, visitMonthCounts, cycleLabel, cycleRange }) {
  const exportedAt = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  // Pre-build static tab HTML (done in JS before download)
  const metricsTab   = metricsHTML(rules)
  const scorecardTab = scorecardHTML(rows, cycleLabel)
  const activityTab  = teamActivityHTML(rows, visitMonthCounts, cycleLabel)

  // Embed data for interactive Stores tab
  const dataJson = JSON.stringify(rows)

  // Build unique option lists for filter dropdowns
  const stateOpts  = ['All', ...[...new Set(rows.map(r => r.state).filter(Boolean))].sort()]
  const classOpts  = ['All', ...[...new Set(rows.map(r => r.classification).filter(Boolean))].sort()]

  const stateOptsHtml = stateOpts.map(v => `<option>${v}</option>`).join('')
  const classOptsHtml = classOpts.map(v => `<option>${v}</option>`).join('')

  // COLS as JSON for inline JS (type info needed for sort)
  const colsJson = JSON.stringify(COLS.map(c => ({ label: c.label, key: c.key, type: c.type })))

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Perfect Store — ${cycleLabel}</title>
<style>
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1a1a1a; margin: 0; background: #f5f5f0; }

/* ── Layout ── */
.page { display: flex; flex-direction: column; height: 100vh; }
.ps-header { padding: 16px 24px 0; }
.ps-header h2 { font-size: 18px; font-weight: 700; margin: 0 0 2px; }
.ps-header p  { font-size: 12px; color: #888; margin: 0; }

/* ── Tab bar ── */
.tab-bar { display: flex; gap: 4px; padding: 12px 24px 0; border-bottom: 2px solid #f0f0f0; background: #f5f5f0; }
.tab-btn { padding: 8px 18px; background: none; border: none; border-bottom: 2px solid transparent;
           margin-bottom: -2px; font-size: 13px; font-weight: 500; color: #888; cursor: pointer; }
.tab-btn:hover { color: #1a1a1a; }
.tab-btn.active { color: #CC0000; border-bottom-color: #CC0000; }

/* ── Scroll area ── */
.tab-scroll { flex: 1; overflow: auto; padding: 16px 24px 24px; }

/* ── Stores tab ── */
.filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.filters select, .filters input { padding: 6px 10px; border: 1px solid #ddd; border-radius: 8px;
                                   background: #fff; font-size: 13px; color: #1a1a1a; }
.filters input { min-width: 180px; flex: 1; }
.store-count { font-size: 12px; color: #888; margin-bottom: 10px; }

.tbl-wrap { overflow-x: auto; border-radius: 10px; box-shadow: 0 1px 6px rgba(0,0,0,.07); background:#fff; }
table.stores { border-collapse: collapse; font-size: 12px; white-space: nowrap; width: 100%; }
table.stores thead { position: sticky; top: 0; z-index: 2; }
table.stores th { background: #f8f8f8; color: #555; font-weight: 600; font-size: 11px;
                   text-align: left; padding: 8px 10px; border-bottom: 1px solid #e8e8e8;
                   cursor: pointer; user-select: none; }
table.stores th:hover { background: #f0f0f0; }
table.stores td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
table.stores tr:hover td { background: #fff8f8; }
table.stores tr:last-child td { border-bottom: none; }
.arrow { margin-left: 4px; font-size: 10px; color: #ccc; }
.arrow.on { color: #CC0000; }

/* ── Metrics tab ── */
.tab-panel { padding: 4px 0; }
.m-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; }
.m-card { background:#fff; border-radius:10px; box-shadow:0 1px 6px rgba(0,0,0,.07); padding:20px 22px; }
.m-badge { display:inline-block; padding:3px 10px; border-radius:10px; font-size:11px; font-weight:700;
           letter-spacing:.03em; margin-bottom:16px; }
.m-dl { margin:0; display:flex; flex-direction:column; gap:10px; }
.m-row { display:flex; justify-content:space-between; align-items:baseline; gap:12px; font-size:13px; }
.m-row dt { color:#888; font-weight:400; flex-shrink:0; }
.m-row dd { margin:0; color:#1a1a1a; font-weight:500; text-align:right; }
.m-focus { flex-direction:column; align-items:flex-start; gap:4px; }
.m-focus dd { text-align:left; font-weight:400; color:#444; font-size:12px; line-height:1.5; }

/* ── Scorecard / Team Activity shared ── */
.sc-table { width:100%; border-collapse:collapse; font-size:13px; background:#fff;
            border-radius:10px; box-shadow:0 1px 6px rgba(0,0,0,.07); overflow:hidden; margin-bottom:16px; }
.sc-table th { background:#f8f8f8; color:#555; font-weight:600; font-size:12px; padding:9px 14px;
               border-bottom:1px solid #e8e8e8; text-align:left; }
.sc-section td { background:#f3f3f3; color:#888; font-size:11px; font-weight:700; text-transform:uppercase;
                 letter-spacing:.06em; padding:7px 14px; border-top:1px solid #e8e8e8; border-bottom:1px solid #e8e8e8; }
.sc-label { padding:9px 14px; color:#1a1a1a; border-bottom:1px solid #f0f0f0; }
.sc-value { padding:9px 14px; text-align:right; font-weight:600; color:#1a1a1a; border-bottom:1px solid #f0f0f0; white-space:nowrap; }
.sc-pending { font-weight:400; color:#aaa; }
.sc-note { font-size:11px; font-style:italic; color:#ccc; font-weight:400; }

/* ── Team Activity extras ── */
.ta-sec { margin-bottom:28px; }
.ta-sec-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
                color:#888; margin-bottom:8px; }
.g-wrap { overflow-x:auto; border-radius:10px; box-shadow:0 1px 6px rgba(0,0,0,.07); background:#fff; margin-bottom:10px; }
.g-table { border-collapse:collapse; font-size:12px; white-space:nowrap; min-width:860px; width:100%; }
.g-lh { background:#f8f8f8; color:#555; font-weight:600; font-size:12px; padding:9px 14px;
         border-bottom:1px solid #e8e8e8; text-align:left; min-width:200px;
         position:sticky; left:0; z-index:3; }
.g-mh { background:#f8f8f8; color:#555; font-weight:600; font-size:11px; padding:9px 10px;
         border-bottom:1px solid #e8e8e8; text-align:right; width:60px; }
.g-label { padding:9px 14px; color:#1a1a1a; border-bottom:1px solid #f0f0f0; font-weight:500;
            position:sticky; left:0; z-index:2; background:#fff; }
.g-cell  { padding:9px 10px; text-align:right; border-bottom:1px solid #f0f0f0; color:#1a1a1a; }
.g-target .g-label, .g-target .g-cell { color:#888; font-weight:400; font-size:11px; background:#fafafa; }
.g-target .g-label { background:#fafafa; }
.g-table tr:last-child td { border-bottom:none; }
.chart-wrap { background:#fff; border-radius:10px; box-shadow:0 1px 6px rgba(0,0,0,.07); padding:14px 16px 8px; }
.chart-caption { font-size:11px; color:#ccc; font-style:italic; margin:6px 0 0; }

/* ── Shared misc ── */
.export-note { font-size:12px; color:#aaa; margin:0 0 14px; font-weight:500; text-transform:uppercase; letter-spacing:.05em; }
</style>
</head>
<body>
<div class="page">
  <div class="ps-header">
    <h2>Perfect Store — ${cycleLabel}</h2>
    <p>${cycleRange} · Exported ${exportedAt} · ${rows.length.toLocaleString()} stores</p>
  </div>

  <div class="tab-bar">
    <button class="tab-btn active" onclick="showTab('stores',this)">Stores</button>
    <button class="tab-btn" onclick="showTab('metrics',this)">Metrics</button>
    <button class="tab-btn" onclick="showTab('scorecard',this)">Scorecard</button>
    <button class="tab-btn" onclick="showTab('activity',this)">Team Activity</button>
  </div>

  <div class="tab-scroll">

    <!-- ── Stores tab ── -->
    <div id="tab-stores">
      <div class="filters">
        <select id="f-state" onchange="onStateChange()"><option>All</option>${stateOptsHtml}</select>
        <select id="f-location" onchange="applyFilters()"><option>All</option></select>
        <select id="f-class" onchange="applyFilters()">${classOptsHtml}</select>
        <input id="f-search" type="text" placeholder="Search store…" oninput="applyFilters()">
      </div>
      <div class="store-count" id="store-count">${rows.length.toLocaleString()} stores</div>
      <div class="tbl-wrap">
        <table class="stores" id="stores-table">
          <thead><tr id="stores-head"></tr></thead>
          <tbody id="stores-body"></tbody>
        </table>
      </div>
    </div>

    <!-- ── Static tabs ── -->
    ${metricsTab}
    ${scorecardTab}
    ${activityTab}

  </div><!-- /tab-scroll -->
</div><!-- /page -->

<script>
// ── Embedded data ────────────────────────────────────────────────────────────
const DATA = ${dataJson};
const COLS = ${colsJson};
const CLASS_COLORS = ${JSON.stringify(CLASS_COLORS)};

// ── Tab switching ─────────────────────────────────────────────────────────────
function showTab(id, btn) {
  document.querySelectorAll('.tab-panel, #tab-stores').forEach(el => el.style.display = 'none');
  document.getElementById('tab-' + id).style.display = '';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
// Hide non-Stores panels on load
document.querySelectorAll('.tab-panel').forEach(el => el.style.display = 'none');

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtPct(v)  { return v == null ? '—' : (v * 100).toFixed(1) + '%'; }
function fmtSos(v)  {
  if (v == null || v === '') return '—';
  var n = parseFloat(v);
  return isNaN(n) ? String(v) : (n * 100).toFixed(1) + '%';
}
function fmtCurrency(v) {
  if (v == null) return '—';
  return '$' + Number(v).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function cellHtml(r, key) {
  if (key === 'eligible') {
    var val = r.eligible;
    if (!val) return '';
    return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#e67e2220;color:#e67e22;white-space:nowrap">' + val + '</span>';
  }
  if (key === 'call_freq_target') {
    var stored = r.call_freq_target, derived = r._rule_call_freq != null ? r._rule_call_freq : null;
    var mismatch = derived != null && stored != null && derived !== stored;
    var display = derived != null ? derived : (stored != null ? stored : '—');
    return mismatch ? display + ' <span style="color:#e67e22" title="Stored (' + stored + ') differs from rulebook">⚠</span>' : String(display);
  }
  if (key === 'classification') {
    var val = r.classification;
    if (!val) return '<span style="color:#888">—</span>';
    var color = CLASS_COLORS[val.toUpperCase().trim()] || '#888';
    return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:' + color + '20;color:' + color + ';white-space:nowrap">' + val + '</span>';
  }
  if (key === 'total_opp') {
    var v = r.total_opp; return '<span style="font-weight:600;color:#CC0000">' + (v == null ? '—' : v) + '</span>';
  }
  if (key === 'actual_visits') {
    var actual = r.actual_visits != null ? r.actual_visits : 0, target = r.call_freq_target;
    if (!target) return '<span style="color:#888">' + actual + '</span>';
    var ratio = actual / target;
    var color = ratio >= 1 ? '#2e7d32' : ratio >= 0.5 ? '#e67e22' : '#b71c1c';
    return '<span style="font-weight:600;color:' + color + '">' + actual + '</span>';
  }
  if (key === 'distribution_pct') return fmtPct(r[key]);
  if (key === 'vitasoy_assumed_sales' || key === 'gsv_potential') return fmtCurrency(r[key]);
  if (key === 'uht_sos') return fmtSos(r[key]);
  var v = r[key]; return v == null ? '—' : String(v);
}

// ── Sort state ────────────────────────────────────────────────────────────────
var sortCol = null, sortDir = 'asc';

function sortRows(arr) {
  if (!sortCol) return arr;
  var col = COLS.find(c => c.key === sortCol);
  var mult = sortDir === 'asc' ? 1 : -1;
  return arr.slice().sort(function(a, b) {
    var av = a[sortCol], bv = b[sortCol];
    if (col && col.type === 'num') {
      if (sortCol === 'uht_sos') { av = parseFloat(av); bv = parseFloat(bv); }
      av = av != null ? av : -Infinity;
      bv = bv != null ? bv : -Infinity;
      return (av - bv) * mult;
    }
    av = (av != null ? av : '').toString().toLowerCase();
    bv = (bv != null ? bv : '').toString().toLowerCase();
    return av < bv ? -mult : av > bv ? mult : 0;
  });
}

function handleSort(key) {
  if (sortCol === key) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
  else { sortCol = key; sortDir = 'asc'; }
  document.querySelectorAll('th[data-key] .arrow').forEach(function(el) {
    var k = el.parentElement.dataset.key;
    el.textContent = k === sortCol ? (sortDir === 'asc' ? '↑' : '↓') : '↕';
    el.className = 'arrow' + (k === sortCol ? ' on' : '');
  });
  applyFilters();
}

// ── Build header once ─────────────────────────────────────────────────────────
(function buildHeader() {
  var head = document.getElementById('stores-head');
  head.innerHTML = COLS.map(function(c) {
    return '<th data-key="' + c.key + '" onclick="handleSort(\\'' + c.key + '\\')">'
      + c.label + '<span class="arrow">↕</span></th>';
  }).join('');
})();

// ── Filter logic ──────────────────────────────────────────────────────────────
function applyFilters() {
  var state = document.getElementById('f-state').value;
  var loc   = document.getElementById('f-location').value;
  var cls   = document.getElementById('f-class').value;
  var q     = document.getElementById('f-search').value.toLowerCase();

  var filtered = DATA.filter(function(r) {
    if (state !== 'All' && r.state !== state) return false;
    if (loc   !== 'All' && r.location !== loc) return false;
    if (cls   !== 'All' && r.classification !== cls) return false;
    if (q && !(r.store_name || '').toLowerCase().includes(q)) return false;
    return true;
  });

  var sorted = sortRows(filtered);

  document.getElementById('store-count').textContent =
    filtered.length.toLocaleString() + ' of ' + DATA.length.toLocaleString() + ' stores';

  document.getElementById('stores-body').innerHTML = sorted.map(function(r) {
    return '<tr>' + COLS.map(function(c) { return '<td>' + cellHtml(r, c.key) + '</td>'; }).join('') + '</tr>';
  }).join('');
}

function onStateChange() {
  var state = document.getElementById('f-state').value;
  var source = state === 'All' ? DATA : DATA.filter(function(r) { return r.state === state; });
  var locs = ['All'].concat([...new Set(source.map(function(r) { return r.location; }).filter(Boolean))].sort());
  document.getElementById('f-location').innerHTML = locs.map(function(l) { return '<option>' + l + '</option>'; }).join('');
  applyFilters();
}

// Initial render
applyFilters();
<\/script>
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
