import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import StoreProfile from '../StoreMap/StoreProfile'
import { useDataFreshness } from '../../hooks/useDataFreshness'
import { CURRENT_CYCLE, CYCLE_STARTS } from '../../constants'
import { exportPerfectStoreHTML } from './exportHTML'
import './PerfectStore.css'

const CYCLE_YEAR      = CYCLE_STARTS[CURRENT_CYCLE].split('-')[0]
const CYCLE_LABEL     = `${CYCLE_YEAR} Cycle ${CURRENT_CYCLE}`
const _cycleStart     = new Date(CYCLE_STARTS[CURRENT_CYCLE] + 'T00:00:00')
const _cycleEnd       = new Date(_cycleStart)
_cycleEnd.setDate(_cycleStart.getDate() + 11 * 7 + 4)
const _fmtD = d => `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`
const CYCLE_RANGE     = `${_fmtD(_cycleStart)} – ${_fmtD(_cycleEnd)}`

const PAGE_SIZE = 100

const CLASS_COLORS = {
  'PERFECT STORE': '#2e7d32',
  'GROW':          '#0e7490',
  'DEVELOP':       '#e67e22',
  'EXPAND':        '#546e7a',
}

const fmtPct = v => v == null ? '—' : `${(v * 100).toFixed(1)}%`
const fmtNum = v => v == null ? '—' : v
const fmtSos = v => {
  if (v == null || v === '') return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return v
  return `${(n * 100).toFixed(1)}%`
}

// Column definitions — label, data key, sort type ('str' | 'num')
const COLS = [
  { label: 'State',            key: 'state',            type: 'str' },
  { label: 'Location',         key: 'location',         type: 'str' },
  { label: 'Store ID',         key: 'store_id',         type: 'str' },
  { label: 'Store Name',       key: 'store_name',       type: 'str' },
  { label: 'Classification',   key: 'classification',   type: 'str' },
  { label: 'Focus Store',      key: 'focus_store',      type: 'str' },
  { label: 'Distribution %',   key: 'distribution_pct', type: 'num' },
  { label: 'UHT Core Gaps',    key: 'uht_core_gaps',    type: 'num' },
  { label: 'UHT NonCore Gaps', key: 'uht_noncore_gaps', type: 'num' },
  { label: 'Chilled Opp',      key: 'chilled_opp',      type: 'num' },
  { label: 'RTD Opp',          key: 'rtd_opp',          type: 'num' },
  { label: 'Yoghurt Opp',      key: 'yoghurt_opp',      type: 'num' },
  { label: 'Total Opp',        key: 'total_opp',        type: 'num' },
  { label: 'UHT SOS',          key: 'uht_sos',          type: 'num' },
  { label: 'T/Up Previous',    key: 'tup_previous',     type: 'str' },
  { label: 'Call Freq Target', key: 'call_freq_target', type: 'num' },
  { label: 'Actual Visits',   key: 'actual_visits',    type: 'num' },
]

function sortRows(rows, col, dir) {
  if (!col) return rows
  const colDef = COLS.find(c => c.key === col)
  const mult = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let av = a[col], bv = b[col]
    if (colDef?.type === 'num') {
      // uht_sos is stored as text — parse for sort
      if (col === 'uht_sos') { av = parseFloat(av); bv = parseFloat(bv) }
      av = av ?? -Infinity
      bv = bv ?? -Infinity
      return (av - bv) * mult
    }
    av = (av ?? '').toString().toLowerCase()
    bv = (bv ?? '').toString().toLowerCase()
    return av < bv ? -mult : av > bv ? mult : 0
  })
}

function renderCell(r, key) {
  switch (key) {
    case 'classification': {
      const val = r[key]
      if (!val) return <span style={{ color: '#888' }}>—</span>
      const color = CLASS_COLORS[val.toUpperCase().trim()] || '#888'
      return (
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 10,
          fontSize: 11, fontWeight: 600,
          background: color + '20', color,
        }}>
          {val}
        </span>
      )
    }
    case 'distribution_pct': return fmtPct(r[key])
    case 'uht_sos':          return fmtSos(r[key])
    case 'actual_visits': {
      const actual = r.actual_visits ?? 0
      const target = r.call_freq_target
      if (!target) return <span style={{ color: '#888' }}>{actual}</span>
      const ratio = actual / target
      const color = ratio >= 1 ? '#2e7d32' : ratio >= 0.5 ? '#e67e22' : '#b71c1c'
      return <span style={{ fontWeight: 600, color }}>{actual}</span>
    }
    default:                 return r[key] ?? '—'
  }
}

