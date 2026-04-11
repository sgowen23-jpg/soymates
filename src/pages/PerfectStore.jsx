import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { CURRENT_CYCLE, CYCLE_YEAR_MAP } from '../constants'
import './PerfectStore.css'

const FocusStores = lazy(() => import('./FocusStores'))

// ─── Constants ────────────────────────────────────────────────────────────────
const STRATEGY_META = {
  'PERFECT STORE': { color: '#16a085', bg: '#e8f8f5', icon: '🏆', order: 0 },
  'DEVELOP':       { color: '#2980b9', bg: '#ebf5fb', icon: '🔧', order: 1 },
  'GROW':          { color: '#e67e22', bg: '#fef9e7', icon: '📈', order: 2 },
  'EXPAND':        { color: '#8e44ad', bg: '#f5eef8', icon: '🟣', order: 3 },
  'CLOSED':        { color: '#999',    bg: '#f4f6f7', icon: '🚫', order: 4 },
}

const KPI_DEFS = [
  { key: 'uht_core',   label: 'UHT Core',     target: 8,  max: 8,  color: '#1a2b5e' },
  { key: 'uht_noncore',label: 'UHT Non-Core', target: 5,  max: 5,  color: '#2980b9' },
  { key: 'chilled',    label: 'Chilled',       target: 5,  max: 9,  color: '#16a085' },
  { key: 'rtd',        label: 'RTD',           target: 1,  max: 2,  color: '#8e44ad' },
  { key: 'yoghurt',    label: 'Yoghurt',       target: 1,  max: 4,  color: '#e67e22' },
]

const STATES = ['All States', 'New South Wales', 'Queensland', 'South Australia', 'Victoria', 'Western Australia']
const STATE_SHORT = { 'New South Wales': 'NSW', 'Queensland': 'QLD', 'South Australia': 'SA', 'Victoria': 'VIC', 'Western Australia': 'WA' }

// ─── PS Builder constants ─────────────────────────────────────────────────────
const PSB_REPS = ['Ashleigh Tasdarian', 'Shane Vandewardt', 'David Kerr', 'Sam Gowen', 'Dipen Surani', 'Azra Horell']

const PS_REP_STATES = {
  'Sam Gowen':          ['South Australia'],
  'Dipen Surani':       ['Western Australia'],
  'Ashleigh Tasdarian': ['New South Wales'],
  'David Kerr':         ['Queensland'],
  'Shane Vandewardt':   ['Victoria'],
  'Azra Horell':        ['Victoria'],
}

function kpiColor(val, target) {
  if (val == null) return '#ddd'
  if (val >= target) return '#16a085'
  if (val >= target * 0.6) return '#e67e22'
  return '#CC0000'
}

function pct(val, max) {
  if (val == null || max === 0) return 0
  return Math.min(100, Math.round((val / max) * 100))
}

function strategyMeta(s) {
  if (!s) return STRATEGY_META['EXPAND']
  const k = Object.keys(STRATEGY_META).find(k => s.toUpperCase().includes(k))
  return STRATEGY_META[k] || STRATEGY_META['EXPAND']
}

// ─── KPI Bar ─────────────────────────────────────────────────────────────────
function KpiBar({ kpi, val }) {
  const p = pct(val, kpi.max)
  const col = kpiColor(val, kpi.target)
  return (
    <div className="kpi-bar-row">
      <div className="kpi-bar-label">
        <span>{kpi.label}</span>
        <span className="kpi-bar-val" style={{ color: col }}>
          {val ?? '—'}<span className="kpi-bar-target">/{kpi.max}</span>
        </span>
      </div>
      <div className="kpi-bar-track">
        <div className="kpi-bar-fill" style={{ width: `${p}%`, background: col }} />
        <div className="kpi-bar-target-line" style={{ left: `${pct(kpi.target, kpi.max)}%` }} />
      </div>
    </div>
  )
}

