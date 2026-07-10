import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useClient } from '../context/ClientContext'
import { getProductCategory } from '../utils/productCategory'
import { getRules, isProductValidForStore } from '../utils/rangingRules'
import { parseBdfPrefix } from '../utils/bdfPrefix'
import './ByProductView.css'

const VITASOY_SEGMENTS = ['All', 'UHT Core', 'UHT', 'Fresh', 'Yoghurt']
const BDF_SEGMENTS     = ['All', 'Sea Salt', 'Must Have']

// Clean product display name (strip leading * and spaces)
function cleanName(p) { return p.replace(/^\*\s*/, '').trim() }

// Beiersdorf sub-range from product name prefix — shared parser, local shape
function bdfPrefix(name) {
  const { isSS, isMSL } = parseBdfPrefix(name)
  return { isS: isSS, isM: isMSL }
}

function bdfCategory(name) {
  const { isS, isM } = bdfPrefix(name)
  if (isS && isM) return 'SS+MH'
  if (isS) return 'Sea Salt'
  if (isM) return 'Must Have'
  return ''
}

function productMatchesSegment(name, pog, segment, client) {
  if (segment === 'All') return true
  if (client === 'beiersdorf') {
    const { isS, isM } = bdfPrefix(name)
    if (segment === 'Sea Salt')  return isS
    if (segment === 'Must Have') return isM
    return false
  }
  return getProductCategory(name, pog) === segment
}

