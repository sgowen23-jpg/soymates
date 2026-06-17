import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { CYCLE_STARTS, CYCLE_YEAR_MAP } from '../../constants'
import { exportCoverageHTML } from './exportHTML'
import './Coverage.css'

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri']

const REP_ORDER = [
  'David Kerr',
  'Shane Vandewardt',
  'Sam Gowen',
  'Dipen Surani',
  'Sean Cooper',
  'David Saleeb',
  'Ashleigh Tasdarian',
  'Azra Horell',
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

function repColor(rep) { return REP_COLORS[rep] || '#555' }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDS(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtDay(d) {
  return `${DAY_SHORT[d.getDay()-1]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function fmtDate(ds) {
  if (!ds) return '—'
  const [, m, d] = ds.split('-')
  return `${parseInt(d)} ${MONTHS[parseInt(m)-1]}`
}

function daysSince(ds) {
  if (!ds) return null
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.floor((today - new Date(ds + 'T00:00:00')) / 86400000)
}

function getCycleDates(cycle) {
  const start = new Date(CYCLE_STARTS[cycle] + 'T00:00:00')
  return Array.from({ length: 12 }, (_, w) =>
    Array.from({ length: 5 }, (_, d) => {
      const day = new Date(start)
      day.setDate(start.getDate() + w * 7 + d)
      return day
    })
  )
}

// Derives label from start date — matches exact string stored in store_visits.cycle
function cycleLabel(num) {
  const start = CYCLE_STARTS[num]
  if (!start) return `Cycle ${num}`
  return `${start.split('-')[0]} Cycle ${num}`
}

function weekOfCycle(dateStr, cycleStart) {
  const start = new Date(cycleStart + 'T00:00:00')
  const date  = new Date(dateStr + 'T00:00:00')
  return Math.floor((date - start) / 604800000) // 0-indexed
}

// ─── Day detail panel (shared by AvgDayView accordion) ───────────────────────
function DayDetailPanel({ ds, byDate, onClose }) {
  const visits = byDate[ds] || []
  const byRep  = {}
  visits.forEach(v => {
    if (!byRep[v.rep]) byRep[v.rep] = []
    byRep[v.rep].push(v)
  })
  return (
    <div className="cov-day-panel">
      <div className="cov-day-panel-hd">
        <strong>{fmtDate(ds)}</strong>
        <span className="cov-panel-count">{visits.length} visit{visits.length !== 1 ? 's' : ''}</span>
        <button className="cov-panel-close" onClick={onClose}>✕</button>
      </div>
      {visits.length === 0 && <p className="cov-empty">No visits on this day.</p>}
      <div className="cov-panel-reps">
        {Object.entries(byRep).sort(([a],[b]) => a.localeCompare(b)).map(([rep, vs]) => (
          <div key={rep} className="cov-panel-rep-group">
            <div className="cov-panel-rep-hd" style={{ borderLeftColor: repColor(rep) }}>
              <span className="cov-rep-dot" style={{ background: repColor(rep) }} />
              <strong>{rep}</strong>
              <span className="cov-panel-rep-count">{vs.length} visit{vs.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="cov-panel-visit-list">
              {vs.map(v => (
                <div key={v.schedule_id} className="cov-visit-row">
                  <span className="cov-visit-store">{v.store_name}</span>
                  <div className="cov-visit-meta">
                    {v.actual_duration > 0 && <span className="cov-visit-dur">{v.actual_duration}m</span>}
                    {v.schedule_state !== 'Successful' && <span className="cov-visit-state">{v.schedule_state}</span>}
                    {v.schedule_comment && <span className="cov-visit-comment" title={v.schedule_comment}>💬</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Cycle List View ──────────────────────────────────────────────────────────
function SortTh({ col, label, sortCol, sortAsc, onSort }) {
  const active = sortCol === col
  return (
    <th className={`cov-th cov-th-sort ${active ? 'cov-th-active' : ''}`}
      onClick={() => onSort(col)}>
      {label}{active ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )
}

function StoreListView({ stores, sortCol, sortAsc, onSort }) {
  const thProps = col => ({ col, sortCol, sortAsc, onSort })
  return (
    <div className="cov-list-wrap">
      <div className="cov-list-meta">{stores.length} stores visited this cycle</div>
      <div className="cov-table-scroll">
        <table className="cov-table">
          <thead>
            <tr>
              <SortTh label="Store"          {...thProps('store_name')}  />
              <SortTh label="State"          {...thProps('state')}       />
              <SortTh label="Visits"         {...thProps('visit_count')} />
              <SortTh label="First Visit"    {...thProps('first_visit')} />
              <SortTh label="Last Visit"     {...thProps('last_visit')}  />
              <SortTh label="Days Since Last" {...thProps('days_since')} />
            </tr>
          </thead>
          <tbody>
            {stores.map(s => {
              const ds = s.days_since
              const staleCls = ds == null ? '' : ds > 28 ? 'cov-stale-red' : ds > 14 ? 'cov-stale-orange' : 'cov-stale-green'
              return (
                <tr key={s.location_no ?? s.store_name} className="cov-tr">
                  <td className="cov-td cov-td-name">{s.store_name}</td>
                  <td className="cov-td cov-td-center">{s.state}</td>
                  <td className="cov-td cov-td-center cov-td-count">{s.visit_count}</td>
                  <td className="cov-td cov-td-center">{fmtDate(s.first_visit)}</td>
                  <td className="cov-td cov-td-center">{fmtDate(s.last_visit)}</td>
                  <td className={`cov-td cov-td-center ${staleCls}`}>
                    {ds != null ? `${ds}d` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Avg/Day View ────────────────────────────────────────────────────────────
function AvgDayView({ reps, data, max, weeks, repDayData, byDate }) {
  const [expandedRep,  setExpandedRep]  = useState(null)
  const [expandedWeek, setExpandedWeek] = useState(null)
  const [selectedDay,  setSelectedDay]  = useState(null)

  const maxAvg = max > 0 ? max / 5 : 1

  function activeDays(rep, week) {
    const days = repDayData?.[rep] || {}
    return week.filter(d => (days[toDS(d)] || 0) > 0).length
  }

  function toggleCell(rep, wi) {
    if (expandedRep === rep && expandedWeek === wi) {
      setExpandedRep(null); setExpandedWeek(null); setSelectedDay(null)
    } else {
      setExpandedRep(rep); setExpandedWeek(wi); setSelectedDay(null)
    }
  }

  // byDate filtered to just the expanded rep
  const repByDate = useMemo(() => {
    if (!expandedRep || !byDate) return {}
    const m = {}
    Object.entries(byDate).forEach(([ds, visits]) => {
      const filtered = visits.filter(v => v.rep === expandedRep)
      if (filtered.length) m[ds] = filtered
    })
    return m
  }, [expandedRep, byDate])

  function AccordionPanel({ rep, wi }) {
    const week      = weeks[wi]
    const repVisits = repByDate
    const total     = week.reduce((s, d) => s + (repVisits[toDS(d)]?.length || 0), 0)
    return (
      <div className="cov-week cov-accordion-week">
        <div className="cov-week-hd" style={{ cursor: 'pointer' }} onClick={() => toggleCell(rep, wi)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="cov-rep-dot" style={{ background: repColor(rep) }} />
            {rep.split(' ')[0]} · Week {wi + 1}
          </span>
          <span className="cov-week-range">{fmtDay(week[0])} – {fmtDay(week[4])}</span>
          {total > 0 && <span className="cov-week-total">{total} visits</span>}
          <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>▲ close</span>
        </div>
        <div className="cov-week-grid">
          {week.map(date => {
            const ds     = toDS(date)
            const visits = repVisits[ds] || []
            const sel    = selectedDay === ds
            return (
              <div key={ds}
                className={`cov-day cov-day-clickable ${visits.length > 0 ? 'cov-day-has-visits' : ''} ${sel ? 'cov-day-selected' : ''}`}
                onClick={() => setSelectedDay(prev => prev === ds ? null : ds)}>
                <div className="cov-day-hd">
                  <span className="cov-day-lbl">{fmtDay(date)}</span>
                  {visits.length > 0 && <span className="cov-day-badge">{visits.length}</span>}
                </div>
                {visits.length > 0
                  ? <div className="cov-week-chips">
                      {visits.map(v => (
                        <div key={v.schedule_id} className="cov-visit-chip" style={{ borderLeftColor: repColor(v.rep) }}>
                          <span className="cov-chip-store">{v.store_name}</span>
                          {v.actual_duration > 0 && <span className="cov-chip-dur">{v.actual_duration}m</span>}
                        </div>
                      ))}
                    </div>
                  : <span className="cov-day-empty">—</span>
                }
              </div>
            )
          })}
        </div>
        {selectedDay && <DayDetailPanel ds={selectedDay} byDate={repVisits} onClose={() => setSelectedDay(null)} />}
      </div>
    )
  }

  return (
    <div className="cov-heatmap-wrap">
      <p className="cov-heatmap-hint">
        Average visits per working day — tap a cell to drill into that rep's week.
      </p>

      {/* ── Desktop table ── */}
      <div className="cov-heatmap-scroll cov-avgday-desktop">
        <table className="cov-heatmap-table">
          <thead>
            <tr>
              <th className="cov-hm-rep-hd">Rep</th>
              {weeks.map((week, wi) => (
                <th key={wi} className="cov-hm-week-hd">
                  <div>W{wi + 1}</div>
                  <div className="cov-hm-week-date">{week[0].getDate()} {MONTHS[week[0].getMonth()]}</div>
                </th>
              ))}
              <th className="cov-hm-total-hd">Cycle avg/day</th>
            </tr>
          </thead>
          <tbody>
            {reps.map(rep => {
              const counts          = data[rep] || Array(12).fill(0)
              const totalVisits     = counts.reduce((a, b) => a + b, 0)
              const totalActiveDays = weeks.reduce((s, week) => s + activeDays(rep, week), 0)
              const cycleAvg        = totalActiveDays > 0 ? (totalVisits / totalActiveDays).toFixed(1) : '—'
              const isExpanded      = expandedRep === rep
              return (
                <>
                  <tr key={rep} className="cov-hm-row">
                    <td className="cov-hm-rep-cell">
                      <span className="cov-rep-dot" style={{ background: repColor(rep) }} />
                      <span className="cov-hm-rep-name">{rep.split(' ')[0]}</span>
                    </td>
                    {counts.map((count, wi) => {
                      const active    = activeDays(rep, weeks[wi])
                      const avg       = active > 0 ? count / active : 0
                      const intensity = maxAvg > 0 ? avg / maxAvg : 0
                      const isActive  = isExpanded && expandedWeek === wi
                      const bg        = isActive ? '#1a2b5e' : count === 0 ? '#f5f5f5' : `rgba(26,43,94,${(0.15 + intensity * 0.85).toFixed(2)})`
                      const color     = isActive || intensity > 0.55 ? '#fff' : '#1a1a1a'
                      return (
                        <td key={wi} className="cov-hm-cell cov-hm-week-btn" style={{ background: bg, color }}
                          title={`${rep} · Week ${wi + 1}: ${count} visits · ${avg.toFixed(1)}/day`}
                          onClick={() => toggleCell(rep, wi)}>
                          {count > 0 ? avg.toFixed(1) : ''}
                        </td>
                      )
                    })}
                    <td className="cov-hm-total-cell">{cycleAvg}</td>
                  </tr>
                  {isExpanded && expandedWeek !== null && (
                    <tr key={`${rep}-acc`}>
                      <td colSpan={weeks.length + 2} style={{ padding: '8px 0 4px', background: '#f8f9ff' }}>
                        <AccordionPanel rep={rep} wi={expandedWeek} />
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ── */}
      <div className="cov-avgday-mobile">
        {reps.map(rep => {
          const counts          = data[rep] || Array(12).fill(0)
          const totalVisits     = counts.reduce((a, b) => a + b, 0)
          const totalActiveDays = weeks.reduce((s, week) => s + activeDays(rep, week), 0)
          const cycleAvg        = totalActiveDays > 0 ? (totalVisits / totalActiveDays).toFixed(1) : '—'
          const isExpanded      = expandedRep === rep
          return (
            <div key={rep} className="cov-avgday-card">
              <div className="cov-avgday-card-hd">
                <span className="cov-rep-dot" style={{ background: repColor(rep) }} />
                <span className="cov-avgday-rep">{rep.split(' ')[0]}</span>
                <span className="cov-avgday-cycle">{cycleAvg}<span className="cov-avgday-unit"> /day</span></span>
              </div>
              <div className="cov-avgday-weeks">
                {counts.map((count, wi) => {
                  const active    = activeDays(rep, weeks[wi])
                  const avg       = active > 0 ? count / active : 0
                  const intensity = maxAvg > 0 ? avg / maxAvg : 0
                  const isActive  = isExpanded && expandedWeek === wi
                  const bg        = isActive ? '#1a2b5e' : count === 0 ? '#f0f0f0' : `rgba(26,43,94,${(0.15 + intensity * 0.85).toFixed(2)})`
                  const color     = isActive || intensity > 0.55 ? '#fff' : '#1a1a1a'
                  return (
                    <div key={wi} className="cov-avgday-week-cell" style={{ background: bg, color }}
                      onClick={() => toggleCell(rep, wi)}
                      title={`W${wi+1}: ${count} visits · ${avg.toFixed(1)}/day`}>
                      <div className="cov-avgday-wlbl">W{wi + 1}</div>
                      <div className="cov-avgday-wval">{count > 0 ? avg.toFixed(1) : '–'}</div>
                    </div>
                  )
                })}
              </div>
              {isExpanded && expandedWeek !== null && (
                <AccordionPanel rep={rep} wi={expandedWeek} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Coverage() {
  const [cycle, setCycle]       = useState(1)
  const [mainView, setMainView] = useState('cycle')   // 'cycle' | 'day' | 'week' | 'list'

  // Filters
  const [filterRep, setFilterRep]       = useState('All')
  const [filterState, setFilterState]   = useState('All')
  const [showAllStates, setShowAllStates] = useState(false)

  // Data
  const [visits, setVisits]   = useState([])
  const [loading, setLoading] = useState(true)

  // Cycle list sort — default: days_since desc (neglected stores float up)
  const [sortCol, setSortCol] = useState('days_since')
  const [sortAsc, setSortAsc] = useState(false)

  const weeks = useMemo(() => getCycleDates(cycle), [cycle])

  // Make page scrollable (same pattern as CyclePlanner)
  useEffect(() => {
    const mc = document.querySelector('.main-content')
    if (mc) mc.style.overflowY = 'auto'
    return () => { if (mc) mc.style.overflowY = '' }
  }, [])

  // Fetch visits for the selected cycle — paginated to avoid 1000-row PostgREST truncation
  useEffect(() => {
    setLoading(true)
    const label = cycleLabel(cycle)
    async function load() {
      let all = [], from = 0
      while (true) {
        const { data, error } = await supabase
          .from('store_visits')
          .select('schedule_id,location_no,store_name,state,rep,cycle,schedule_state,date_scheduled,actual_duration,schedule_comment,group_name')
          .eq('cycle', label)
          .range(from, from + 499)
        if (error || !data || data.length === 0) break
        all = [...all, ...data]
        if (data.length < 500) break
        from += 500
      }
      setVisits(all)
      setLoading(false)
    }
    load()
  }, [cycle])

  // Derive available reps and states from loaded data
  const allReps = useMemo(() => {
    const s = new Set(visits.map(v => v.rep).filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [visits])

  const allStates = useMemo(() => {
    const s = new Set(visits.map(v => v.state).filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [visits])

  // Apply filters
  const filtered = useMemo(() => visits.filter(v => {
    if (!showAllStates && v.schedule_state !== 'Successful') return false
    if (filterRep   !== 'All' && v.rep   !== filterRep)   return false
    if (filterState !== 'All' && v.state !== filterState) return false
    return true
  }), [visits, filterRep, filterState, showAllStates])

  // Index by date — used by both Day and Week views
  const byDate = useMemo(() => {
    const m = {}
    filtered.forEach(v => {
      if (!v.date_scheduled) return
      if (!m[v.date_scheduled]) m[v.date_scheduled] = []
      m[v.date_scheduled].push(v)
    })
    return m
  }, [filtered])

  // Cycle list — one row per unique store
  const storeList = useMemo(() => {
    const m = {}
    filtered.forEach(v => {
      const key = v.location_no ?? v.store_name
      if (!m[key]) m[key] = { store_name: v.store_name, state: v.state, location_no: v.location_no, dates: [] }
      if (v.date_scheduled) m[key].dates.push(v.date_scheduled)
    })
    return Object.values(m).map(s => {
      const sorted = [...s.dates].sort()
      const last   = sorted[sorted.length - 1]
      return { ...s, visit_count: s.dates.length, first_visit: sorted[0] || null, last_visit: last || null, days_since: daysSince(last) }
    })
  }, [filtered])

  const sortedStoreList = useMemo(() => [...storeList].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol]
    if (av == null) av = sortAsc ? Infinity : -Infinity
    if (bv == null) bv = sortAsc ? Infinity : -Infinity
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortAsc ? av - bv : bv - av
  }), [storeList, sortCol, sortAsc])

  function toggleSort(col) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }

  // Per-rep, per-day visit counts — used to count active days in avg denominator
  const repDayData = useMemo(() => {
    const m = {}
    filtered.forEach(v => {
      if (!v.rep || !v.date_scheduled) return
      if (!m[v.rep]) m[v.rep] = {}
      m[v.rep][v.date_scheduled] = (m[v.rep][v.date_scheduled] || 0) + 1
    })
    return m
  }, [filtered])

  // Heatmap — reps × 12 weeks
  const heatmapReps = useMemo(() => {
    if (filterRep !== 'All') return [filterRep]
    const s = new Set(filtered.map(v => v.rep).filter(Boolean))
    const inData = Array.from(s)
    return [
      ...REP_ORDER.filter(r => inData.includes(r)),
      ...inData.filter(r => !REP_ORDER.includes(r)).sort(),
    ]
  }, [filtered, filterRep])

  const heatmapData = useMemo(() => {
    const cycleStart = CYCLE_STARTS[cycle]
    const m = {}
    heatmapReps.forEach(r => { m[r] = Array(12).fill(0) })
    filtered.forEach(v => {
      if (!v.rep || !v.date_scheduled) return
      const w = weekOfCycle(v.date_scheduled, cycleStart)
      if (w >= 0 && w < 12 && m[v.rep]) m[v.rep][w]++
    })
    return m
  }, [filtered, heatmapReps, cycle])

  const heatmapMax = useMemo(() => {
    let max = 1
    Object.values(heatmapData).forEach(wks => wks.forEach(n => { if (n > max) max = n }))
    return max
  }, [heatmapData])

  return (
    <div className="cov-page">

      {/* ── Header ── */}
      <div className="cov-header">
        <div className="cov-header-row">
          <h1 className="cov-title">Coverage</h1>
          {!loading && (
            <span className="cov-total-badge">{filtered.length} visits</span>
          )}
          {!loading && filtered.length > 0 && (
            <button
              className="cp-export-btn"
              onClick={() => exportCoverageHTML({ filtered, weeks, cycleLabelStr: cycleLabel(cycle), filterRep, filterState, showAllStates })}
            >
              Export / Share
            </button>
          )}
        </div>

        <div className="cov-selectors">
          <div className="cov-field">
            <label className="cov-field-lbl">Cycle</label>
            <select className="cov-sel" value={cycle} onChange={e => setCycle(+e.target.value)}>
              {Object.keys(CYCLE_STARTS).map(c => (
                <option key={c} value={c}>{cycleLabel(+c)}</option>
              ))}
            </select>
          </div>
          <div className="cov-field">
            <label className="cov-field-lbl">Rep</label>
            <select className="cov-sel" value={filterRep} onChange={e => setFilterRep(e.target.value)}>
              {allReps.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="cov-field">
            <label className="cov-field-lbl">State</label>
            <select className="cov-sel" value={filterState} onChange={e => setFilterState(e.target.value)}>
              {allStates.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="cov-field">
            <label className="cov-field-lbl">Visit Status</label>
            <label className="cov-toggle-lbl">
              <input type="checkbox" checked={showAllStates}
                onChange={e => setShowAllStates(e.target.checked)} />
              <span>Show all states</span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Main view toggle ── */}
      <div className="cov-tab-bar">
        {[['cycle','Cycle'],['list','Ranked List']].map(([id, label]) => (
          <button key={id} className={`cov-tab ${mainView === id ? 'active' : ''}`}
            onClick={() => setMainView(id)}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="cov-loading">
          <div className="cov-spinner" />
          <p>Loading visits…</p>
        </div>
      )}

      {/* ── Cycle View ── */}
      {!loading && mainView === 'cycle' && (
        <AvgDayView
          reps={heatmapReps} data={heatmapData} max={heatmapMax} weeks={weeks} repDayData={repDayData} byDate={byDate}
        />
      )}

      {/* ── Ranked List View ── */}
      {!loading && mainView === 'list' && (
        <StoreListView
          stores={sortedStoreList}
          sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}
        />
      )}
    </div>
  )
}
