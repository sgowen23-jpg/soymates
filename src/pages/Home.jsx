import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CYCLE_NUMBER, CATEGORIES, getCategorySummary } from '../data/targets'
import { CYCLE_YEAR_MAP, REPS, REP_STATES, STATE_COLORS } from '../constants'
import { getProductCategory, loadProductMaster } from '../utils/productCategory'
import { useDataFreshness } from '../hooks/useDataFreshness'
import './Home.css'

// Cycle 1 starts March 30, 2026
const CYCLE_START = new Date('2026-03-30')
const CYCLE_WEEKS = 12

// Quick-action tiles across the top — real tab names.
const QUICK_ACTIONS = [
  { label: 'Promotions',     icon: '🏷️' },
  { label: 'Perfect Store',  icon: '🎯' },
  { label: 'Leave Calendar', icon: '📅' },
]

// Where a rep tile drills into. `page` navigates in-app; `href` opens externally.
const REP_TOOLS = [
  { label: 'Distribution',   icon: '📦', page: 'Distribution' },
  { label: 'Store Map',      icon: '🗺️', page: 'Store Map' },
  { label: 'Store Contacts', icon: '📇', page: 'Store Contacts' },
  { label: 'Cycle Planner',  icon: '📆', page: 'Cycle Planner' },
  { label: 'Order Sheets',   icon: '📝', href: '/vitasoy-aug26-order.html' },
]

function buildPieData(rows) {
  const buckets = {
    UHT:     { listed: 0, gap: 0, nbt: 0 },
    Chilled: { listed: 0, gap: 0, nbt: 0 },
    Yoghurt: { listed: 0, gap: 0, nbt: 0 },
  }
  rows.forEach(r => {
    const cat = getProductCategory(r.item_name, r.pog_category, r.item_id)
    let key
    if (cat === 'UHT' || cat === 'UHT Core') key = 'UHT'
    else if (cat === 'Fresh' || cat === 'RTD') key = 'Chilled'
    else if (cat === 'Yoghurt') key = 'Yoghurt'
    else return
    if (r.sum_of_ranging > 0) buckets[key].listed++
    else if (r.ranging_gap > 0) buckets[key].gap++
    else buckets[key].nbt++
  })
  const toSegments = b => {
    const total = b.listed + b.gap + b.nbt || 1
    return [
      { label: 'Listed', value: b.listed, pct: Math.round((b.listed / total) * 100), color: '#1a2b5e' },
      { label: 'Gap',    value: b.gap,    pct: Math.round((b.gap    / total) * 100), color: '#CC0000' },
      { label: 'NBT',    value: b.nbt,    pct: Math.round((b.nbt    / total) * 100), color: '#fb8c00' },
    ]
  }
  return [
    { label: 'Vitasoy UHT',     segments: toSegments(buckets.UHT)     },
    { label: 'Vitasoy Chilled', segments: toSegments(buckets.Chilled) },
    { label: 'Yoghurt',         segments: toSegments(buckets.Yoghurt) },
  ]
}

function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getCycleInfo() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(CYCLE_START)
  start.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { week: 0, label: 'Pre-Cycle', daysLeft: Math.abs(diffDays) }
  const week = Math.min(Math.floor(diffDays / 7) + 1, CYCLE_WEEKS)
  return { week, label: `Week ${week}`, daysLeft: null }
}

