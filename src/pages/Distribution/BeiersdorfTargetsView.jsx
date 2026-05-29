import { useState, useEffect, useMemo, Fragment } from 'react'
import { supabase } from '../../lib/supabase'
import './BeiersdorfTargetsView.css'

const STATE_TO_REP = {
  SA:  'Sam Gowen',
  NSW: 'David Saleeb',
  QLD: 'David Kerr',
  WA:  'Dipen Surani',
  VIC: 'Shane Vandewardt',
}
const REP_TO_STATE = Object.fromEntries(
  Object.entries(STATE_TO_REP).map(([s, r]) => [r, s])
)

// Sea Salt pill: hidden — no pog_category='Sea Salt' exists in Beiersdorf data;
// Sea Salt is encoded in product name prefixes ( S ) / ( S / M ).
// Must Have pill: hidden — no must_have column on bnb_26wk.

function distColor(pct) {
  if (pct >= 80) return '#16a085'
  if (pct >= 50) return '#e67e22'
  return '#CC0000'
}

// Strip name prefix like "( S / M ) ", "( M ) ", "( DEL ) "
function cleanName(name) {
  return name.replace(/^\(\s*[^)]*\)\s*/i, '').trim()
}

export default function BeiersdorfTargetsView({ state, rep }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [openSections, setOpenSections]       = useState(new Set())
  const [expandedProduct, setExpandedProduct] = useState(null)

  // Derive effective state: explicit state wins; else map rep → state
  const effectiveState = useMemo(() => {
    if (state !== 'All') return state
    if (rep !== 'All') return REP_TO_STATE[rep] ?? 'All'
    return 'All'
  }, [state, rep])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setExpandedProduct(null)

      try {
        // Step 1: find latest uploaded_at for beiersdorf (state-scoped if filtered)
        let latestQ = supabase
          .from('bnb_26wk')
          .select('uploaded_at')
          .eq('client', 'beiersdorf')
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .single()

        if (effectiveState !== 'All') {
          latestQ = supabase
            .from('bnb_26wk')
            .select('uploaded_at')
            .eq('client', 'beiersdorf')
            .eq('state', effectiveState)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .single()
        }

        const { data: latestRow, error: latestErr } = await latestQ
        if (cancelled) return
        if (latestErr && latestErr.code !== 'PGRST116') throw latestErr
        if (!latestRow) {
          setRows([])
          setLoading(false)
          return
        }

        // Step 2: paginate all rows for the latest batch
        // Fetch only the columns needed for aggregation + gap derivation
        let all = [], from = 0
        while (true) {
          let q = supabase
            .from('bnb_26wk')
            .select('item_name, pog_category, sum_of_ranging, ranging_gap, store_name, state')
            .eq('client', 'beiersdorf')
            .eq('uploaded_at', latestRow.uploaded_at)
            .range(from, from + 999)
          if (effectiveState !== 'All') q = q.eq('state', effectiveState)

          const { data, error: fetchErr } = await q
          if (cancelled) return
          if (fetchErr) throw fetchErr
          if (!data || data.length === 0) break
          all = [...all, ...data]
          if (data.length < 1000) break
          from += 1000
        }

        if (!cancelled) setRows(all)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [effectiveState])

  // Aggregate rows → per-product stats, grouped by pog_category
  const grouped = useMemo(() => {
    const itemMap = {}
    rows.forEach(r => {
      if (!r.item_name) return
      if (!itemMap[r.item_name]) {
        itemMap[r.item_name] = {
          item_name: r.item_name,
          pog_category: r.pog_category ?? null,
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

    // Group, then sort each group worst-first
    const groups = {}
    products.forEach(p => {
      const cat = p.pog_category ?? 'OTHER'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(p)
    })
    Object.values(groups).forEach(g => g.sort((a, b) => a.distPct - b.distPct))
    return groups
  }, [rows])

  // Gap stores for the currently expanded product — derived from loaded rows, no extra query
  const gapStores = useMemo(() => {
    if (!expandedProduct) return []
    return rows
      .filter(r => r.item_name === expandedProduct && (r.ranging_gap ?? 0) > 0)
      .map(r => ({ store_name: r.store_name, state: r.state, ranging_gap: r.ranging_gap }))
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
    // Only one panel open at a time
    setExpandedProduct(prev => (prev === itemName ? null : itemName))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bdft-loading">
        <div className="bdft-spinner" />
        <span>Loading Beiersdorf data…</span>
      </div>
    )
  }

  if (error) {
    return <div className="bdft-error">Error: {error}</div>
  }

  const sortedCats = Object.keys(grouped).sort((a, b) => {
    if (a === 'OTHER') return 1
    if (b === 'OTHER') return -1
    return a.localeCompare(b)
  })

  if (!sortedCats.length) {
    return (
      <div className="bdft-empty">
        No Beiersdorf data loaded. Upload a BNB file tagged client = &apos;beiersdorf&apos; to get started.
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
              <span
                className="bdft-hdr-avg"
                style={{ color: distColor(avgDist) }}
              >
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
                      {/* item_id is NULL for all Beiersdorf rows — show raw name as identifier */}
                      <span className="bdft-prod-id" title={product.item_name}>
                        {product.item_name}
                      </span>
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
                          <div className="bdft-gap-empty">
                            No gap stores for current filters.
                          </div>
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
                                  <td>{STATE_TO_REP[s.state] ?? '—'}</td>
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
