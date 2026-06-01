import { useState, useEffect, useMemo, Fragment } from 'react'
import { supabase } from '../../lib/supabase'
import { getProductCategory } from '../../utils/productCategory'
import './BeiersdorfTargetsView.css'

const CATEGORY_ORDER = ['UHT Core', 'Non Core UHT', 'Fresh', 'RTD', 'Yoghurt']

function distColor(pct) {
  if (pct >= 80) return '#16a085'
  if (pct >= 50) return '#e67e22'
  return '#CC0000'
}

function cleanName(name) {
  return name.replace(/^\*\s*/, '').trim()
}

function getCategory(itemName, pogCategory, itemId) {
  const cat = getProductCategory(itemName, pogCategory, itemId)
  return cat === 'UHT' ? 'Non Core UHT' : cat
}

async function fetchAllPages(buildQuery) {
  let all = [], from = 0
  while (true) {
    const { data, error } = await buildQuery(from)
    if (error) throw error
    if (!data || data.length === 0) break
    all = [...all, ...data]
    if (data.length < 1000) break
    from += 1000
  }
  return all
}

export default function VitasoyByProductView({ state, rep }) {
  const [distData, setDistData] = useState([])
  const [nameMap, setNameMap]   = useState({})   // item_name → pog_category
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [openSections, setOpenSections]       = useState(new Set())
  const [expandedProduct, setExpandedProduct] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setExpandedProduct(null)

      try {
        // Fetch store_distribution (source of truth for distribution, matches By Store view)
        // and bnb_26wk (item_id → pog_category lookup only) in parallel
        const [dist, pogRows] = await Promise.all([
          fetchAllPages(from => {
            // No client filter — store_distribution is Vitasoy-only and uploaded rows
            // don't always have client set. ListView/StoreProfile also omit this filter.
            let q = supabase
              .from('store_distribution')
              .select('location_id, store_name, state, rep_name, item_name, item_code, latest_distribution')
              .range(from, from + 999)
            if (state !== 'All') q = q.eq('state', state)
            if (rep   !== 'All') q = q.eq('rep_name', rep)
            return q
          }),
          fetchAllPages(from =>
            supabase
              .from('bnb_26wk')
              .select('item_id, item_name, pog_category')
              .eq('client', 'vitasoy')
              .range(from, from + 999)
          ),
        ])

        if (cancelled) return

        // Build item_name → pog_category (prefer direct name match, fall back via item_code)
        const idToPog = {}
        const nameToPog = {}
        pogRows.forEach(r => {
          if (r.item_id && r.pog_category) idToPog[String(r.item_id)] = r.pog_category
          if (r.item_name && r.pog_category && !nameToPog[r.item_name])
            nameToPog[r.item_name] = r.pog_category
        })
        dist.forEach(r => {
          if (r.item_name && r.item_code && !nameToPog[r.item_name]) {
            const pog = idToPog[String(r.item_code)]
            if (pog) nameToPog[r.item_name] = pog
          }
        })

        if (!cancelled) { setDistData(dist); setNameMap(nameToPog) }
      } catch (e) {
        if (!cancelled) setError(e.message)
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [state, rep])

  // Aggregate per product using latest_distribution (matches By Store view)
  const grouped = useMemo(() => {
    const itemMap = {}
    distData.forEach(r => {
      if (!r.item_name) return
      if (!itemMap[r.item_name]) {
        itemMap[r.item_name] = {
          item_name: r.item_name,
          category: getCategory(r.item_name, nameMap[r.item_name], r.item_code),
          total: 0,
          stocked: 0,
        }
      }
      const item = itemMap[r.item_name]
      item.total++
      if (r.latest_distribution) item.stocked++
    })

    const products = Object.values(itemMap).map(item => ({
      ...item,
      distPct:  item.total > 0 ? (item.stocked / item.total) * 100 : 0,
      gapCount: item.total - item.stocked,
    }))

    const groups = {}
    products.forEach(p => {
      const cat = p.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(p)
    })
    Object.values(groups).forEach(g => g.sort((a, b) => a.distPct - b.distPct))
    return groups
  }, [distData, nameMap])

  // Gap stores for the expanded product — derived from distData, no extra query
  const gapStores = useMemo(() => {
    if (!expandedProduct) return []
    return distData
      .filter(r => r.item_name === expandedProduct && !r.latest_distribution)
      .map(r => ({ store_name: r.store_name, state: r.state, rep_name: r.rep_name }))
      .sort((a, b) =>
        (a.state ?? '').localeCompare(b.state ?? '') ||
        (a.store_name ?? '').localeCompare(b.store_name ?? '')
      )
  }, [distData, expandedProduct])

  function toggleSection(cat) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function handleProductClick(itemName) {
    setExpandedProduct(prev => (prev === itemName ? null : itemName))
  }

  if (loading) {
    return (
      <div className="bdft-loading">
        <div className="bdft-spinner" />
        <span>Loading distribution data…</span>
      </div>
    )
  }

  if (error) return <div className="bdft-error">Error: {error}</div>

  const sortedCats = Object.keys(grouped).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a)
    const bi = CATEGORY_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  if (!sortedCats.length) {
    return (
      <div className="bdft-empty">
        No Vitasoy distribution data loaded. Upload a Distribution file to get started.
      </div>
    )
  }

  return (
    <div className="bdft-page">
      {sortedCats.map(cat => {
        const products = grouped[cat]
        const avgDist  = products.reduce((s, p) => s + p.distPct, 0) / products.length
        const isOpen   = openSections.has(cat)

        return (
          <div key={cat} className="bdft-section">
            <button className="bdft-section-hdr" onClick={() => toggleSection(cat)}>
              <span className="bdft-hdr-arrow">{isOpen ? '▾' : '▸'}</span>
              <span className="bdft-hdr-name">{cat}</span>
              <span className="bdft-hdr-count">
                {products.length} product{products.length !== 1 ? 's' : ''}
              </span>
              <span className="bdft-hdr-avg" style={{ color: distColor(avgDist) }}>
                avg {avgDist.toFixed(1)}%
              </span>
            </button>

            {isOpen && (
              <div className="bdft-product-list">
                {products.map(product => (
                  <Fragment key={product.item_name}>
                    <div
                      className={`bdft-product-row${expandedProduct === product.item_name ? ' active' : ''}`}
                      onClick={() => handleProductClick(product.item_name)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && handleProductClick(product.item_name)}
                    >
                      <span className="bdft-prod-name">{cleanName(product.item_name)}</span>
                      <span
                        className="bdft-prod-dist"
                        style={{ color: distColor(product.distPct) }}
                      >
                        {product.distPct.toFixed(1)}%
                      </span>
                      <span className="bdft-prod-gap">
                        {product.gapCount} gap{product.gapCount !== 1 ? 's' : ''}
                      </span>
                      <span className="bdft-prod-chevron">
                        {expandedProduct === product.item_name ? '▲' : '▼'}
                      </span>
                    </div>

                    {expandedProduct === product.item_name && (
                      <div className="bdft-gap-panel">
                        <div className="bdft-gap-header">
                          {gapStores.length} store{gapStores.length !== 1 ? 's are' : ' is'} a gap for{' '}
                          <strong>{cleanName(product.item_name)}</strong>
                        </div>

                        {gapStores.length === 0 ? (
                          <div className="bdft-gap-empty">No gap stores for current filters.</div>
                        ) : (
                          <table className="bdft-gap-table">
                            <thead>
                              <tr>
                                <th>Store</th>
                                <th>State</th>
                                <th>Rep</th>
                              </tr>
                            </thead>
                            <tbody>
                              {gapStores.map((s, i) => (
                                <tr key={i}>
                                  <td>{s.store_name}</td>
                                  <td>{s.state}</td>
                                  <td>{s.rep_name ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
