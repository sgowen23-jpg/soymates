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

export default function VitasoyByProductView({ state, rep }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [openSections, setOpenSections]       = useState(new Set())
  const [expandedProduct, setExpandedProduct] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setExpandedProduct(null)

      try {
        // Each state may have been uploaded at a different time — find the latest
        // uploaded_at per state, then fetch that state's snapshot separately.
        const statesToLoad = state !== 'All'
          ? [state]
          : ['SA', 'VIC', 'WA', 'NSW', 'QLD']

        const latestByState = await Promise.all(
          statesToLoad.map(async s => {
            const { data } = await supabase
              .from('bnb_26wk')
              .select('uploaded_at')
              .eq('client', 'vitasoy')
              .eq('state', s)
              .order('uploaded_at', { ascending: false })
              .limit(1)
              .single()
            return { state: s, uploaded_at: data?.uploaded_at ?? null }
          })
        )
        if (cancelled) return

        const stateSnapshots = latestByState.filter(x => x.uploaded_at)
        if (!stateSnapshots.length) { setRows([]); setLoading(false); return }

        const stateChunks = await Promise.all(
          stateSnapshots.map(async ({ state: s, uploaded_at }) => {
            let all = [], from = 0
            while (true) {
              let q = supabase
                .from('bnb_26wk')
                .select('item_name, item_id, pog_category, sum_of_ranging, ranging_gap, store_name, state, rep_name')
                .eq('client', 'vitasoy')
                .eq('state', s)
                .eq('uploaded_at', uploaded_at)
                .range(from, from + 999)
              if (rep !== 'All') q = q.eq('rep_name', rep)
              const { data, error: fetchErr } = await q
              if (fetchErr) throw fetchErr
              if (!data || data.length === 0) break
              all = [...all, ...data]
              if (data.length < 1000) break
              from += 1000
            }
            return all
          })
        )
        if (cancelled) return

        if (!cancelled) setRows(stateChunks.flat())
      } catch (e) {
        if (!cancelled) setError(e.message)
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [state, rep])

  const grouped = useMemo(() => {
    const itemMap = {}
    rows.forEach(r => {
      if (!r.item_name) return
      if (!itemMap[r.item_name]) {
        itemMap[r.item_name] = {
          item_name: r.item_name,
          category: getCategory(r.item_name, r.pog_category, r.item_id),
          total: 0,
          stocked: 0,
          gapCount: 0,
        }
      }
      const item = itemMap[r.item_name]
      item.total++
      if ((r.sum_of_ranging ?? 0) > 0) item.stocked++
      item.gapCount += (r.ranging_gap ?? 0)
    })

    const products = Object.values(itemMap).map(item => ({
      ...item,
      distPct: item.total > 0 ? (item.stocked / item.total) * 100 : 0,
    }))

    const groups = {}
    products.forEach(p => {
      const cat = p.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(p)
    })
    Object.values(groups).forEach(g => g.sort((a, b) => a.distPct - b.distPct))
    return groups
  }, [rows])

  const gapStores = useMemo(() => {
    if (!expandedProduct) return []
    return rows
      .filter(r => r.item_name === expandedProduct && (r.ranging_gap ?? 0) > 0)
      .map(r => ({ store_name: r.store_name, state: r.state, rep_name: r.rep_name, ranging_gap: r.ranging_gap }))
      .sort((a, b) =>
        (a.state ?? '').localeCompare(b.state ?? '') ||
        (a.store_name ?? '').localeCompare(b.store_name ?? '')
      )
  }, [rows, expandedProduct])

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
        No Vitasoy BNB data loaded. Upload a 26-week BNB file to get started.
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
                                <th>Gap</th>
                              </tr>
                            </thead>
                            <tbody>
                              {gapStores.map((s, i) => (
                                <tr key={i}>
                                  <td>{s.store_name}</td>
                                  <td>{s.state}</td>
                                  <td>{s.rep_name ?? '—'}</td>
                                  <td>{s.ranging_gap}</td>
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