// ─── Store Detail Panel ───────────────────────────────────────────────────────
function StorePanel({ store, onClose }) {
  if (!store) return null
  const sm = strategyMeta(store.strategy_c4)
  const totalTarget = 20
  const totalPct = pct(store.total_ranging, 28)
  const totalCol = kpiColor(store.total_ranging, totalTarget)

  return (
    <div className="ps-panel">
      {/* Header */}
      <div className="ps-panel-head" style={{ borderBottom: `4px solid ${sm.color}` }}>
        <div className="ps-panel-head-top">
          <div>
            <div className="ps-panel-store-name">{store.store_name}</div>
            <div className="ps-panel-store-meta">
              {STATE_SHORT[store.state] || store.state}
              {store.cluster ? ` · ${store.cluster}` : ''}
              {store.location_type ? ` · ${store.location_type}` : ''}
            </div>
          </div>
          <button className="ps-panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="ps-panel-badges">
          <span className="ps-strategy-badge" style={{ background: sm.bg, color: sm.color, borderColor: sm.color }}>
            {sm.icon} {store.strategy_c4 || 'Unknown'}
          </span>
          {store.focus_store && (
            <span className="ps-focus-badge">⭐ {store.focus_store}</span>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="ps-panel-info-grid">
        {store.banner && <div className="ps-info-item"><span>Banner</span><strong>{store.banner}</strong></div>}
        {store.mso && <div className="ps-info-item"><span>MSO</span><strong>{store.mso}</strong></div>}
        {store.call_fqy_target && <div className="ps-info-item"><span>Call Target</span><strong>{store.call_fqy_target}×/cycle</strong></div>}
        {store.c4_call_fqy != null && <div className="ps-info-item"><span>C4 Calls</span><strong>{store.c4_call_fqy}</strong></div>}
        {store.vitasoy_rank && <div className="ps-info-item"><span>VS Rank</span><strong>#{store.vitasoy_rank}</strong></div>}
        {store.assumed_sales && <div className="ps-info-item"><span>Sales/Wk</span><strong>${store.assumed_sales.toLocaleString()}</strong></div>}
        {store.dist_pct != null && <div className="ps-info-item"><span>Distribution</span><strong>{Math.round(store.dist_pct * 100)}%</strong></div>}
        {store.bay_count != null && <div className="ps-info-item"><span>Bay Count</span><strong>{store.bay_count}</strong></div>}
      </div>

      {/* Total Ranging */}
      <div className="ps-panel-section">
        <div className="ps-section-title">Total Ranging</div>
        <div className="ps-total-ranging">
          <div className="ps-total-num" style={{ color: totalCol }}>
            {store.total_ranging ?? '—'}<span className="ps-total-denom">/20 target</span>
          </div>
          <div className="kpi-bar-track" style={{ marginTop: 8 }}>
            <div className="kpi-bar-fill" style={{ width: `${totalPct}%`, background: totalCol }} />
            <div className="kpi-bar-target-line" style={{ left: `${pct(20, 28)}%` }} />
          </div>
        </div>
      </div>

      {/* KPI Breakdown */}
      <div className="ps-panel-section">
        <div className="ps-section-title">Ranging by Category</div>
        {KPI_DEFS.map(k => <KpiBar key={k.key} kpi={k} val={store[k.key]} />)}
        {store.uht_sos != null && (
          <div className="kpi-bar-row">
            <div className="kpi-bar-label">
              <span>UHT SOS</span>
              <span className="kpi-bar-val" style={{ color: kpiColor(store.uht_sos, 0.3) }}>
                {Math.round(store.uht_sos * 100)}%<span className="kpi-bar-target">/30%</span>
              </span>
            </div>
            <div className="kpi-bar-track">
              <div className="kpi-bar-fill" style={{ width: `${Math.min(100, store.uht_sos * 100 / 0.5 * 100)}%`, background: kpiColor(store.uht_sos, 0.3) }} />
              <div className="kpi-bar-target-line" style={{ left: '60%' }} />
            </div>
          </div>
        )}
      </div>

      {/* C3 vs C4 */}
      <div className="ps-panel-section">
        <div className="ps-section-title">Cycle Comparison</div>
        <div className="ps-cycle-compare">
          <div className="ps-cycle-col">
            <div className="ps-cycle-head">C3 Strategy</div>
            <div className="ps-cycle-val">
              {store.strategy_c3
                ? <span style={{ color: strategyMeta(store.strategy_c3).color }}>{store.strategy_c3}</span>
                : '—'}
            </div>
          </div>
          <div className="ps-cycle-arrow">→</div>
          <div className="ps-cycle-col">
            <div className="ps-cycle-head">C4 Strategy</div>
            <div className="ps-cycle-val">
              <span style={{ color: sm.color }}>{store.strategy_c4 || '—'}</span>
            </div>
          </div>
          <div className="ps-cycle-col">
            <div className="ps-cycle-head">C3 Calls</div>
            <div className="ps-cycle-val">{store.c3_call_fqy ?? '—'}</div>
          </div>
          <div className="ps-cycle-arrow">→</div>
          <div className="ps-cycle-col">
            <div className="ps-cycle-head">C4 Calls</div>
            <div className="ps-cycle-val">{store.c4_call_fqy ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Comments */}
      {store.comments && (
        <div className="ps-panel-section">
          <div className="ps-section-title">Comments</div>
          <p className="ps-comments">{store.comments}</p>
        </div>
      )}
    </div>
  )
}

// ─── View options (add future cycles here) ───────────────────────────────────
const VIEW_OPTIONS = [
  { value: '1',      label: `Cycle 1 ${CYCLE_YEAR_MAP[1]}` },
  { value: '4',      label: `Cycle 4 ${CYCLE_YEAR_MAP[4]}` },
  { value: '3',      label: `Cycle 3 ${CYCLE_YEAR_MAP[3]}` },
  { value: 'c3-c4', label: 'C3 → C4 Comparison' },
]

const LOC_TYPES = ['All', 'Metro', 'Regional', 'Major Regional', 'Remote']

function fmtCurrency(v) {
  if (v == null || v === '') return '—'
  return `$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ─── Comparison delta row ─────────────────────────────────────────────────────
function DeltaCell({ val }) {
  if (val == null || val === 0) return <span className="ps-delta ps-delta-zero">—</span>
  return (
    <span className={`ps-delta ${val > 0 ? 'ps-delta-pos' : 'ps-delta-neg'}`}>
      {val > 0 ? '+' : ''}{val}
    </span>
  )
}

const TIER_ORDER = { 'PERFECT STORE': 0, 'GROW': 1, 'DEVELOP': 2, 'EXPAND': 3, 'CLOSED': 4 }
function tierOf(s) { return TIER_ORDER[Object.keys(TIER_ORDER).find(k => (s || '').toUpperCase().includes(k)) || 'EXPAND'] ?? 3 }

function StrategyChange({ from: f, to: t }) {
  const fm = strategyMeta(f), tm = strategyMeta(t)
  const improved = tierOf(t) < tierOf(f), declined = tierOf(t) > tierOf(f)
  const same = !improved && !declined
  return (
    <div className="ps-strat-change">
      <div className="ps-strat-change-row">
        <span className="ps-strat-change-cycle">C3</span>
        <span className="ps-strat-tag" style={{ background: fm.bg, color: fm.color, borderColor: fm.color }}>{f || '—'}</span>
      </div>
      <div className={`ps-strat-change-indicator ${improved ? 'improved' : declined ? 'declined' : 'same'}`}>
        {improved ? '▲ Improved' : declined ? '▼ Declined' : '● No Change'}
      </div>
      <div className="ps-strat-change-row">
        <span className="ps-strat-change-cycle">C4</span>
        <span className="ps-strat-tag" style={{ background: tm.bg, color: tm.color, borderColor: tm.color }}>{t || '—'}</span>
      </div>
    </div>
  )
}

// ─── Comparison view ──────────────────────────────────────────────────────────
function ComparisonView({ c3, c4 }) {
  const [sortKey, setSortKey]   = useState('total_ranging')
  const [sortDir, setSortDir]   = useState('desc')
  const [page, setPage]         = useState(0)
  const [search, setSearch]     = useState('')
  const [stateF, setStateF]     = useState('All States')
  const [msoF, setMsoF]         = useState('All')
  const PAGE_SIZE = 50

  const rows = useMemo(() => {
    const map = {}
    c3.forEach(s => { map[s.store_id] = { c3: s } })
    c4.forEach(s => {
      if (!map[s.store_id]) map[s.store_id] = { c3: null }
      map[s.store_id].c4 = s
    })
    return Object.values(map)
      .filter(r => r.c3 && r.c4)
      .map(r => ({
        store_id:      r.store_id,
        store_name:    r.c4.store_name,
        state:         r.c4.state,
        mso:           r.c4.mso,
        strategy_c3:   r.c3.strategy_c4,
        strategy_c4:   r.c4.strategy_c4,
        total_ranging: (r.c4.total_ranging ?? 0) - (r.c3.total_ranging ?? 0),
        uht_core:      (r.c4.uht_core ?? 0)      - (r.c3.uht_core ?? 0),
        uht_noncore:   (r.c4.uht_noncore ?? 0)   - (r.c3.uht_noncore ?? 0),
        chilled:       (r.c4.chilled ?? 0)        - (r.c3.chilled ?? 0),
        rtd:           (r.c4.rtd ?? 0)            - (r.c3.rtd ?? 0),
        yoghurt:       (r.c4.yoghurt ?? 0)        - (r.c3.yoghurt ?? 0),
        vitasoy_rank:  r.c4.vitasoy_rank,
        call_fqy_c3:   r.c3.call_fqy_target,
        call_fqy_c4:   r.c4.call_fqy_target,
      }))
  }, [c3, c4])

  const msos = useMemo(() => ['All', ...Array.from(new Set(rows.map(r => r.mso).filter(Boolean))).sort()], [rows])

  useEffect(() => setPage(0), [search, stateF, msoF])

  const filtered = useMemo(() => {
    let list = rows
    if (stateF !== 'All States') list = list.filter(r => r.state === stateF)
    if (msoF !== 'All') list = list.filter(r => r.mso === msoF)
    if (search) { const q = search.toLowerCase(); list = list.filter(r => (r.store_name || '').toLowerCase().includes(q) || (r.mso || '').toLowerCase().includes(q)) }
    return [...list].sort((a, b) => {
      let av = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
      let bv = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      return av < bv ? (sortDir === 'asc' ? -1 : 1) : av > bv ? (sortDir === 'asc' ? 1 : -1) : 0
    })
  }, [rows, search, stateF, msoF, sortKey, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function SortH({ col, label }) {
    const active = sortKey === col
    return (
      <th className={`ps-th sortable ${active ? 'sorted' : ''}`}
          onClick={() => { setSortKey(col); setSortDir(active ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'); setPage(0) }}>
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    )
  }

  const improved  = rows.filter(r => r.total_ranging > 0).length
  const declined  = rows.filter(r => r.total_ranging < 0).length
  const unchanged = rows.filter(r => r.total_ranging === 0).length
  const avgDelta  = rows.length ? (rows.reduce((s, r) => s + r.total_ranging, 0) / rows.length).toFixed(1) : 0

  return (
    <>
      {/* Summary chips */}
      <div className="ps-compare-summary">
        <div className="ps-compare-chip ps-compare-pos"><div className="ps-compare-chip-num">+{improved}</div><div className="ps-compare-chip-lbl">Improved</div></div>
        <div className="ps-compare-chip ps-compare-neg"><div className="ps-compare-chip-num">{declined}</div><div className="ps-compare-chip-lbl">Declined</div></div>
        <div className="ps-compare-chip"><div className="ps-compare-chip-num">{unchanged}</div><div className="ps-compare-chip-lbl">Unchanged</div></div>
        <div className="ps-compare-chip ps-compare-avg"><div className="ps-compare-chip-num">{avgDelta > 0 ? '+' : ''}{avgDelta}</div><div className="ps-compare-chip-lbl">Avg Δ Ranging</div></div>
      </div>

      {/* Filters */}
      <div className="ps-filters">
        <input className="ps-search" placeholder="🔍 Search store or MSO…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="ps-select" value={stateF} onChange={e => setStateF(e.target.value)}>
          {STATES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="ps-select" value={msoF} onChange={e => setMsoF(e.target.value)}>
          {msos.map(m => <option key={m}>{m}</option>)}
        </select>
        {(search || stateF !== 'All States' || msoF !== 'All') && (
          <button className="ps-clear-btn" onClick={() => { setSearch(''); setStateF('All States'); setMsoF('All') }}>Clear</button>
        )}
        <span className="ps-result-count">{filtered.length} stores</span>
      </div>

      <div className="ps-table-wrap">
        <table className="ps-table">
          <thead>
            <tr>
              <SortH col="store_name" label="Store" />
              <SortH col="state" label="State" />
              <SortH col="mso" label="MSO" />
              <th className="ps-th">Strategy Change</th>
              <SortH col="total_ranging" label="Total Δ" />
              <SortH col="uht_core" label="UHT Core" />
              <SortH col="uht_noncore" label="Non-Core" />
              <SortH col="chilled" label="Chilled" />
              <SortH col="rtd" label="RTD" />
              <SortH col="yoghurt" label="Yoghurt" />
              <th className="ps-th">Call FQY</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(r => (
              <tr key={r.store_id} className="ps-row">
                <td className="ps-store-name">{r.store_name}</td>
                <td className="ps-state">{STATE_SHORT[r.state] || r.state}</td>
                <td className="ps-banner">{r.mso || '—'}</td>
                <td><StrategyChange from={r.strategy_c3} to={r.strategy_c4} /></td>
                <td><DeltaCell val={r.total_ranging} /></td>
                <td><DeltaCell val={r.uht_core} /></td>
                <td><DeltaCell val={r.uht_noncore} /></td>
                <td><DeltaCell val={r.chilled} /></td>
                <td><DeltaCell val={r.rtd} /></td>
                <td><DeltaCell val={r.yoghurt} /></td>
                <td>
                  <div className="ps-fqy-compare">
                    <span className="ps-fqy-val">{r.call_fqy_c3 ?? '—'}</span>
                    <span className="ps-fqy-arrow">→</span>
                    <span className="ps-fqy-val">{r.call_fqy_c4 ?? '—'}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="ps-empty">No stores match your filters</div>}
        {totalPages > 1 && (
          <div className="ps-pagination">
            <button className="ps-page-btn" onClick={() => setPage(0)} disabled={page === 0}>«</button>
            <button className="ps-page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}>‹ Prev</button>
            <span className="ps-page-info">Page {page + 1} of {totalPages} · {filtered.length} stores</span>
            <button className="ps-page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next ›</button>
            <button className="ps-page-btn" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── PS Builder store slot ────────────────────────────────────────────────────
function StoreSlot({ slotNum, slot, storeList, psData, visitCounts, onSelect, onClear }) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const wrapRef           = useRef(null)

  // close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    if (!query) return storeList.slice(0, 40)
    const q = query.toLowerCase()
    return storeList.filter(s => s.store_name.toLowerCase().includes(q)).slice(0, 40)
  }, [query, storeList])

  const ps = slot?.store_id ? psData[slot.store_id] : null

  const distPct    = ps ? Math.round((ps.total_ranging / 28) * 100) + '%' : '—'
  const gaps       = ps ? (28 - ps.total_ranging) : '—'
  const psScore    = ps ? Math.round((ps.total_ranging / 28) * 100) + '%' : '—'
  const visits     = slot?.store_id ? (visitCounts[slot.store_id] ?? 0) : '—'

  const statusDot = ps
    ? ps.total_ranging >= 20
      ? { color: '#16a085', label: 'On track' }
      : ps.total_ranging >= 12
        ? { color: '#e67e22', label: 'Developing' }
        : { color: '#CC0000', label: 'Needs work' }
    : null

  return (
    <div className="psb-slot">
      <div className="psb-slot-num">{slotNum}</div>

      <div className="psb-slot-store" ref={wrapRef}>
        {slot?.store_name ? (
          <div className="psb-slot-selected-name">{slot.store_name}</div>
        ) : (
          <div className="psb-search-wrap">
            <input
              className="psb-search-input"
              placeholder="Search store…"
              value={query}
              onFocus={() => setOpen(true)}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
            />
            {open && (
              <div className="psb-dropdown">
                {filtered.length === 0
                  ? <div className="psb-dropdown-empty">No stores found</div>
                  : filtered.map(s => (
                    <div
                      key={s.store_id}
                      className="psb-dropdown-item"
                      onMouseDown={() => {
                        onSelect(slotNum, s)
                        setQuery('')
                        setOpen(false)
                      }}
                    >
                      <span className="psb-dropdown-name">{s.store_name}</span>
                      <span className="psb-dropdown-id">#{s.store_id}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="psb-metrics">
        <div className="psb-metric">
          <span className="psb-metric-label">Dist %</span>
          <span className="psb-metric-val">{distPct}</span>
        </div>
        <div className="psb-metric">
          <span className="psb-metric-label">Gaps</span>
          <span className="psb-metric-val psb-metric-gaps">{gaps}</span>
        </div>
        <div className="psb-metric">
          <span className="psb-metric-label">PS Score</span>
          <span className="psb-metric-val">{psScore}</span>
        </div>
        <div className="psb-metric">
          <span className="psb-metric-label">Visits</span>
          <span className="psb-metric-val">{visits}</span>
        </div>
      </div>

      {/* Status dot */}
      <div className="psb-slot-status">
        {statusDot && (
          <span
            className="psb-status-dot"
            style={{ background: statusDot.color }}
            title={statusDot.label}
          />
        )}
      </div>

      {/* Clear button */}
      <div className="psb-slot-clear">
        {slot?.store_id && (
          <button className="psb-clear-btn" onClick={() => onClear(slotNum)} title="Remove store">✕</button>
        )}
      </div>
    </div>
  )
}

// ─── PS Builder tab ───────────────────────────────────────────────────────────
function PSBuilder() {
  const [rep, setRep]         = useState('Sam Gowen')
  const [cycle, setCycle]     = useState(CURRENT_CYCLE)
  const [slots, setSlots]     = useState({})       // { slotNum: { store_id, store_name } }
  const [psData, setPsData]   = useState({})       // { store_id: ps row }
  const [visitCounts, setVisitCounts] = useState({}) // { store_id: count }
  const [storeList, setStoreList]     = useState([])
  const [loading, setLoading] = useState(false)

  const repStates = PS_REP_STATES[rep] || []

  // Load store list for rep's states (from perfect_store cycle=4, read-only)
  useEffect(() => {
    async function loadStores() {
      if (!repStates.length) return
      let all = [], from = 0
      while (true) {
        const { data, error } = await supabase
          .from('perfect_store')
          .select('store_id,store_name,state,total_ranging')
          .eq('cycle', 4)
          .in('state', repStates)
          .order('store_name', { ascending: true })
          .range(from, from + 499)
        if (error || !data || data.length === 0) break
        all = [...all, ...data]
        if (data.length < 500) break
        from += 500
      }
      setStoreList(all)
    }
    loadStores()
  }, [rep])

  // Load saved target stores + ps data + visit counts
  useEffect(() => {
    async function load() {
      setLoading(true)
      setSlots({})
      setPsData({})
      setVisitCounts({})

      // 1. Load target_stores for this rep+cycle
      const { data: saved } = await supabase
        .from('target_stores')
        .select('slot_num,store_id,store_name')
        .eq('rep_name', rep)
        .eq('cycle', cycle)

      const newSlots = {}
      if (saved) {
        saved.forEach(r => {
          newSlots[r.slot_num] = { store_id: r.store_id, store_name: r.store_name }
        })
      }
      setSlots(newSlots)

      // 2. Load PS data for selected stores
      const storeIds = Object.values(newSlots).map(s => s.store_id).filter(Boolean)
      if (storeIds.length > 0) {
        const { data: psRows } = await supabase
          .from('perfect_store')
          .select('store_id,total_ranging,uht_core,uht_noncore,chilled,rtd,yoghurt,strategy_c4')
          .eq('cycle', 4)
          .in('store_id', storeIds)
        const psMap = {}
        if (psRows) psRows.forEach(r => { psMap[r.store_id] = r })
        setPsData(psMap)
      }

      // 3. Load visit counts from cycle_planner_slots (read-only)
      if (storeIds.length > 0) {
        const { data: visits } = await supabase
          .from('cycle_planner_slots')
          .select('store_id')
          .eq('rep_name', rep)
          .eq('cycle', cycle)
          .in('store_id', storeIds)
        const vcMap = {}
        if (visits) visits.forEach(v => { vcMap[v.store_id] = (vcMap[v.store_id] || 0) + 1 })
        setVisitCounts(vcMap)
      }

      setLoading(false)
    }
    load()
  }, [rep, cycle])

  // When a store is selected for a slot
  async function handleSelect(slotNum, store) {
    const newSlots = { ...slots, [slotNum]: { store_id: store.store_id, store_name: store.store_name } }
    setSlots(newSlots)

    // Upsert to target_stores
    await supabase.from('target_stores').upsert(
      { rep_name: rep, cycle, slot_num: slotNum, store_id: store.store_id, store_name: store.store_name, updated_at: new Date().toISOString() },
      { onConflict: 'rep_name,cycle,slot_num' }
    )

    // Fetch PS data for this store if not already loaded
    if (!psData[store.store_id]) {
      const { data } = await supabase
        .from('perfect_store')
        .select('store_id,total_ranging,uht_core,uht_noncore,chilled,rtd,yoghurt,strategy_c4')
        .eq('cycle', 4)
        .eq('store_id', store.store_id)
        .maybeSingle()
      if (data) setPsData(prev => ({ ...prev, [store.store_id]: data }))
    }

    // Fetch visit count for this store
    const { data: visits } = await supabase
      .from('cycle_planner_slots')
      .select('store_id')
      .eq('rep_name', rep)
      .eq('cycle', cycle)
      .eq('store_id', store.store_id)
    setVisitCounts(prev => ({ ...prev, [store.store_id]: visits ? visits.length : 0 }))
  }

  // When a slot is cleared
  async function handleClear(slotNum) {
    const newSlots = { ...slots }
    delete newSlots[slotNum]
    setSlots(newSlots)

    await supabase.from('target_stores').upsert(
      { rep_name: rep, cycle, slot_num: slotNum, store_id: null, store_name: null, updated_at: new Date().toISOString() },
      { onConflict: 'rep_name,cycle,slot_num' }
    )
  }

  const filledCount = Object.values(slots).filter(s => s?.store_id).length

  // ── Export PDF ──────────────────────────────────────────────────────────────
  function exportPDF() {
    const repSlug  = rep.replace(/\s+/g, '')
    const docTitle = `TargetStores_${repSlug}_Cycle${cycle}`

    const statusDot = (ps) => {
      if (!ps) return `<span style="width:10px;height:10px;border-radius:50%;background:#ddd;display:inline-block"></span>`
      const r = ps.total_ranging
      const col = r >= 20 ? '#16a085' : r >= 12 ? '#e67e22' : '#CC0000'
      const lbl = r >= 20 ? 'Perfect Store' : r >= 12 ? 'On Track' : 'Off Track'
      return `<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:50%;background:${col};display:inline-block;flex-shrink:0"></span><span style="font-size:10px;color:${col};font-weight:600">${lbl}</span></span>`
    }

    const rowsHTML = Array.from({ length: 10 }, (_, i) => i + 1).map(slotNum => {
      const slot = slots[slotNum]
      const ps   = slot ? psData[slot.store_id] : null
      const dist = ps ? Math.round(ps.total_ranging / 28 * 100) + '%' : '—'
      const gaps = ps ? (28 - ps.total_ranging) : '—'
      const vis  = slot ? (visitCounts[slot.store_id] || 0) : '—'
      const strategy = ps?.strategy_c4 || '—'
      const stratColor = { GROW: '#16a085', DEVELOP: '#e67e22', EXPAND: '#CC0000' }[strategy] || '#888'

      return `<tr class="${slotNum % 2 === 0 ? 'even' : ''}">
        <td class="td-num">${slotNum}</td>
        <td class="td-store">${slot?.store_name || '<span style="color:#ccc;font-style:italic">Empty slot</span>'}</td>
        <td class="td-metric">${dist}</td>
        <td class="td-metric ${ps && (28 - ps.total_ranging) > 0 ? 'td-red' : ''}">${gaps}</td>
        <td class="td-metric">${dist}</td>
        <td class="td-metric">${vis}</td>
        <td class="td-strat"><span style="border:1.5px solid ${stratColor};color:${stratColor};border-radius:20px;padding:2px 8px;font-size:9px;font-weight:700;white-space:nowrap">${strategy}</span></td>
        <td class="td-status">${statusDot(ps)}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;background:white}
    .pdf-header{background:#CC0000;color:white;padding:20px 28px}
    .pdf-header h1{font-size:20px;font-weight:800;margin-bottom:4px}
    .pdf-header p{font-size:12px;opacity:.85}
    .pdf-body{padding:24px 28px}
    .pdf-section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:12px}
    table{width:100%;border-collapse:collapse}
    th{background:#f5f5f5;text-align:left;padding:7px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#666;border-bottom:2px solid #e0e0e0}
    td{padding:8px 10px;border-bottom:1px solid #f0f0f0;vertical-align:middle}
    tr.even td{background:#fafafa}
    .td-num{color:#bbb;font-weight:700;width:28px;text-align:center}
    .td-store{font-weight:600;font-size:11.5px;min-width:180px}
    .td-metric{text-align:center;font-weight:700;font-size:12px;color:#1a1a1a;width:70px}
    .td-red{color:#CC0000}
    .td-strat{width:90px}
    .td-status{width:110px}
    .pdf-legend{display:flex;gap:20px;padding:14px 28px;font-size:10px;color:#555;border-top:1px solid #eee;margin-top:4px}
    .pdf-legend span{display:flex;align-items:center;gap:5px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div class="pdf-header">
      <h1>${rep} — Target Stores Cycle ${cycle}</h1>
      <p>${filledCount} of 10 slots filled · Perfect Store Builder</p>
    </div>
    <div class="pdf-body">
      <div class="pdf-section-title">My Target Stores This Cycle</div>
      <table>
        <thead><tr>
          <th>#</th><th>Store</th><th>Dist %</th><th>Gaps</th><th>PS Score</th><th>Visits C${cycle}</th><th>Strategy</th><th>Status</th>
        </tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>
    <div class="pdf-legend">
      <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#16a085"></span> Perfect Store (≥20/28)</span>
      <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#e67e22"></span> On Track (12–19/28)</span>
      <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#CC0000"></span> Off Track (&lt;12/28)</span>
    </div>
    </body></html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.document.title = docTitle
    setTimeout(() => { win.focus(); win.print() }, 400)
  }

  return (
    <div className="psb-container">
      {/* Controls */}
      <div className="psb-controls">
        <div className="psb-control-group">
          <label className="psb-control-label">Rep</label>
          <select className="psb-select" value={rep} onChange={e => setRep(e.target.value)}>
            {PSB_REPS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="psb-control-group">
          <label className="psb-control-label">Cycle</label>
          <div className="psb-cycle-tabs">
            {[1, 2, 3].map(c => (
              <button
                key={c}
                className={`psb-cycle-tab ${cycle === c ? 'active' : ''}`}
                onClick={() => setCycle(c)}
              >
                C{c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Heading */}
      <div className="psb-heading">
        <div>
          <h2 className="psb-heading-title">My Target Stores — {rep} Cycle {cycle}</h2>
          <span className="psb-heading-sub">{filledCount} of 10 slots filled</span>
        </div>
        <button className="psb-export-btn" onClick={exportPDF}>⬇ Export PDF</button>
      </div>

      {/* Column headers */}
      <div className="psb-col-headers">
        <div className="psb-col-num">#</div>
        <div className="psb-col-store">Store</div>
        <div className="psb-col-metrics">
          <span>Dist %</span>
          <span>Gaps</span>
          <span>PS Score</span>
          <span>Visits (C{cycle})</span>
        </div>
        <div className="psb-col-status"></div>
        <div className="psb-col-clear"></div>
      </div>

      {/* Slots */}
      {loading ? (
        <div className="psb-loading">
          <div className="ps-spinner" />
          <span>Loading…</span>
        </div>
      ) : (
        <div className="psb-slots">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(slotNum => (
            <StoreSlot
              key={slotNum}
              slotNum={slotNum}
              slot={slots[slotNum]}
              storeList={storeList}
              psData={psData}
              visitCounts={visitCounts}
              onSelect={handleSelect}
              onClear={handleClear}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PerfectStore() {
  // Make main-content scrollable while this page is mounted
  useEffect(() => {
    const mc = document.querySelector('.main-content')
    if (mc) mc.style.overflowY = 'auto'
    return () => { if (mc) mc.style.overflowY = '' }
  }, [])

  const [psSection, setPsSection]   = useState('pipeline')
  const [activeTab, setActiveTab]   = useState('tracker')

  const [stores, setStores]         = useState([])
  const [c3Stores, setC3Stores]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [search, setSearch]         = useState('')
  const [stateFilter, setStateFilter] = useState('All States')
  const [stratFilter, setStratFilter] = useState('All')
  const [bannerFilter, setBannerFilter] = useState('All')
  const [locTypeFilter, setLocTypeFilter] = useState('All')
  const [sortKey, setSortKey]       = useState('vitasoy_rank')
  const [sortDir, setSortDir]       = useState('asc')
  const [page, setPage]             = useState(0)
  const [view, setView]             = useState(String(CURRENT_CYCLE))
  const PAGE_SIZE = 50

  async function fetchCycle(cycleNum) {
    let all = [], from = 0
    while (true) {
      const { data, error } = await supabase
        .from('perfect_store').select('*')
        .eq('cycle', cycleNum)
        .order('vitasoy_rank', { ascending: true })
        .range(from, from + 499)
      if (error || !data || data.length === 0) break
      all = [...all, ...data]
      if (data.length < 500) break
      from += 500
    }
    return all
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      setSelected(null)
      setPage(0)
      if (view === 'c3-c4') {
        const [c3, c4] = await Promise.all([fetchCycle(3), fetchCycle(4)])
        setC3Stores(c3)
        setStores(c4)
      } else {
        const data = await fetchCycle(Number(view))
        setStores(data)
      }
      setLoading(false)
    }
    load()
  }, [view])

  // Summary stats
  const strategyCounts = useMemo(() => {
    const counts = {}
    stores.forEach(s => {
      const k = Object.keys(STRATEGY_META).find(k => (s.strategy_c4 || '').toUpperCase().includes(k)) || 'EXPAND'
      counts[k] = (counts[k] || 0) + 1
    })
    return counts
  }, [stores])

  const kpiMeetingTarget = useMemo(() => {
    return KPI_DEFS.map(k => ({
      ...k,
      count: stores.filter(s => (s[k.key] ?? 0) >= k.target).length,
    }))
  }, [stores])

  // Unique banners for filter
  const banners = useMemo(() => {
    const set = new Set(stores.map(s => s.banner).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [stores])

  // Filtered + sorted stores
  const filtered = useMemo(() => {
    let list = stores.filter(s => {
      if (stateFilter !== 'All States' && s.state !== stateFilter) return false
      if (stratFilter !== 'All') {
        const k = Object.keys(STRATEGY_META).find(k => (s.strategy_c4 || '').toUpperCase().includes(k)) || 'EXPAND'
        if (k !== stratFilter) return false
      }
      if (bannerFilter !== 'All' && s.banner !== bannerFilter) return false
      if (locTypeFilter !== 'All' && s.location_type !== locTypeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(s.store_name || '').toLowerCase().includes(q) &&
            !(s.mso || '').toLowerCase().includes(q)) return false
      }
      return true
    })

    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (av == null) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv == null) bv = sortDir === 'asc' ? Infinity : -Infinity
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [stores, stateFilter, stratFilter, bannerFilter, locTypeFilter, search, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(0)
  }

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0) }, [search, stateFilter, stratFilter, bannerFilter, locTypeFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function SortHead({ col, label }) {
    const active = sortKey === col
    return (
      <th className={`ps-th sortable ${active ? 'sorted' : ''}`} onClick={() => toggleSort(col)}>
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    )
  }

  const detail = selected ? stores.find(s => s.id === selected) : null

  const viewLabel = VIEW_OPTIONS.find(o => o.value === view)?.label || ''
  const isCompare = view === 'c3-c4'

  function exportExcel() {
    const rows = filtered.map(s => ({
      'Store Name':         s.store_name || '',
      'State':              s.state || '',
      'MSO':                s.mso || '',
      'Banner':             s.banner || '',
      'Rep':                s.rep_name || '',
      'Strategy':           s.strategy_c4 || '',
      'Total Ranging':      s.total_ranging ?? '',
      'UHT Core':           s.uht_core ?? '',
      'Chilled':            s.chilled ?? '',
      'Yoghurt':            s.yoghurt ?? '',
      'VS Rank':            s.vitasoy_rank ?? '',
      'Call FQY':           s.call_fqy_target ?? '',
      'First Order GSV ($)': s.first_order_gsv ?? '',
      'Total GSV Opp ($)':  s.total_gsv_opportunity ?? '',
      'POG':                s.planogram_to_do ? 'Yes' : '',
      'Focus Store':        s.focus_store || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Perfect Store')
    XLSX.writeFile(wb, `Perfect_Store_${viewLabel.replace(/ /g, '_')}.xlsx`)
  }

  return (
    <div className="ps-page">

      {/* ── Top sub-nav: Pipeline | Focus Stores ── */}
      <div className="psb-tab-bar">
        <button
          className={`psb-tab ${psSection === 'pipeline' ? 'active' : ''}`}
          onClick={() => setPsSection('pipeline')}
        >
          Pipeline
        </button>
        <button
          className={`psb-tab ${psSection === 'focus-stores' ? 'active' : ''}`}
          onClick={() => setPsSection('focus-stores')}
        >
          Focus Stores
        </button>
      </div>

      {/* ── Focus Stores section ── */}
      {psSection === 'focus-stores' && (
        <Suspense fallback={<div className="ps-loading"><div className="ps-spinner" /><p>Loading…</p></div>}>
          <FocusStores />
        </Suspense>
      )}

      {/* ── Pipeline section ── */}
      {psSection === 'pipeline' && <>

      {/* Inner tab bar: Store Tracker | PS Builder */}
      <div className="psb-tab-bar">
        <button
          className={`psb-tab ${activeTab === 'tracker' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracker')}
        >
          Store Tracker
        </button>
        <button
          className={`psb-tab ${activeTab === 'builder' ? 'active' : ''}`}
          onClick={() => setActiveTab('builder')}
        >
          PS Builder
        </button>
      </div>

      {/* ── PS Builder tab ── */}
      {activeTab === 'builder' && <PSBuilder />}

      {/* ── Store Tracker tab ── */}
      {activeTab === 'tracker' && <>

      {/* Header */}
      <div className="ps-header">
        <div>
          <h1 className="ps-title">Perfect Store {isCompare ? '— C3 → C4' : `— ${viewLabel}`}</h1>
          <p className="ps-sub">
            {isCompare ? `${stores.length} stores compared` : `${stores.length} stores · ${view === '4' ? 'Data to 15 Mar 2026' : 'Data to 6 Dec 2025'}`}
          </p>
        </div>
        <div className="ps-view-dropdown-wrap">
          <label className="ps-view-label">View</label>
          <select
            className="ps-view-select"
            value={view}
            onChange={e => setView(e.target.value)}
          >
            {VIEW_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="ps-loading"><div className="ps-spinner" /><p>Loading Perfect Store data…</p></div>}

      {!loading && <>

      {/* ── Comparison view ── */}
      {isCompare && <ComparisonView c3={c3Stores} c4={stores} />}

      {/* ── Single cycle view ── */}
      {!isCompare && <>

      {/* Strategy tier cards */}
      <div className="ps-strategy-row">
        {Object.entries(STRATEGY_META).map(([tier, meta]) => (
          <button
            key={tier}
            className={`ps-strat-card ${stratFilter === tier ? 'active' : ''}`}
            style={{ '--strat-color': meta.color, '--strat-bg': meta.bg }}
            onClick={() => setStratFilter(stratFilter === tier ? 'All' : tier)}
          >
            <div className="ps-strat-icon">{meta.icon}</div>
            <div className="ps-strat-count">{strategyCounts[tier] || 0}</div>
            <div className="ps-strat-label">{tier}</div>
          </button>
        ))}
      </div>

      {/* KPI summary bar */}
      <div className="ps-kpi-summary">
        {kpiMeetingTarget.map(k => (
          <div key={k.key} className="ps-kpi-chip">
            <div className="ps-kpi-chip-count" style={{ color: k.color }}>{k.count}</div>
            <div className="ps-kpi-chip-label">{k.label}</div>
            <div className="ps-kpi-chip-sub">meeting target</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="ps-filters">
        <input
          className="ps-search"
          placeholder="🔍 Search store or MSO…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="ps-select" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
          {STATES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="ps-select" value={bannerFilter} onChange={e => setBannerFilter(e.target.value)}>
          {banners.map(b => <option key={b}>{b}</option>)}
        </select>
        {(stratFilter !== 'All' || stateFilter !== 'All States' || bannerFilter !== 'All' || locTypeFilter !== 'All' || search) && (
          <button className="ps-clear-btn" onClick={() => { setStratFilter('All'); setStateFilter('All States'); setBannerFilter('All'); setLocTypeFilter('All'); setSearch('') }}>
            Clear filters
          </button>
        )}
        <button className="ps-export-btn" onClick={exportExcel}>↓ Export Excel</button>
        <span className="ps-result-count">{filtered.length} stores</span>
      </div>

      {/* Location type pills */}
      <div className="ps-loc-pills">
        {LOC_TYPES.map(lt => (
          <button
            key={lt}
            className={`ps-loc-pill ${locTypeFilter === lt ? 'active' : ''}`}
            onClick={() => setLocTypeFilter(lt)}
          >
            {lt}
          </button>
        ))}
      </div>

      {/* Table + Panel */}
      <div className={`ps-body ${detail ? 'with-panel' : ''}`}>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead>
              <tr>
                <SortHead col="store_name" label="Store" />
                <SortHead col="state" label="State" />
                <th className="ps-th">Banner</th>
                <SortHead col="strategy_c4" label="Strategy" />
                <SortHead col="total_ranging" label="Ranging" />
                <SortHead col="uht_core" label="UHT C" />
                <SortHead col="chilled" label="Chilled" />
                <SortHead col="yoghurt" label="Yog" />
                <SortHead col="vitasoy_rank" label="VS Rank" />
                <SortHead col="call_fqy_target" label="Call FQY" />
                <SortHead col="first_order_gsv" label="First Order GSV $" />
                <SortHead col="total_gsv_opportunity" label="Total GSV $" />
                <th className="ps-th">POG</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(s => {
                const sm = strategyMeta(s.strategy_c4)
                const trCol = kpiColor(s.total_ranging, 20)
                return (
                  <tr
                    key={s.id}
                    className={`ps-row ${selected === s.id ? 'selected' : ''}`}
                    onClick={() => setSelected(selected === s.id ? null : s.id)}
                  >
                    <td className="ps-store-name">
                      {s.store_name}
                      {s.focus_store && <span className="ps-focus-dot" title={s.focus_store}>⭐</span>}
                    </td>
                    <td className="ps-state">{STATE_SHORT[s.state] || s.state}</td>
                    <td className="ps-banner">{s.banner}</td>
                    <td>
                      <span className="ps-strat-tag" style={{ background: sm.bg, color: sm.color, borderColor: sm.color }}>
                        {s.strategy_c4 || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="ps-ranging-pill" style={{ color: trCol }}>
                        <span className="ps-ranging-num">{s.total_ranging ?? '—'}</span>
                        <div className="ps-ranging-bar">
                          <div style={{ width: `${pct(s.total_ranging, 28)}%`, background: trCol }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: kpiColor(s.uht_core, 8), fontWeight: 600 }}>{s.uht_core ?? '—'}</span>
                      <span className="ps-max">/8</span>
                    </td>
                    <td>
                      <span style={{ color: kpiColor(s.chilled, 5), fontWeight: 600 }}>{s.chilled ?? '—'}</span>
                      <span className="ps-max">/9</span>
                    </td>
                    <td>
                      <span style={{ color: kpiColor(s.yoghurt, 1), fontWeight: 600 }}>{s.yoghurt ?? '—'}</span>
                    </td>
                    <td className="ps-rank">{s.vitasoy_rank ? `#${s.vitasoy_rank}` : '—'}</td>
                    <td className="ps-calls">{s.call_fqy_target != null ? `${s.call_fqy_target}×` : '—'}</td>
                    <td className="ps-gsv-cell">{fmtCurrency(s.first_order_gsv)}</td>
                    <td className="ps-gsv-cell">{fmtCurrency(s.total_gsv_opportunity)}</td>
                    <td className="ps-pog-cell">
                      {s.planogram_to_do ? <span className="ps-pog-badge">POG</span> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="ps-empty">No stores match your filters</div>
          )}
          {totalPages > 1 && (
            <div className="ps-pagination">
              <button className="ps-page-btn" onClick={() => setPage(0)} disabled={page === 0}>«</button>
              <button className="ps-page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}>‹ Prev</button>
              <span className="ps-page-info">
                Page {page + 1} of {totalPages} · {filtered.length} stores
              </span>
              <button className="ps-page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next ›</button>
              <button className="ps-page-btn" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
            </div>
          )}
        </div>

        {detail && <StorePanel store={detail} onClose={() => setSelected(null)} />}
      </div>

      </>}  {/* end single-cycle view */}
      </>}  {/* end !loading */}
      </>}  {/* end tracker tab */}

      </>}  {/* end pipeline section */}
    </div>
  )
}