export default function PerfectStore() {
  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [visitCounts, setVisitCounts] = useState({})
  const freshness                     = useDataFreshness()

  const [stateFilter,    setStateFilter]    = useState('All')
  const [locationFilter, setLocationFilter] = useState('All')
  const [classFilter,    setClassFilter]    = useState('All')
  const [search,         setSearch]         = useState('')
  const [page,        setPage]        = useState(1)
  const [sortCol,      setSortCol]      = useState(null)
  const [sortDir,      setSortDir]      = useState('asc')
  const [selectedStore, setSelectedStore] = useState(null)

  // Fetch visit counts for the current cycle — location_no only, paginated
  useEffect(() => {
    async function loadVisits() {
      let all = [], from = 0
      while (true) {
        const { data } = await supabase
          .from('store_visits')
          .select('location_no')
          .eq('cycle', CYCLE_LABEL)
          .eq('schedule_state', 'Successful')
          .range(from, from + 499)
        if (!data || data.length === 0) break
        all = [...all, ...data]
        if (data.length < 500) break
        from += 500
      }
      const counts = {}
      all.forEach(v => {
        const key = String(v.location_no)
        counts[key] = (counts[key] || 0) + 1
      })
      setVisitCounts(counts)
    }
    loadVisits()
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      let all = []
      let from = 0
      while (true) {
        const { data, error: err } = await supabase
          .from('perfect_store_v2')
          .select('*')
          .range(from, from + 999)
        if (err) { setError(err.message); setLoading(false); return }
        if (!data.length) break
        all = [...all, ...data]
        if (data.length < 1000) break
        from += 1000
      }
      setRows(all)
      setLoading(false)
    }
    load()
  }, [])

  const stateOptions = useMemo(() => {
    const unique = [...new Set(rows.map(r => r.state).filter(Boolean))].sort()
    return ['All', ...unique]
  }, [rows])

  // Location options scoped to the selected state so the list stays short
  const locationOptions = useMemo(() => {
    const source = stateFilter === 'All' ? rows : rows.filter(r => r.state === stateFilter)
    const unique = [...new Set(source.map(r => r.location).filter(Boolean))].sort()
    return ['All', ...unique]
  }, [rows, stateFilter])

  const classOptions = useMemo(() => {
    const unique = [...new Set(rows.map(r => r.classification).filter(Boolean))].sort()
    return ['All', ...unique]
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r => {
      if (stateFilter    !== 'All' && r.state        !== stateFilter)    return false
      if (locationFilter !== 'All' && r.location     !== locationFilter) return false
      if (classFilter    !== 'All' && r.classification !== classFilter)  return false
      if (q && !r.store_name?.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, stateFilter, locationFilter, classFilter, search])

  const enriched = useMemo(() => filtered.map(r => ({
    ...r, actual_visits: visitCounts[r.store_id] ?? 0
  })), [filtered, visitCounts])

  const sorted = useMemo(() => sortRows(enriched, sortCol, sortDir), [enriched, sortCol, sortDir])

  const visible = sorted.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < sorted.length

  function resetPage() { setPage(1) }

  function handleSort(key) {
    if (sortCol === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(key)
      setSortDir('asc')
    }
    resetPage()
  }

  function thArrow(key) {
    if (sortCol !== key) return <span className="ps-th-arrow">↕</span>
    return <span className="ps-th-arrow active">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="ps-page">
      <div className="ps-header">
        <h1 className="ps-title">Perfect Store</h1>
        <p className="ps-sub">
          {loading ? 'Loading…' : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} stores`}
          <span className="data-freshness"> · {CYCLE_LABEL} ({CYCLE_RANGE})</span>
          {freshness.bnb26 && <span className="data-freshness"> · 26wk data: {freshness.bnb26}</span>}
        </p>
      </div>

      <div className="ps-filters">
        <select
          className="ps-select"
          value={stateFilter}
          onChange={e => { setStateFilter(e.target.value); setLocationFilter('All'); resetPage() }}
        >
          {stateOptions.map(s => <option key={s}>{s}</option>)}
        </select>

        <select
          className="ps-select"
          value={locationFilter}
          onChange={e => { setLocationFilter(e.target.value); resetPage() }}
        >
          {locationOptions.map(l => <option key={l}>{l}</option>)}
        </select>

        <select
          className="ps-select"
          value={classFilter}
          onChange={e => { setClassFilter(e.target.value); resetPage() }}
        >
          {classOptions.map(c => <option key={c}>{c}</option>)}
        </select>

        <input
          className="ps-search"
          type="text"
          placeholder="Search store…"
          value={search}
          onChange={e => { setSearch(e.target.value); resetPage() }}
        />

        <button
          className="ps-export-btn"
          onClick={() => {
            const parts = [
              stateFilter    !== 'All' ? stateFilter    : null,
              locationFilter !== 'All' ? locationFilter : null,
              classFilter    !== 'All' ? classFilter    : null,
              search                   ? `"${search}"`  : null,
            ].filter(Boolean)
            exportPerfectStoreHTML({
              rows: sorted,
              cycleLabel: CYCLE_LABEL,
              filterDesc: parts.length ? parts.join(' · ') : 'All stores',
            })
          }}
        >
          Export HTML
        </button>
      </div>

      {error && (
        <div className="ps-error">Failed to load: {error}</div>
      )}

      {loading && !error && (
        <div className="ps-loading">Loading…</div>
      )}

      {!loading && !error && (
        <>
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead>
                <tr>
                  {COLS.map(col => (
                    <th
                      key={col.key}
                      className="ps-th-sortable"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}{thArrow(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr
                    key={r.store_id}
                    className="ps-row-clickable"
                    onClick={() => setSelectedStore({
                      id:     parseInt(r.store_id, 10),
                      name:   r.store_name  ?? '',
                      state:  r.state       ?? '',
                      chain:  '',
                      banner: '',
                      address:'',
                      region: '',
                      rep:    '',
                    })}
                  >
                    {COLS.map(col => (
                      <td
                        key={col.key}
                        className={col.key === 'total_opp' ? 'ps-total' : undefined}
                      >
                        {renderCell(r, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!visible.length && (
            <div className="ps-empty">No stores match your filters.</div>
          )}

          {hasMore && (
            <div className="ps-load-more">
              <button className="ps-load-btn" onClick={() => setPage(p => p + 1)}>
                Load more ({(sorted.length - visible.length).toLocaleString()} remaining)
              </button>
            </div>
          )}
        </>
      )}
      <StoreProfile store={selectedStore} onClose={() => setSelectedStore(null)} />
    </div>
  )
}