function formatDate(d) {
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtShort(str) {
  const [y, m, day] = str.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function PieChart({ segments, size = 80 }) {
  const r = size / 2 - 4
  const cx = size / 2
  const cy = size / 2
  const total = segments.reduce((a, s) => a + s.value, 0)
  let startAngle = -Math.PI / 2
  const paths = segments.map(seg => {
    const angle = (seg.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(startAngle + angle)
    const y2 = cy + r * Math.sin(startAngle + angle)
    const large = angle > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    startAngle += angle
    return { d, color: seg.color }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth="1.5" />
      ))}
    </svg>
  )
}

function initialsOf(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function Home({ onNavigate }) {
  const [leaveEntries, setLeaveEntries] = useState([])
  const [pieData,      setPieData]      = useState(null)
  const [drillRep,     setDrillRep]     = useState(null)  // rep object or {name:'Everyone'}
  const freshness = useDataFreshness()
  const today     = new Date()
  const todayStr  = toDateStr(today)
  const { week, label, daysLeft } = getCycleInfo()

  useEffect(() => {
    async function fetchPieData() {
      const masterReady = loadProductMaster()
      let all = [], from = 0
      while (true) {
        const { data } = await supabase
          .from('bnb_26wk')
          .select('item_id, item_name, pog_category, sum_of_ranging, ranging_gap')
          .eq('client', 'vitasoy')
          .range(from, from + 999)
        if (!data || data.length === 0) break
        all = [...all, ...data]
        if (data.length < 1000) break
        from += 1000
      }
      await masterReady
      if (all.length) setPieData(buildPieData(all))
    }
    fetchPieData()
  }, [])

  useEffect(() => {
    async function fetchLeave() {
      const { data } = await supabase
        .from('leave_entries')
        .select('rep_name, start_date, end_date, leave_type')
        .lte('start_date', todayStr)
        .gte('end_date',   todayStr)
      setLeaveEntries(data || [])
    }
    fetchLeave()
  }, [])

  function getRepLeave(rep) {
    return leaveEntries.filter(e => e.rep_name === rep)
  }
  function isOnLeave(rep) {
    return getRepLeave(rep).length > 0
  }
  function leaveTooltip(rep) {
    const entries = getRepLeave(rep)
    if (!entries.length) return 'Available today'
    return entries.map(e =>
      `${e.leave_type}: ${fmtShort(e.start_date)}${e.start_date !== e.end_date ? ' → ' + fmtShort(e.end_date) : ''}`
    ).join('\n')
  }

  // Open a rep's tools; `rep === null` means "Everyone" (no rep filter downstream).
  function openTool(tool) {
    if (tool.href) {
      window.open(tool.href, '_blank', 'noopener,noreferrer')
    } else {
      onNavigate(tool.page, drillRep?.name === 'Everyone' ? null : drillRep?.name)
    }
    setDrillRep(null)
  }

  const drillColor = drillRep && drillRep.name !== 'Everyone'
    ? STATE_COLORS[REP_STATES[drillRep.name]]?.c
    : '#6b7280'

  return (
    <div className="launcher">
      {/* Header */}
      <div className="lc-header">
        <div className="lc-date">{formatDate(today)}</div>
        <div className="lc-cycle-badge">
          {daysLeft != null
            ? `Cycle starts in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
            : `Cycle ${CYCLE_NUMBER} ${CYCLE_YEAR_MAP[CYCLE_NUMBER]} — ${label}`}
        </div>
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="lc-label">Quick actions</h2>
        <div className="lc-grid3">
          {QUICK_ACTIONS.map(a => (
            <button key={a.label} className="qa-tile" onClick={() => onNavigate(a.label)}>
              <span className="qa-icon">{a.icon}</span>
              <span className="qa-title">{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Reps */}
      <section>
        <h2 className="lc-label">Reps <span className="lc-hint">— tap a name to open their tools</span></h2>
        <div className="lc-grid3">
          {REPS.map(rep => {
            const state   = REP_STATES[rep]
            const colors  = STATE_COLORS[state] || { c: '#6b7280', border: 'var(--border)' }
            const onLeave = isOnLeave(rep)
            return (
              <button
                key={rep}
                className="rep-tile"
                style={{ '--rep-c': colors.c, '--rep-border': colors.border }}
                onClick={() => setDrillRep({ name: rep })}
                title={leaveTooltip(rep)}
              >
                <span className={`rep-dot ${onLeave ? 'off' : 'ok'}`} />
                <span className="rep-ini">{initialsOf(rep)}</span>
                <span className="rep-first">{rep.split(' ')[0]}</span>
                <span className="rep-state">{state}</span>
              </button>
            )
          })}
          <button
            className="rep-tile everyone"
            onClick={() => setDrillRep({ name: 'Everyone' })}
          >
            <span className="rep-ini">👥</span>
            <span className="rep-first">Everyone</span>
            <span className="rep-state">All reps</span>
          </button>
        </div>
      </section>

      {/* Cycle Progress */}
      <section className="lc-panel">
        <h2 className="lc-label">Cycle Progress — Cycle {CYCLE_NUMBER}</h2>
        <div className="cycle-progress-wrap">
          <div className="cycle-weeks">
            {Array.from({ length: CYCLE_WEEKS }, (_, i) => i + 1).map(w => (
              <div key={w} className={`cycle-week ${w < week ? 'done' : w === week ? 'current' : ''}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="cycle-bar-wrap">
            <div className="cycle-bar-fill" style={{ width: `${Math.max(0, (week - 1) / CYCLE_WEEKS * 100)}%` }} />
          </div>
          <div className="cycle-bar-label">
            {week === 0 ? 'Not started' : week > CYCLE_WEEKS ? 'Cycle complete' : `${week} of ${CYCLE_WEEKS} weeks`}
          </div>
        </div>
      </section>

      {/* Distribution Charts */}
      <section className="lc-panel">
        <h2 className="lc-label">
          Distribution Summary
          <span className="lc-hint"> — click to view details</span>
        </h2>
        {(freshness.bnb26 || freshness.bnb13 || freshness.dis) && (
          <p className="home-freshness">
            {freshness.dis   && <span>DIS: {freshness.dis}</span>}
            {freshness.bnb13 && <span>13wk: {freshness.bnb13}</span>}
            {freshness.bnb26 && <span>26wk: {freshness.bnb26}</span>}
          </p>
        )}
        <div className="pie-row">
          {(pieData || []).map(chart => (
            <button key={chart.label} className="pie-card" onClick={() => onNavigate('Distribution')} title="View Distribution">
              <PieChart segments={chart.segments} size={90} />
              <div className="pie-label">{chart.label}</div>
              <div className="pie-legend">
                {chart.segments.map(s => (
                  <div key={s.label} className="pie-legend-item">
                    <span className="pie-legend-dot" style={{ background: s.color }} />
                    <span>{s.label} {s.pct}%</span>
                  </div>
                ))}
              </div>
            </button>
          ))}
          {!pieData && <span className="lc-hint">Loading…</span>}
        </div>
      </section>

      {/* Targets */}
      <section className="lc-panel">
        <h2 className="lc-label">
          Distribution Targets — Cycle {CYCLE_NUMBER}
          <span className="lc-hint"> — click to view details</span>
        </h2>
        <div className="pie-row">
          {CATEGORIES.map(cat => {
            const s   = getCategorySummary(cat)
            const col = s.pct >= 85 ? '#16a085' : s.pct >= 65 ? '#e67e22' : '#CC0000'
            return (
              <button key={cat} className="pie-card" onClick={() => onNavigate('Targets')} title="View Targets">
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <PieChart
                    segments={[
                      { value: s.pct,       color: col      },
                      { value: 100 - s.pct, color: '#eee'   },
                    ]}
                    size={90}
                  />
                  <div className="pie-center-label">{s.pct}%</div>
                </div>
                <div className="pie-label">{cat}</div>
                <div className="pie-legend">
                  <div className="pie-legend-item">
                    <span className="pie-legend-dot" style={{ background: col }} />
                    <span>Achieved {s.current.toLocaleString()}</span>
                  </div>
                  <div className="pie-legend-item">
                    <span className="pie-legend-dot" style={{ background: '#eee', border: '1px solid #ddd' }} />
                    <span>Gap {s.gap.toLocaleString()}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Rep drill-down sheet */}
      {drillRep && (
        <div className="rep-scrim" onClick={e => { if (e.target === e.currentTarget) setDrillRep(null) }}>
          <div className="rep-sheet">
            <div className="rep-sheet-head">
              <div className="rep-sheet-badge" style={{ background: drillColor }}>
                {drillRep.name === 'Everyone' ? '👥' : initialsOf(drillRep.name)}
              </div>
              <div>
                <div className="rep-sheet-title">{drillRep.name}</div>
                <div className="rep-sheet-sub">Where to?</div>
              </div>
              <button className="rep-sheet-close" onClick={() => setDrillRep(null)} aria-label="Close">✕</button>
            </div>
            <div className="rep-sheet-grid">
              {REP_TOOLS.map(tool => (
                <button key={tool.label} className="rep-dest" onClick={() => openTool(tool)}>
                  <span className="rep-dest-icon">{tool.icon}</span>
                  <span className="rep-dest-label">{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
