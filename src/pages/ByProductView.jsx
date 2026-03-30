import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import './ByProductView.css'

// Segment classification from product name
function getSegment(p) {
  if (/ygt/i.test(p))              return 'Yoghurt'
  if (/frsh|esl/i.test(p))         return 'Fresh'
  if (p.trimStart().startsWith('*') && /uht/i.test(p)) return 'UHT Core'
  if (/uht/i.test(p))              return 'UHT'
  return 'Other'
}

const SEGMENTS = ['All', 'UHT Core', 'UHT', 'Fresh', 'Yoghurt']

// Clean product display name (strip leading * and spaces)
function cleanName(p) { return p.replace(/^\*\s*/, '').trim() }

// ─── Product multi-select dropdown ───────────────────────────────────────────
function ProductPicker({ allProducts, selected, onChange, segment }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return allProducts
      .filter(p => (segment === 'All' || getSegment(p) === segment))
      .filter(p => !s || cleanName(p).toLowerCase().includes(s))
  }, [allProducts, segment, search])

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle(p) {
    onChange(selected.includes(p) ? selected.filter(x => x !== p) : [...selected, p])
  }
  function selectAll()   { onChange(filtered.map(p => p)) }
  function clearAll()    { onChange([]) }

  const label = selected.length === 0
    ? 'Select products…'
    : selected.length === 1
      ? cleanName(selected[0])
      : `${selected.length} products selected`

  return (
    <div className="bpv-picker-wrap" ref={ref}>
      <button className="bpv-picker-btn" onClick={() => setOpen(o => !o)}>
        <span className="bpv-picker-label">{label}</span>
        <span className="bpv-picker-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="bpv-picker-drop">
          <div className="bpv-picker-search-row">
            <input
              className="bpv-picker-search"
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="bpv-picker-actions">
            <button className="bpv-picker-action" onClick={selectAll}>Select all</button>
            <button className="bpv-picker-action" onClick={clearAll}>Clear</button>
          </div>
          <div className="bpv-picker-list">
            {filtered.length === 0
              ? <div className="bpv-picker-empty">No products found</div>
              : filtered.map(p => (
                <label key={p} className="bpv-picker-item">
                  <input
                    type="checkbox"
                    checked={selected.includes(p)}
                    onChange={() => toggle(p)}
                  />
                  <span className="bpv-picker-seg" data-seg={getSegment(p)}>
                    {getSegment(p)}
                  </span>
                  <span className="bpv-picker-name">{cleanName(p)}</span>
                </label>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ─── By Product View ──────────────────────────────────────────────────────────
export default function ByProductView({ state, rep }) {
  const [segment, setSegment]             = useState('All')
  const [selectedProducts, setSelectedProducts] = useState([])
  const [allData, setAllData]             = useState([])   // all store_distribution rows
  const [loading, setLoading]             = useState(false)
  const [sortDir, setSortDir]             = useState('desc')

  // Load all distribution data for state/rep filter
  useEffect(() => {
    async function load() {
      setLoading(true)
      let all = [], from = 0
      while (true) {
        let q = supabase
          .from('store_distribution')
          .select('store_id, store_name, state, mso, rep_name, product, ranging')
          .range(from, from + 999)
        if (state !== 'All') q = q.eq('state', state)
        if (rep   !== 'All') q = q.eq('rep_name', rep)
        const { data } = await q
        if (!data || data.length === 0) break
        all = [...all, ...data]
        if (data.length < 1000) break
        from += 1000
      }
      setAllData(all)
      setLoading(false)
    }
    load()
  }, [state, rep])

  // All unique products in original order
  const allProducts = useMemo(() => {
    const seen = new Set()
    const list = []
    allData.forEach(r => {
      if (!seen.has(r.product)) { seen.add(r.product); list.push(r.product) }
    })
    return list
  }, [allData])

  // Products available for the selected segment
  const segmentProducts = useMemo(() =>
    allProducts.filter(p => segment === 'All' || getSegment(p) === segment),
    [allProducts, segment]
  )

  // Clear product selection when segment changes
  useEffect(() => {
    setSelectedProducts(prev => prev.filter(p => segmentProducts.includes(p)))
  }, [segment])

  // Unique stores
  const storeMap = useMemo(() => {
    const map = {}
    allData.forEach(r => {
      if (!map[r.store_id]) {
        map[r.store_id] = { store_id: r.store_id, store_name: r.store_name, state: r.state, mso: r.mso, rep_name: r.rep_name }
      }
    })
    return map
  }, [allData])

  // Ranging map: store_id → product → bool
  const rangingMap = useMemo(() => {
    const map = {}
    allData.forEach(r => {
      if (!map[r.store_id]) map[r.store_id] = {}
      map[r.store_id][r.product] = !!r.ranging
    })
    return map
  }, [allData])

  // Gap rows — stores missing ≥1 selected product
  const gapRows = useMemo(() => {
    if (!selectedProducts.length) return []
    return Object.values(storeMap)
      .map(store => {
        const missing = selectedProducts.filter(p => !rangingMap[store.store_id]?.[p])
        const ranged  = selectedProducts.filter(p =>  rangingMap[store.store_id]?.[p])
        return { ...store, missing, ranged, gapCount: missing.length }
      })
      .filter(s => s.gapCount > 0)
      .sort((a, b) => sortDir === 'desc' ? b.gapCount - a.gapCount : a.gapCount - b.gapCount)
  }, [storeMap, rangingMap, selectedProducts, sortDir])

  const totalStores = Object.keys(storeMap).length

  return (
    <div className="bpv-wrap">

      {/* ── Segment + Product filters ── */}
      <div className="bpv-filters">
        <div className="bpv-segment-tabs">
          {SEGMENTS.map(s => (
            <button
              key={s}
              className={`bpv-seg-tab ${segment === s ? 'active' : ''}`}
              onClick={() => setSegment(s)}
            >{s}</button>
          ))}
        </div>
        <ProductPicker
          allProducts={segmentProducts}
          selected={selectedProducts}
          onChange={setSelectedProducts}
          segment={segment}
        />
        {selectedProducts.length > 0 && (
          <button className="bpv-clear-btn" onClick={() => setSelectedProducts([])}>
            Clear selection
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="bpv-loading">
          <div className="bpv-spinner" />
          <span>Loading distribution data…</span>
        </div>
      ) : selectedProducts.length === 0 ? (
        <div className="bpv-empty">
          <span className="bpv-empty-icon">🔍</span>
          <p>Select one or more products above to see ranging gaps</p>
          <p className="bpv-empty-sub">{totalStores.toLocaleString()} stores loaded{state !== 'All' ? ` · ${state}` : ''}{rep !== 'All' ? ` · ${rep}` : ''}</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bpv-summary">
            <span className="bpv-summary-count">{gapRows.length}</span>
            {' '}stores missing at least one of{' '}
            <span className="bpv-summary-count">{selectedProducts.length}</span>
            {' '}selected product{selectedProducts.length !== 1 ? 's' : ''}
            {gapRows.length === 0 && <span className="bpv-all-good"> ✓ All stores ranged!</span>}
          </div>

          {gapRows.length > 0 && (
            <div className="bpv-table-wrap">
              <table className="bpv-table">
                <thead>
                  <tr>
                    <th className="bpv-th bpv-th-store">Store</th>
                    <th className="bpv-th bpv-th-state">State</th>
                    <th className="bpv-th bpv-th-rep">Rep</th>
                    {selectedProducts.map(p => (
                      <th key={p} className="bpv-th bpv-th-prod" title={cleanName(p)}>
                        {cleanName(p)}
                      </th>
                    ))}
                    <th
                      className="bpv-th bpv-th-gaps"
                      onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                      style={{ cursor: 'pointer' }}
                    >
                      Gaps {sortDir === 'desc' ? '↓' : '↑'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gapRows.map(row => (
                    <tr key={row.store_id} className="bpv-row">
                      <td className="bpv-td bpv-td-store">{row.store_name}</td>
                      <td className="bpv-td bpv-td-state">{row.state}</td>
                      <td className="bpv-td bpv-td-rep">{row.rep_name || '—'}</td>
                      {selectedProducts.map(p => {
                        const has = rangingMap[row.store_id]?.[p]
                        return (
                          <td key={p} className="bpv-td bpv-td-pill">
                            <span className={`bpv-pill ${has ? 'ranged' : 'missing'}`}>
                              {has ? '✓' : '✗'}
                            </span>
                          </td>
                        )
                      })}
                      <td className="bpv-td bpv-td-gaps">
                        <span className="bpv-gap-count">{row.gapCount}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
