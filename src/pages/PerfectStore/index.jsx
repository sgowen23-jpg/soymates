import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import './PerfectStore.css'

const PAGE_SIZE = 100

const fmtPct = v => v == null ? '—' : `${(v * 100).toFixed(1)}%`
const fmtNum = v => v == null ? '—' : v

export default function PerfectStore() {
  const [rows,       setRows]       = useState([])
  const [repOptions, setRepOptions] = useState([])
  const [repMap,     setRepMap]     = useState({}) // store_id string -> rep_name
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const [stateFilter, setStateFilter] = useState('All')
  const [repFilter,   setRepFilter]   = useState('All')
  const [classFilter, setClassFilter] = useState('All')
  const [search,      setSearch]      = useState('')
  const [page,        setPage]        = useState(1)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // Fetch all perfect_store_v2 rows (paginated in case table grows)
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

      // Rep options from rep_profiles
      const { data: repData } = await supabase.from('rep_profiles').select('rep_name')
      if (repData) {
        setRepOptions([...new Set(repData.map(r => r.rep_name).filter(Boolean))].sort())
      }

      // store_id -> rep_name map from stores table (for rep filter)
      const { data: storeData } = await supabase.from('stores').select('store_id, rep_name')
      if (storeData) {
        const map = {}
        storeData.forEach(s => { map[String(s.store_id)] = s.rep_name })
        setRepMap(map)
      }

      setLoading(false)
    }
    load()
  }, [])

  const stateOptions = useMemo(() => {
    const unique = [...new Set(rows.map(r => r.state).filter(Boolean))].sort()
    return ['All', ...unique]
  }, [rows])

  const classOptions = useMemo(() => {
    const unique = [...new Set(rows.map(r => r.classification).filter(Boolean))].sort()
    return ['All', ...unique]
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r => {
      if (stateFilter !== 'All' && r.state !== stateFilter) return false
      if (repFilter   !== 'All' && repMap[r.store_id] !== repFilter) return false
      if (classFilter !== 'All' && r.classification !== classFilter) return false
      if (q && !r.store_name?.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, stateFilter, repFilter, classFilter, search, repMap])

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < filtered.length

  function resetPage() { setPage(1) }

  return (
    <div className="ps-page">
      <div className="ps-header">
        <h1 className="ps-title">Perfect Store</h1>
        <p className="ps-sub">
          {loading ? 'Loading…' : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} stores`}
        </p>
      </div>

      <div className="ps-filters">
        <select
          className="ps-select"
          value={stateFilter}
          onChange={e => { setStateFilter(e.target.value); resetPage() }}
        >
          {stateOptions.map(s => <option key={s}>{s}</option>)}
        </select>

        <select
          className="ps-select"
          value={repFilter}
          onChange={e => { setRepFilter(e.target.value); resetPage() }}
        >
          <option>All</option>
          {repOptions.map(r => <option key={r}>{r}</option>)}
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
                  <th>State</th>
                  <th>Location</th>
                  <th>Store ID</th>
                  <th>Store Name</th>
                  <th>Classification</th>
                  <th>Focus Store</th>
                  <th>Distribution %</th>
                  <th>UHT Core Gaps</th>
                  <th>UHT NonCore Gaps</th>
                  <th>Chilled Opp</th>
                  <th>RTD Opp</th>
                  <th>Yoghurt Opp</th>
                  <th>Total Opp</th>
                  <th>UHT SOS</th>
                  <th>T/Up Previous</th>
                  <th>Call Freq Target</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.store_id}>
                    <td>{r.state           ?? '—'}</td>
                    <td>{r.location        ?? '—'}</td>
                    <td>{r.store_id}</td>
                    <td>{r.store_name      ?? '—'}</td>
                    <td>{r.classification  ?? '—'}</td>
                    <td>{r.focus_store     ?? '—'}</td>
                    <td>{fmtPct(r.distribution_pct)}</td>
                    <td>{fmtNum(r.uht_core_gaps)}</td>
                    <td>{fmtNum(r.uht_noncore_gaps)}</td>
                    <td>{fmtNum(r.chilled_opp)}</td>
                    <td>{fmtNum(r.rtd_opp)}</td>
                    <td>{fmtNum(r.yoghurt_opp)}</td>
                    <td className="ps-total">{fmtNum(r.total_opp)}</td>
                    <td>{r.uht_sos        ?? '—'}</td>
                    <td>{r.tup_previous   ?? '—'}</td>
                    <td>{fmtNum(r.call_freq_target)}</td>
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
                Load more ({(filtered.length - visible.length).toLocaleString()} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
