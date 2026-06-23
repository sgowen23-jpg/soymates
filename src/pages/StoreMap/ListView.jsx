import { useState, useMemo, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useClient } from '../../context/ClientContext'
import { getProductCategory } from '../../utils/productCategory'
import { getRules, isProductValidForStore } from '../../utils/rangingRules'
import { chainColor } from './chainColors'
import StoreSearchInput from '../../components/StoreSearchInput'
import './ListView.css'

const BDF_CATS = ['All', 'Sea Salt', 'Must Have']
const BDF_POG_SET = new Set(['deodorants', 'lip care', 'medicinal', 'men grooming', 'skincare', 'sun care'])

function rowMatchesBdfCat(row, cat) {
  if (cat === 'All') return true
  const prefix = (row.item_name || '').match(/^\(\s*([^)]+)\)/i)
  if (cat === 'Sea Salt')  return !!(prefix && prefix[1].toUpperCase().includes('S'))
  if (cat === 'Must Have') return !!(prefix && prefix[1].toUpperCase().includes('M'))
  if (cat === 'Other') return !BDF_POG_SET.has((row.pog_category || '').toLowerCase())
  return (row.pog_category || '').toLowerCase() === cat.toLowerCase()
}

export default function ListView({ onStoreClick, filters, hideSearch, bnbPeriod }) {
  const { client } = useClient()
  const [stores, setStores] = useState([])
  const [search, setSearch] = useState('')
  const [chainFilter, setChainFilter] = useState('')
  const [chainSearch, setChainSearch] = useState('')
  const [chainOpen, setChainOpen] = useState(false)
  const chainWrapRef = useRef(null)
  const [bdfCat, setBdfCat] = useState('All')
  const bdfCacheRef = useRef([])
  const [sortCol, setSortCol] = useState('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [gapMap, setGapMap] = useState({})
  const [ssGapMap, setSsGapMap] = useState({})
  const [mhGapMap, setMhGapMap] = useState({})
  const [loading, setLoading] = useState(true)

  const ALL_CHAINS = useMemo(() => [...new Set(stores.map(s => s.chain))].filter(Boolean).sort(), [stores])

  // Fetch store list from Supabase once on mount
  useEffect(() => {
    supabase.from('stores')
      .select('store_id, store_name, state, store_region, rep_name, mso, suburb, banner, classification')
      .then(({ data }) => {
        setStores((data || []).map(s => ({
          id:             s.store_id,
          name:           s.store_name,
          state:          s.state,
          region:         s.store_region,
          rep:            s.rep_name,
          chain:          s.mso || '',
          banner:         s.banner || '',
          suburb:         s.suburb || '',
          classification: s.classification || '',
        })))
      })
  }, [])

  useEffect(() => {
    async function fetchGaps() {
      setLoading(true)
      // Only fetch distribution data for stores visible under current filters —
      // avoids a full table scan when a state or rep filter is active
      const matchesFilters = s => {
        const matchState          = !filters?.state          || filters.state          === 'All' || s.state          === filters.state
        const matchRep            = !filters?.rep            || filters.rep            === 'All' || s.rep            === filters.rep
        const matchClassification = !filters?.classification || filters.classification === 'All' || s.classification === filters.classification
        return matchState && matchRep && matchClassification
      }

      const visibleIds = stores.filter(matchesFilters).map(s => s.id)

      if (!visibleIds.length) { setGapMap({}); setLoading(false); return }

      const storeById = {}
      stores.forEach(s => { storeById[String(s.id)] = s })

      const map = {}

      // ── Beiersdorf 26wk gap path ───────────────────────────────────────────
      if (client === 'beiersdorf' && bnbPeriod === '26wk') {
        bdfCacheRef.current = []  // reset cache before fresh fetch

        const visibleNames = stores.filter(matchesFilters).map(s => s.name)

        const storeIdByName = {}
        stores.forEach(s => { storeIdByName[s.name] = String(s.id) })

        let all = [], from = 0
        while (true) {
          const { data: batch } = await supabase
            .from('bnb_26wk')
            .select('store_name, item_name, pog_category, ranging_gap, uploaded_at')
            .eq('client', 'beiersdorf')
            .in('store_name', visibleNames)
            .range(from, from + 999)
          if (!batch || batch.length === 0) break
          all = [...all, ...batch]
          if (batch.length < 1000) break
          from += 1000
        }

        if (all.length) {
          const maxUploaded = all.reduce((m, r) => r.uploaded_at > m ? r.uploaded_at : m, '')
          const latestRows = all.filter(r => r.uploaded_at === maxUploaded)
          bdfCacheRef.current = latestRows  // cache for bdfCat changes

          const ssMap = {}, mhMap = {}
          latestRows.forEach(r => {
            const storeId = storeIdByName[r.store_name]
            if (!storeId) return
            const isGap = (r.ranging_gap ?? 0) > 0
            const prefix = (r.item_name || '').match(/^\(\s*([^)]+)\)/i)
            const p = prefix ? prefix[1].toUpperCase() : ''
            if (p.includes('S')) { if (ssMap[storeId] === undefined) ssMap[storeId] = 0; if (isGap) ssMap[storeId]++ }
            if (p.includes('M')) { if (mhMap[storeId] === undefined) mhMap[storeId] = 0; if (isGap) mhMap[storeId]++ }
            if (map[storeId] === undefined) map[storeId] = 0
            if (isGap) map[storeId]++
          })
          setSsGapMap(ssMap)
          setMhGapMap(mhMap)
        }

        setGapMap(map)
        setLoading(false)
        return
      }

      if (bnbPeriod === 'dis' || !bnbPeriod) {
        const [distData, pogRows, rules] = await Promise.all([
          (async () => {
            let all = [], from = 0
            while (true) {
              const { data: batch } = await supabase
                .from('store_distribution')
                .select('location_id, item_name, item_code, latest_distribution')
                .in('location_id', visibleIds)
                .range(from, from + 999)
              if (!batch || batch.length === 0) break
              all = [...all, ...batch]
              if (batch.length < 1000) break
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
          getRules(),
        ])

        const itemCodeToPog = {}
        pogRows.forEach(r => {
          if (r.item_id && r.pog_category) itemCodeToPog[String(r.item_id)] = r.pog_category
        })
        const pogMap = {}
        distData.forEach(r => {
          if (r.item_name && r.item_code && !pogMap[r.item_name]) {
            const pog = itemCodeToPog[String(r.item_code)]
            if (pog) pogMap[r.item_name] = pog
          }
        })

        distData.forEach(r => {
          const id = String(r.location_id)
          if (map[id] === undefined) map[id] = 0
          if (r.latest_distribution !== 0) return
          const store = storeById[id]
          if (!store) return
          const cat = getProductCategory(r.item_name, pogMap[r.item_name], r.item_code)
          if (isProductValidForStore(r.item_name, cat, { state: store.state, banner: store.banner }, rules))
            map[id]++
        })
      } else {
        // 13wk or 26wk — BNB tables carry item_name and pog_category directly
        const table = bnbPeriod === '13wk' ? 'bnb_13wk' : 'bnb_26wk'
        const [bnbData, rules] = await Promise.all([
          (async () => {
            let all = [], from = 0
            while (true) {
              const { data: batch } = await supabase
                .from(table)
                .select('store_id, item_id, item_name, pog_category, sum_of_ranging')
                .in('store_id', visibleIds)
                .range(from, from + 999)
              if (!batch || batch.length === 0) break
              all = [...all, ...batch]
              if (batch.length < 1000) break
              from += 1000
            }
            return all
          })(),
          getRules(),
        ])

        bnbData.forEach(r => {
          const id = String(r.store_id)
          if (map[id] === undefined) map[id] = 0
          if (r.sum_of_ranging !== 0) return
          const store = storeById[id]
          if (!store) return
          const cat = getProductCategory(r.item_name, r.pog_category, r.item_id)
          if (isProductValidForStore(r.item_name, cat, { state: store.state, banner: store.banner }, rules))
            map[id]++
        })
      }

      setGapMap(map)
      setLoading(false)
    }
    fetchGaps()
  }, [stores, filters?.state, filters?.rep, filters?.classification, bnbPeriod, client])


  useEffect(() => {
    function onClickOutside(e) {
      if (chainWrapRef.current && !chainWrapRef.current.contains(e.target)) setChainOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const chainOptions = useMemo(() => {
    const q = chainSearch.toLowerCase()
    return q ? ALL_CHAINS.filter(c => c.toLowerCase().includes(q)) : ALL_CHAINS
  }, [ALL_CHAINS, chainSearch])

  function selectChain(c) {
    setChainFilter(c)
    setChainSearch('')
    setChainOpen(false)
  }

  const filtered = useMemo(() => {
    const q = (search || filters?.search || '').toLowerCase()
    return stores.filter(s => {
      const matchSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        s.suburb.toLowerCase().includes(q) ||
        s.state.toLowerCase().includes(q)
      const matchChain = !chainFilter || s.chain === chainFilter
      const matchState          = !filters?.state          || filters.state          === 'All' || s.state          === filters.state
      const matchRep            = !filters?.rep            || filters.rep            === 'All' || s.rep            === filters.rep
      const matchClassification = !filters?.classification || filters.classification === 'All' || s.classification === filters.classification
      return matchSearch && matchChain && matchState && matchRep && matchClassification
    })
  }, [search, chainFilter, filters])

  const activeGapMap = bdfCat === 'Sea Salt' ? ssGapMap : bdfCat === 'Must Have' ? mhGapMap : gapMap

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va, vb
      if (sortCol === 'gaps') {
        va = activeGapMap[a.id] ?? -1
        vb = activeGapMap[b.id] ?? -1
      } else if (sortCol === 'ss') {
        va = ssGapMap[a.id] ?? -1
        vb = ssGapMap[b.id] ?? -1
      } else if (sortCol === 'mh') {
        va = mhGapMap[a.id] ?? -1
        vb = mhGapMap[b.id] ?? -1
      } else {
        va = (a[sortCol] || '').toString().toLowerCase()
        vb = (b[sortCol] || '').toString().toLowerCase()
      }
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ? 1 : -1
      return 0
    })
  }, [filtered, sortCol, sortAsc, gapMap])

  function toggleSort(col) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(true) }
  }

  function sortIcon(col) {
    if (sortCol !== col) return ''
    return sortAsc ? ' ↑' : ' ↓'
  }

  async function handleExport() {
    const XLSX = await import('xlsx')
    const period = bnbPeriod === 'dis' ? 'DIS' : bnbPeriod === '13wk' ? '13Wk' : '26Wk'
    const clientLabel = client === 'beiersdorf' ? 'Beiersdorf' : 'Vitasoy'
    const date = new Date().toISOString().slice(0, 10)

    const isBdf = client === 'beiersdorf'
    const rows = sorted.map(store => ({
      'Store':      store.name,
      'Suburb':     store.suburb,
      'Chain':      store.chain,
      'State':      store.state,
      'Region':     store.region,
      'Gaps':       activeGapMap[store.id] ?? '',
      ...(isBdf ? { 'Sea Salt Gaps': ssGapMap[store.id] ?? '', 'Must Have Gaps': mhGapMap[store.id] ?? '' } : {}),
      'Rep':        store.rep,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Distribution')
    XLSX.writeFile(wb, `Distribution_${clientLabel}_${period}_${date}.xlsx`)
  }

  return (
    <div className="list-view">
      <div className="list-toolbar">
        {!hideSearch && (
          <StoreSearchInput
            value={search}
            onChange={setSearch}
            onSelect={store => setSearch(store.name)}
            placeholder="Search store, suburb…"
          />
        )}
        <div className="chain-search-wrap" ref={chainWrapRef}>
          <div className="chain-search-row">
            <input
              className="chain-search-input"
              type="text"
              value={chainSearch}
              placeholder={chainFilter || 'All MSO'}
              onChange={e => { setChainSearch(e.target.value); setChainOpen(true) }}
              onFocus={() => setChainOpen(true)}
            />
            {chainFilter && (
              <button className="chain-search-clear" onMouseDown={() => selectChain('')}>✕</button>
            )}
          </div>
          {chainOpen && (
            <ul className="chain-search-dropdown">
              <li onMouseDown={() => selectChain('')} className={!chainFilter ? 'active' : ''}>All MSO</li>
              {chainOptions.map(c => (
                <li key={c} onMouseDown={() => selectChain(c)} className={chainFilter === c ? 'active' : ''}>{c}</li>
              ))}
            </ul>
          )}
        </div>
        <span className="list-count">{sorted.length} stores</span>
        <button
          className="lv-export-btn"
          onClick={handleExport}
          disabled={loading || sorted.length === 0}
        >Export</button>
      </div>

      {client === 'beiersdorf' && (
        <div className="bdf-cat-bar">
          {BDF_CATS.map(cat => (
            <button
              key={cat}
              className={`bdf-cat-btn ${bdfCat === cat ? 'active' : ''}`}
              onClick={() => setBdfCat(cat)}
            >{cat}</button>
          ))}
        </div>
      )}

      <div className="list-wrap">
        <table className="store-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('name')}>Store{sortIcon('name')}</th>
              <th onClick={() => toggleSort('chain')}>Chain{sortIcon('chain')}</th>
              <th onClick={() => toggleSort('state')}>State{sortIcon('state')}</th>
              <th onClick={() => toggleSort('region')}>Region{sortIcon('region')}</th>
              <th onClick={() => toggleSort('gaps')}>Gaps{sortIcon('gaps')}</th>
              {client === 'beiersdorf' && <th onClick={() => toggleSort('ss')}>SS{sortIcon('ss')}</th>}
              {client === 'beiersdorf' && <th onClick={() => toggleSort('mh')}>MH{sortIcon('mh')}</th>}
              <th onClick={() => toggleSort('rep')}>Rep{sortIcon('rep')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(store => {
              const gaps = activeGapMap[store.id]
              return (
                <tr key={store.id} onClick={() => onStoreClick(store)}>
                  <td>
                    <div className="store-name">{store.name}</div>
                    <div className="store-suburb">{store.suburb}</div>
                  </td>
                  <td>
                    <span
                      className="chain-badge"
                      style={{ background: chainColor(store.chain) }}
                    >{store.chain}</span>
                  </td>
                  <td>{store.state}</td>
                  <td>{store.region}</td>
                  <td>
                    {loading ? (
                      <span className="gap-pill grey">…</span>
                    ) : gaps === undefined ? (
                      <span className="gap-pill grey">—</span>
                    ) : gaps > 0 ? (
                      <span className="gap-pill red">{gaps} gaps</span>
                    ) : (
                      <span className="gap-pill green">✓</span>
                    )}
                  </td>
                  {client === 'beiersdorf' && (
                    <td>
                      {loading ? (
                        <span className="gap-pill grey">…</span>
                      ) : ssGapMap[store.id] === undefined ? (
                        <span className="gap-pill grey">—</span>
                      ) : ssGapMap[store.id] > 0 ? (
                        <span className="gap-pill red">{ssGapMap[store.id]}</span>
                      ) : (
                        <span className="gap-pill green">✓</span>
                      )}
                    </td>
                  )}
                  {client === 'beiersdorf' && (
                    <td>
                      {loading ? (
                        <span className="gap-pill grey">…</span>
                      ) : mhGapMap[store.id] === undefined ? (
                        <span className="gap-pill grey">—</span>
                      ) : mhGapMap[store.id] > 0 ? (
                        <span className="gap-pill red">{mhGapMap[store.id]}</span>
                      ) : (
                        <span className="gap-pill green">✓</span>
                      )}
                    </td>
                  )}
                  <td className="rep-cell">{store.rep}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
