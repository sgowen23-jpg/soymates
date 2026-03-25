import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import './PerfectStore.css'

// ─── Constants ────────────────────────────────────────────────────────────────
const STRATEGY_META = {
  'PERFECT STORE': { color: '#16a085', bg: '#e8f8f5', icon: '🏆', order: 0 },
  'GROW':          { color: '#2980b9', bg: '#ebf5fb', icon: '📈', order: 1 },
  'DEVELOP':       { color: '#e67e22', bg: '#fef9e7', icon: '🔧', order: 2 },
  'EXPAND':        { color: '#CC0000', bg: '#fdedec', icon: '🔴', order: 3 },
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PerfectStore() {
  const [stores, setStores]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [search, setSearch]         = useState('')
  const [stateFilter, setStateFilter] = useState('All States')
  const [stratFilter, setStratFilter] = useState('All')
  const [bannerFilter, setBannerFilter] = useState('All')
  const [sortKey, setSortKey]       = useState('vitasoy_rank')
  const [sortDir, setSortDir]       = useState('asc')

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Fetch all stores (777 rows – small enough for one call)
      let all = []
      let from = 0
      const PAGE = 500
      while (true) {
        const { data, error } = await supabase
          .from('perfect_store')
          .select('*')
          .order('vitasoy_rank', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error || !data || data.length === 0) break
        all = [...all, ...data]
        if (data.length < PAGE) break
        from += PAGE
      }
      setStores(all)
      setLoading(false)
    }
    load()
  }, [])

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
  }, [stores, stateFilter, stratFilter, bannerFilter, search, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortHead({ col, label }) {
    const active = sortKey === col
    return (
      <th className={`ps-th sortable ${active ? 'sorted' : ''}`} onClick={() => toggleSort(col)}>
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    )
  }

  const detail = selected ? stores.find(s => s.id === selected) : null

  if (loading) return <div className="ps-loading"><div className="ps-spinner" /><p>Loading Perfect Store data…</p></div>

  return (
    <div className="ps-page">
      {/* Header */}
      <div className="ps-header">
        <div>
          <h1 className="ps-title">Perfect Store — Cycle 4</h1>
          <p className="ps-sub">{stores.length} stores · Data to 15 Mar 2026</p>
        </div>
      </div>

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
        {(stratFilter !== 'All' || stateFilter !== 'All States' || bannerFilter !== 'All' || search) && (
          <button className="ps-clear-btn" onClick={() => { setStratFilter('All'); setStateFilter('All States'); setBannerFilter('All'); setSearch('') }}>
            Clear filters
          </button>
        )}
        <span className="ps-result-count">{filtered.length} stores</span>
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
                <th className="ps-th">Calls</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
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
                    <td className="ps-calls">{s.call_fqy_target ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="ps-empty">No stores match your filters</div>
          )}
        </div>

        {detail && <StorePanel store={detail} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}
