import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import './FocusStores.css'

// ─── Constants ────────────────────────────────────────────────────────────────
const STATES = ['All States', 'New South Wales', 'Queensland', 'South Australia', 'Victoria', 'Western Australia']
const STATE_SHORT = { 'New South Wales': 'NSW', 'Queensland': 'QLD', 'South Australia': 'SA', 'Victoria': 'VIC', 'Western Australia': 'WA' }

const STRATEGY_META = {
  'PERFECT STORE': { color: '#16a085', bg: '#e8f8f5', label: 'Perfect Store' },
  'DEVELOP':       { color: '#2980b9', bg: '#ebf5fb', label: 'Develop' },
  'GROW':          { color: '#e67e22', bg: '#fef9e7', label: 'Grow' },
  'EXPAND':        { color: '#8e44ad', bg: '#f5eef8', label: 'Expand' },
}

const STATUS_META = {
  'Not Started': { color: '#888',    bg: '#f4f6f7' },
  'In Progress': { color: '#2980b9', bg: '#ebf5fb' },
  'Won':         { color: '#16a085', bg: '#e8f8f5' },
  'Lost':        { color: '#CC0000', bg: '#fdedec' },
}

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Won', 'Lost']

function strategyMeta(s) {
  if (!s) return { color: '#888', bg: '#f4f6f7', label: s || '—' }
  const key = Object.keys(STRATEGY_META).find(k => s.toUpperCase().includes(k))
  return key ? { ...STRATEGY_META[key] } : { color: '#888', bg: '#f4f6f7', label: s }
}