// ─── Product multi-select dropdown ───────────────────────────────────────────
function ProductPicker({ allProducts, selected, onChange, segment, pogMap, client }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return allProducts
      .filter(p => productMatchesSegment(p, pogMap[p], segment, client))
      .filter(p => !s || cleanName(p).toLowerCase().includes(s))
  }, [allProducts, segment, search, pogMap, client])

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
                  <span className="bpv-picker-seg" data-seg={client === 'beiersdorf' ? bdfCategory(p) : getProductCategory(p, pogMap[p])}>
                    {client === 'beiersdorf' ? bdfCategory(p) : getProductCategory(p, pogMap[p])}
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
export default function ByProductView({ state, rep, classification }) {
  const { client } = useClient()
  const [segment, setSegment]             = useState('All')
  const [selectedProducts, setSelectedProducts] = useState([])
  const [allData, setAllData]             = useState([])
  const [pogMap, setPogMap]               = useState({})   // item_name → pog_category
  const [rules, setRules]                 = useState([])
  const [loading, setLoading]             = useState(false)
  const [sortDir, setSortDir]             = useState('desc')

  // Load distribution data and pog_category lookup in parallel
  useEffect(() => {
    async function load() {
      setLoading(true)

      const loadedRules = await getRules()

      // Beiersdorf: data lives in bnb_26wk, not store_distribution
      // State/rep filters are applied via the stores table (same approach as ListView)
      // because Beiersdorf bnb_26wk rows may not have those columns populated.
      if (client === 'beiersdorf') {
        let visibleNames = null  // null = no store-name filter (load all)
        if (state !== 'All' || rep !== 'All' || (classification && classification !== 'All')) {
          let storeQ = supabase.from('stores').select('store_name')
          if (state          !== 'All') storeQ = storeQ.eq('state', state)
          if (rep            !== 'All') storeQ = storeQ.eq('rep_name', rep)
          if (classification && classification !== 'All') storeQ = storeQ.eq('classification', classification)
          const { data: storeRows } = await storeQ
          visibleNames = (storeRows || []).map(s => s.store_name).filter(Boolean)
          if (!visibleNames.length) {
            setAllData([]); setPogMap({}); setRules(loadedRules); setLoading(false); return
          }
        }

        let all = [], from = 0
        while (true) {
          let q = supabase
            .from('bnb_26wk')
            .select('store_name, state, mso, rep_name, item_name, item_id, pog_category, sum_of_ranging, uploaded_at')
            .eq('client', 'beiersdorf')
            .range(from, from + 999)
          if (visibleNames) q = q.in('store_name', visibleNames)
          const { data } = await q
          if (!data || data.length === 0) break
          all = [...all, ...data]
          if (data.length < 1000) break
          from += 1000
        }

        // Keep only the latest upload snapshot
        if (all.length) {
          const maxUploaded = all.reduce((m, r) => r.uploaded_at > m ? r.uploaded_at : m, '')
          all = all.filter(r => r.uploaded_at === maxUploaded)
        }

        // Map to the shape ByProductView expects, using store_name as location_id
        const distData = all.map(r => ({
          location_id:          r.store_name,
          store_name:           r.store_name,
          state:                r.state,
          banner_group:         r.mso,
          rep_name:             r.rep_name,
          item_name:            r.item_name,
          item_code:            r.item_id,
          latest_distribution:  (r.sum_of_ranging ?? 0) > 0 ? 1 : 0,
        }))

        const nameMap = {}
        all.forEach(r => {
          if (r.item_name && r.pog_category && !nameMap[r.item_name])
            nameMap[r.item_name] = r.pog_category
        })

        setAllData(distData)
        setPogMap(nameMap)
        setRules(loadedRules)
        setLoading(false)
        return
      }

      // Vitasoy: if classification filter is active, resolve matching store IDs first
      let classificationIds = null
      if (classification && classification !== 'All') {
        const { data: storeRows } = await supabase
          .from('stores')
          .select('store_id')
          .eq('classification', classification)
        classificationIds = (storeRows || []).map(s => s.store_id)
        if (!classificationIds.length) {
          setAllData([]); setPogMap({}); setRules(loadedRules); setLoading(false); return
        }
      }

      // Vitasoy: fetch store_distribution + bnb_26wk pog lookup in parallel
      const [distData, pogRows] = await Promise.all([
        (async () => {
          let all = [], from = 0
          while (true) {
            let q = supabase
              .from('store_distribution')
              .select('location_id, store_name, state, banner_group, rep_name, item_name, item_code, latest_distribution')
              .eq('client', client)
              .range(from, from + 999)
            if (state !== 'All') q = q.eq('state', state)
            if (rep   !== 'All') q = q.eq('rep_name', rep)
            if (classificationIds) q = q.in('location_id', classificationIds)
            const { data } = await q
            if (!data || data.length === 0) break
            all = [...all, ...data]
            if (data.length < 1000) break
            from += 1000
          }
          return all
        })(),
        (async () => {
          let all = [], from = 0
          while (true) {
            const { data } = await supabase
              .from('bnb_26wk')
              .select('item_id, pog_category')
              .eq('client', client)
              .range(from, from + 999)
            if (!data || data.length === 0) break
            all = [...all, ...data]
            if (data.length < 1000) break
            from += 1000
          }
          return all
        })(),
      ])

      // Build item_code (string) → pog_category from bnb_26wk
      const itemCodeToPog = {}
      pogRows.forEach(r => {
        if (r.item_id && r.pog_category) itemCodeToPog[String(r.item_id)] = r.pog_category
      })

      // Build item_name → pog_category for use in getProductCategory calls
      const nameMap = {}
      distData.forEach(r => {
        if (r.item_name && r.item_code && !nameMap[r.item_name]) {
          const pog = itemCodeToPog[String(r.item_code)]
          if (pog) nameMap[r.item_name] = pog
        }
      })

      setAllData(distData)
      setPogMap(nameMap)
      setRules(loadedRules)
      setLoading(false)
    }
    load()
  }, [state, rep, classification, client])

  // All unique products in original order
  const allProducts = useMemo(() => {
    const seen = new Set()
    const list = []
    allData.forEach(r => {
      if (r.item_name && !seen.has(r.item_name)) { seen.add(r.item_name); list.push(r.item_name) }
    })
    return list
  }, [allData])

  const segments = client === 'beiersdorf' ? BDF_SEGMENTS : VITASOY_SEGMENTS

  // Reset segment when switching clients
  useEffect(() => { setSegment('All') }, [client])

  // Products available for the selected segment
  const segmentProducts = useMemo(() =>
    allProducts.filter(p => productMatchesSegment(p, pogMap[p], segment, client)),
    [allProducts, segment, pogMap, client]
  )

  // Clear product selection when segment changes
  useEffect(() => {
    setSelectedProducts(prev => prev.filter(p => segmentProducts.includes(p)))
  }, [segment])

  // Unique stores
  const storeMap = useMemo(() => {
    const map = {}
    allData.forEach(r => {
      if (!map[r.location_id]) {
        map[r.location_id] = { store_id: r.location_id, store_name: r.store_name, state: r.state, mso: r.banner_group, rep_name: r.rep_name }
      }
    })
    return map
  }, [allData])

  // Ranging map: store_id → product → bool
  const rangingMap = useMemo(() => {
    const map = {}
    allData.forEach(r => {
      if (!map[r.location_id]) map[r.location_id] = {}
      map[r.location_id][r.item_name] = !!r.latest_distribution
    })
    return map
  }, [allData])

  // Gap rows — stores missing ≥1 selected product (respects ranging rules)
  const gapRows = useMemo(() => {
    if (!selectedProducts.length) return []
    return Object.values(storeMap)
      .map(store => {
        const storeCtx = { state: store.state, banner: store.mso || '' }
        const validProducts = selectedProducts.filter(p =>
          isProductValidForStore(p, getProductCategory(p, pogMap[p]), storeCtx, rules)
        )
        const missing = validProducts.filter(p => !rangingMap[store.store_id]?.[p])
        const ranged  = validProducts.filter(p =>  rangingMap[store.store_id]?.[p])
        return { ...store, missing, ranged, gapCount: missing.length }
      })
      .filter(s => s.gapCount > 0)
      .sort((a, b) => sortDir === 'desc' ? b.gapCount - a.gapCount : a.gapCount - b.gapCount)
  }, [storeMap, rangingMap, selectedProducts, sortDir, rules, pogMap])

  const totalStores = Object.keys(storeMap).length

  return (
    <div className="bpv-wrap">

      {/* ── Segment + Product filters ── */}
      <div className="bpv-filters">
        <div className="bpv-segment-tabs">
          {segments.map(s => (
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
          pogMap={pogMap}
          client={client}
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
