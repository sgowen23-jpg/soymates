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

const BDF_CATS = ['All', 'Sea Salt', 'Must Have']

function itemMatchesCat(itemName, cat) {
  if (cat === 'All') return true
  const prefix = (itemName || '').match(/^\(\s*([^)]+)\)/i)
  if (cat === 'Sea Salt')  return !!(prefix && prefix[1].toUpperCase().includes('S'))
  if (cat === 'Must Have') return !!(prefix && prefix[1].toUpperCase().includes('M'))
  return true
}

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
  const [bdfCat, setBdfCat]                   = useState('All')

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
        // Each state may have been uploaded at a different time — find the latest
        // uploaded_at per state, then fetch that state's snapshot separately.
        const statesToLoad = effectiveState !== 'All'
          ? [effectiveState]
          : ['SA', 'VIC', 'WA', 'NSW', 'QLD']

        const latestByState = await Promise.all(
          statesToLoad.map(async s => {
            const { data } = await supabase
              .from('bnb_26wk')
              .select('uploaded_at')
              .eq('client', 'beiersdorf')
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
              const { data, error: fetchErr } = await supabase
                .from('bnb_26wk')
                .select('item_name, pog_category, sum_of_ranging, ranging_gap, store_name, state')
                .eq('client', 'beiersdorf')
                .eq('state', s)
                .eq('uploaded_at', uploaded_at)
                .range(from, from + 999)
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

    const products = Object.values(itemMap)
      .filter(item => itemMatchesCat(item.item_name, bdfCat))
      .map(item => ({
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
  }, [rows, bdfCat])

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

  async function handleCatExport(cat, products) {
    const PptxGenJS = (await import('pptxgenjs')).default
    const pptx = new PptxGenJS()

    const stateLabel  = effectiveState !== 'All' ? effectiveState : 'All States'
    const repLabel    = rep !== 'All' ? rep : 'All Reps'
    const filterLabel = bdfCat !== 'All' ? bdfCat : 'All Products'
    const slideTitle  = `${cat} — Beiersdorf — ${stateLabel} — ${repLabel} — ${filterLabel}`

    const DARK = '1a2b5e'
    const headerRow = [
      { text: 'Product',  options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10 } },
      { text: 'DIS%',     options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10, align: 'center' } },
      { text: 'Gaps',     options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10, align: 'center' } },
    ]

    const dataRows = products.map(p => {
      const color = p.distPct >= 80 ? '16a085' : p.distPct >= 60 ? 'e67e22' : 'CC0000'
      return [
        { text: cleanName(p.item_name),      options: { fontSize: 10 } },
        { text: p.distPct.toFixed(1) + '%',  options: { fontSize: 10, bold: true, color, align: 'center' } },
        { text: String(p.gapCount),          options: { fontSize: 10, align: 'center' } },
      ]
    })

    const slide = pptx.addSlide()
    slide.addText(slideTitle, {
      x: 0.3, y: 0.2, w: '94%', h: 0.5,
      fontSize: 15, bold: true, color: DARK,
    })
    slide.addTable([headerRow, ...dataRows], {
      x: 0.3, y: 0.85, w: 9,
      colW: [6, 1.5, 1.5],
      rowH: 0.28,
      border: { type: 'solid', color: 'e0e0e0', pt: 0.5 },
    })

    const slug    = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const dateStr = new Date().toISOString().slice(0, 10)
    pptx.writeFile({ fileName: `${slug}-products-${dateStr}.pptx` })
  }

  async function handleProductExport(itemName, stores) {
    const PptxGenJS = (await import('pptxgenjs')).default
    const pptx = new PptxGenJS()

    const stateLabel  = effectiveState !== 'All' ? effectiveState : 'All States'
    const repLabel    = rep !== 'All' ? rep : 'All Reps'
    const filterLabel = bdfCat !== 'All' ? bdfCat : 'All Products'
    const displayName = cleanName(itemName)
    const slideTitle  = `${displayName} — Beiersdorf — ${stateLabel} — ${repLabel} — ${filterLabel}`
    const subtitle    = `${stores.length} store${stores.length !== 1 ? 's are' : ' is'} a gap for ${displayName}`

    const DARK = '1a2b5e'
    const headerRow = [
      { text: 'Store', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10 } },
      { text: 'State', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10, align: 'center' } },
      { text: 'Rep',   options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10 } },
      { text: 'Gap',   options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10, align: 'center' } },
    ]

    const dataRows = stores.map(s => ([
      { text: s.store_name ?? '',              options: { fontSize: 10 } },
      { text: s.state ?? '',                   options: { fontSize: 10, align: 'center' } },
      { text: STATE_TO_REP[s.state] ?? '—',   options: { fontSize: 10 } },
      { text: String(s.ranging_gap ?? 0),      options: { fontSize: 10, align: 'center' } },
    ]))

    const slide = pptx.addSlide()
    slide.addText(slideTitle, {
      x: 0.3, y: 0.15, w: '94%', h: 0.45,
      fontSize: 15, bold: true, color: DARK,
    })
    slide.addText(subtitle, {
      x: 0.3, y: 0.6, w: '94%', h: 0.28,
      fontSize: 11, color: '555555', italic: true,
    })
    slide.addTable([headerRow, ...dataRows], {
      x: 0.3, y: 0.95, w: 9,
      colW: [4.5, 1, 2.5, 1],
      rowH: 0.28,
      border: { type: 'solid', color: 'e0e0e0', pt: 0.5 },
    })

    const slug    = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const dateStr = new Date().toISOString().slice(0, 10)
    pptx.writeFile({ fileName: `${slug}-gaps-${dateStr}.pptx` })
  }

  async function handleExport() {
    const PptxGenJS = (await import('pptxgenjs')).default
    const pptx = new PptxGenJS()

    const stateLabel  = effectiveState !== 'All' ? effectiveState : 'All States'
    const repLabel    = rep !== 'All' ? rep : 'All Reps'
    const filterLabel = bdfCat !== 'All' ? bdfCat : 'All Products'
    const slideTitle  = `Distribution Summary — Beiersdorf — ${stateLabel} — ${repLabel} — ${filterLabel}`

    const exportCats = Object.keys(grouped).sort((a, b) => {
      if (a === 'OTHER') return 1
      if (b === 'OTHER') return -1
      return a.localeCompare(b)
    })

    const DARK = '1a2b5e'
    const headerRow = [
      { text: 'Category', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 11 } },
      { text: 'Products',  options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 11, align: 'center' } },
      { text: 'Avg DIS%', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 11, align: 'center' } },
    ]

    const dataRows = exportCats.map(cat => {
      const prods   = grouped[cat]
      const avg     = prods.reduce((s, p) => s + p.distPct, 0) / prods.length
      const color   = avg >= 80 ? '16a085' : avg >= 60 ? 'e67e22' : 'CC0000'
      return [
        { text: cat,                          options: { fontSize: 11 } },
        { text: String(prods.length),         options: { fontSize: 11, align: 'center' } },
        { text: avg.toFixed(1) + '%',         options: { fontSize: 11, bold: true, color, align: 'center' } },
      ]
    })

    const slide = pptx.addSlide()
    slide.addText(slideTitle, {
      x: 0.3, y: 0.2, w: '94%', h: 0.5,
      fontSize: 15, bold: true, color: DARK,
    })
    slide.addTable([headerRow, ...dataRows], {
      x: 0.3, y: 0.85, w: 9,
      colW: [5.5, 1.5, 2],
      rowH: 0.32,
      border: { type: 'solid', color: 'e0e0e0', pt: 0.5 },
    })

    const dateStr = new Date().toISOString().slice(0, 10)
    pptx.writeFile({ fileName: `distribution-summary-${dateStr}.pptx` })
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
      <div className="bdf-cat-bar">
        {BDF_CATS.map(cat => (
          <button
            key={cat}
            className={`bdf-cat-btn ${bdfCat === cat ? 'active' : ''}`}
            onClick={() => { setBdfCat(cat); setExpandedProduct(null) }}
          >{cat}</button>
        ))}
        <button className="bdft-export-btn" onClick={handleExport}>Export Slide</button>
      </div>
      {sortedCats.map(cat => {
        const products = grouped[cat]
        const avgDist  = products.reduce((s, p) => s + p.distPct, 0) / products.length
        const isOpen   = openSections.has(cat)

        return (
          <div key={cat} className="bdft-section">
            <div className="bdft-section-hdr" onClick={() => toggleSection(cat)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && toggleSection(cat)}>
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
              {isOpen && (
                <button
                  className="bdft-cat-export-btn"
                  onClick={e => { e.stopPropagation(); handleCatExport(cat, products) }}
                >Export Slide</button>
              )}
            </div>

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
                      {expandedProduct === product.item_name && (
                        <button
                          className="bdft-prod-export-btn"
                          onClick={e => { e.stopPropagation(); handleProductExport(product.item_name, gapStores) }}
                        >Export Slide</button>
                      )}
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