function fmt$(val) {
  if (val == null || val === '') return '—'
  return `$${Number(val).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDec(val, dp = 2) {
  if (val == null) return '—'
  return `$${Number(val).toFixed(dp)}`
}

// ─── Strategy Pill ────────────────────────────────────────────────────────────
function StratPill({ value }) {
  const m = strategyMeta(value)
  return (
    <span className="fs-strat-pill" style={{ color: m.color, background: m.bg }}>
      {m.label || value || '—'}
    </span>
  )
}

// ─── Status Dropdown ──────────────────────────────────────────────────────────
function StatusCell({ storeId, current, onChange }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function handleChange(e) {
    const val = e.target.value || null
    setSaving(true)
    const { error } = await supabase
      .from('perfect_store')
      .update({ focus_store_status: val })
      .eq('store_id', storeId)
      .eq('cycle', 4)
    setSaving(false)
    if (!error) {
      onChange(storeId, val)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const m = current ? STATUS_META[current] : null

  return (
    <div className="fs-status-cell">
      <select
        className="fs-status-select"
        value={current ?? ''}
        onChange={handleChange}
        disabled={saving}
        style={m ? { color: m.color, background: m.bg, borderColor: m.color + '44' } : {}}
      >
        <option value="">— Set status —</option>
        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {saving && <span className="fs-saving">…</span>}
      {saved  && <span className="fs-saved">✓</span>}
    </div>
  )
}

// ─── GSV Tab ─────────────────────────────────────────────────────────────────
function GsvTab({ stores }) {
  const byState = useMemo(() => {
    const map = {}
    stores.forEach(s => {
      const st = s.state || 'Unknown'
      if (!map[st]) map[st] = []
      map[st].push(s)
    })
    return Object.entries(map)
      .map(([state, rows]) => {
        const gsv    = rows.reduce((sum, r) => sum + (r.gsv_potential || 0), 0)
        const sales  = rows.reduce((sum, r) => sum + (r.assumed_sales || 0), 0)
        const top    = Math.max(...rows.map(r => r.gsv_potential || 0))
        const avg    = rows.length ? gsv / rows.length : 0
        return { state, count: rows.length, sales, gsv, avg, top }
      })
      .sort((a, b) => b.gsv - a.gsv)
  }, [stores])

  const totals = useMemo(() => ({
    count: byState.reduce((s, r) => s + r.count, 0),
    sales: byState.reduce((s, r) => s + r.sales, 0),
    gsv:   byState.reduce((s, r) => s + r.gsv, 0),
    avg:   byState.length ? byState.reduce((s, r) => s + r.gsv, 0) / byState.reduce((s, r) => s + r.count, 0) : 0,
    top:   Math.max(...byState.map(r => r.top)),
  }), [byState])

  return (
    <div className="fs-gsv-wrap">
      <div className="fs-gsv-cards">
        <div className="fs-gsv-card fs-gsv-card--blue">
          <div className="fs-gsv-card-val">{totals.count}</div>
          <div className="fs-gsv-card-lbl">Total Focus Stores</div>
        </div>
        <div className="fs-gsv-card fs-gsv-card--green">
          <div className="fs-gsv-card-val">{fmtDec(totals.gsv)}</div>
          <div className="fs-gsv-card-lbl">Total GSV Opportunity</div>
        </div>
        <div className="fs-gsv-card fs-gsv-card--orange">
          <div className="fs-gsv-card-val">{fmtDec(totals.avg)}</div>
          <div className="fs-gsv-card-lbl">Avg GSV per Store</div>
        </div>
        <div className="fs-gsv-card fs-gsv-card--purple">
          <div className="fs-gsv-card-val">{fmt$(Math.round(totals.sales / 52))}/wk</div>
          <div className="fs-gsv-card-lbl">Total Assumed Sales</div>
        </div>
      </div>

      <div className="fs-table-wrap">
        <table className="fs-table">
          <thead>
            <tr>
              <th>State</th>
              <th className="fs-num">Focus Stores</th>
              <th className="fs-num">Total Assumed Sales</th>
              <th className="fs-num">Total GSV Opp $</th>
              <th className="fs-num">Avg GSV per Store $</th>
              <th className="fs-num">Top Store GSV $</th>
            </tr>
          </thead>
          <tbody>
            {byState.map(r => (
              <tr key={r.state}>
                <td>
                  <span className="fs-state-badge">{STATE_SHORT[r.state] || r.state}</span>
                  <span className="fs-state-full">{r.state}</span>
                </td>
                <td className="fs-num">{r.count}</td>
                <td className="fs-num">{fmt$(Math.round(r.sales))}</td>
                <td className="fs-num fs-gsv-val">{fmtDec(r.gsv)}</td>
                <td className="fs-num">{fmtDec(r.avg)}</td>
                <td className="fs-num">{fmtDec(r.top)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="fs-totals-row">
              <td><strong>TOTAL</strong></td>
              <td className="fs-num"><strong>{totals.count}</strong></td>
              <td className="fs-num"><strong>{fmt$(Math.round(totals.sales))}</strong></td>
              <td className="fs-num fs-gsv-val"><strong>{fmtDec(totals.gsv)}</strong></td>
              <td className="fs-num"><strong>{fmtDec(totals.avg)}</strong></td>
              <td className="fs-num"><strong>{fmtDec(totals.top)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="fs-gsv-note">
        GSV Opportunity = potential first-order GSV from ranging gaps. Source: Cycle 4 Perfect Store Pipeline.
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FocusStores() {
  const [tab, setTab]             = useState('tracker')
  const [stores, setStores]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [stateF, setStateF]       = useState('All States')
  const [stratF, setStratF]       = useState('All')
  const [sortKey, setSortKey]     = useState('vitasoy_rank')
  const [sortDir, setSortDir]     = useState('asc')

  // Load focus stores from perfect_store cycle=4 where focus_store is set
  useEffect(() => {
    async function load() {
      setLoading(true)
      let all = [], from = 0
      while (true) {
        const { data, error } = await supabase
          .from('perfect_store')
          .select('store_id,store_name,state,mso,banner,strategy_c4,vitasoy_rank,assumed_sales,gsv_potential,uht_core,uht_noncore,chilled,rtd,yoghurt,total_ranging,call_fqy_target,c4_call_fqy,focus_store,focus_store_status')
          .eq('cycle', 4)
          .not('focus_store', 'is', null)
          .order('vitasoy_rank', { ascending: true })
          .range(from, from + 499)
        if (error || !data || data.length === 0) break
        all = [...all, ...data]
        if (data.length < 500) break
        from += 500
      }
      setStores(all)
      setLoading(false)
    }
    load()
  }, [])

  // Optimistic status update — avoid refetching entire table
  const handleStatusChange = useCallback((storeId, newStatus) => {
    setStores(prev => prev.map(s =>
      s.store_id === storeId ? { ...s, focus_store_status: newStatus } : s
    ))
  }, [])

  // KPI cards
  const kpis = useMemo(() => {
    const won   = stores.filter(s => s.focus_store_status === 'Won').length
    const gsv   = stores.reduce((sum, s) => sum + (s.gsv_potential || 0), 0)
    const avg   = stores.length ? gsv / stores.length : 0
    return { total: stores.length, gsv, avg, won }
  }, [stores])

  // Unique strategies for filter
  const strategies = useMemo(() => {
    const s = new Set(stores.map(s => {
      const key = Object.keys(STRATEGY_META).find(k => (s.strategy_c4 || '').toUpperCase().includes(k))
      return key || null
    }).filter(Boolean))
    return ['All', ...Array.from(s)]
  }, [stores])

  // Filtered + sorted
  const filtered = useMemo(() => {
    let list = stores.filter(s => {
      if (stateF !== 'All States' && s.state !== stateF) return false
      if (stratF !== 'All') {
        const key = Object.keys(STRATEGY_META).find(k => (s.strategy_c4 || '').toUpperCase().includes(k))
        if (key !== stratF) return false
      }
      return true
    })

    return [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (av == null) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv == null) bv = sortDir === 'asc' ? Infinity : -Infinity
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [stores, stateF, stratF, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortHead({ col, label, right }) {
    const active = sortKey === col
    return (
      <th className={`fs-sortable${right ? ' fs-num' : ''}`} onClick={() => toggleSort(col)}>
        {label}
        <span className="fs-sort-icon">
          {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
        </span>
      </th>
    )
  }

  if (loading) return (
    <div className="fs-page">
      <div className="fs-loading">
        <div className="fs-spinner" />
        <p>Loading focus stores…</p>
      </div>
    </div>
  )

  return (
    <div className="fs-page">

      {/* ── Page header ── */}
      <div className="fs-header">
        <div>
          <h1 className="fs-title">Focus Stores — Cycle 4</h1>
          <p className="fs-sub">{stores.length} stores · Cycle 4 pipeline</p>
        </div>
        <div className="fs-tabs">
          <button className={`fs-tab${tab === 'tracker' ? ' active' : ''}`} onClick={() => setTab('tracker')}>
            Focus Stores
          </button>
          <button className={`fs-tab${tab === 'gsv' ? ' active' : ''}`} onClick={() => setTab('gsv')}>
            GSV Summary
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="fs-kpis">
        <div className="fs-kpi fs-kpi--blue">
          <div className="fs-kpi-val">{kpis.total}</div>
          <div className="fs-kpi-lbl">Total Focus Stores</div>
        </div>
        <div className="fs-kpi fs-kpi--green">
          <div className="fs-kpi-val">{fmtDec(kpis.gsv)}</div>
          <div className="fs-kpi-lbl">Total GSV Opportunity $</div>
        </div>
        <div className="fs-kpi fs-kpi--orange">
          <div className="fs-kpi-val">{fmtDec(kpis.avg)}</div>
          <div className="fs-kpi-lbl">Avg GSV per Store $</div>
        </div>
        <div className="fs-kpi fs-kpi--emerald">
          <div className="fs-kpi-val">{kpis.won}</div>
          <div className="fs-kpi-lbl">Stores Won ✓</div>
        </div>
      </div>

      {tab === 'gsv' ? (
        <GsvTab stores={stores} />
      ) : (
        <>
          {/* ── Filters ── */}
          <div className="fs-filters">
            <select className="fs-select" value={stateF} onChange={e => setStateF(e.target.value)}>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="fs-select" value={stratF} onChange={e => setStratF(e.target.value)}>
              <option value="All">All Strategies</option>
              {strategies.filter(s => s !== 'All').map(s => (
                <option key={s} value={s}>{STRATEGY_META[s]?.label || s}</option>
              ))}
            </select>
            <span className="fs-result-count">{filtered.length} stores</span>
          </div>

          {/* ── Table ── */}
          <div className="fs-table-wrap">
            <table className="fs-table">
              <thead>
                <tr>
                  <SortHead col="state"        label="State" />
                  <SortHead col="store_name"   label="Store Name" />
                  <SortHead col="mso"          label="MSO" />
                  <SortHead col="banner"       label="Banner" />
                  <SortHead col="strategy_c4"  label="Strategy C4" />
                  <SortHead col="assumed_sales" label="Sales/Wk" right />
                  <SortHead col="gsv_potential" label="GSV Opp $" right />
                  <SortHead col="total_ranging" label="Ranging" right />
                  <SortHead col="call_fqy_target" label="Call Target" right />
                  <SortHead col="c4_call_fqy"  label="C4 Calls" right />
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} className="fs-empty">No stores match filters.</td></tr>
                ) : filtered.map(s => (
                  <tr key={`${s.store_id}-${s.cycle}`} className="fs-row">
                    <td>
                      <span className="fs-state-badge">{STATE_SHORT[s.state] || s.state}</span>
                    </td>
                    <td className="fs-store-name" title={s.store_name}>{s.store_name}</td>
                    <td className="fs-muted">{s.mso || '—'}</td>
                    <td className="fs-muted">{s.banner || '—'}</td>
                    <td><StratPill value={s.strategy_c4} /></td>
                    <td className="fs-num">{fmt$(s.assumed_sales)}</td>
                    <td className="fs-num fs-gsv-val">{fmtDec(s.gsv_potential)}</td>
                    <td className="fs-num">
                      <span className={`fs-ranging ${(s.total_ranging || 0) >= 28 ? 'fs-ranging--good' : (s.total_ranging || 0) >= 20 ? 'fs-ranging--ok' : 'fs-ranging--low'}`}>
                        {s.total_ranging ?? '—'}/30
                      </span>
                    </td>
                    <td className="fs-num">{s.call_fqy_target != null ? `${s.call_fqy_target}×` : '—'}</td>
                    <td className="fs-num">{s.c4_call_fqy ?? '—'}</td>
                    <td>
                      <StatusCell
                        storeId={s.store_id}
                        current={s.focus_store_status}
                        onChange={handleStatusChange}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
