import { useState, useEffect, useMemo, Fragment } from 'react'
import { supabase } from '../../lib/supabase'
import { getProductCategory, loadProductMaster } from '../../utils/productCategory'
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

function getCategory(itemName, pogCategory, itemCode) {
  const cat = getProductCategory(itemName, pogCategory, itemCode)
  return cat === 'UHT' ? 'Non Core UHT' : cat
}

export default function VitasoyByProductView({ state, rep, classification }) {
  const [products, setProducts]   = useState([])   // aggregated per-product rows from RPC
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [openSections, setOpenSections]       = useState(new Set())
  const [expandedProduct, setExpandedProduct] = useState(null)
  const [gapStores, setGapStores]             = useState([])
  const [gapLoading, setGapLoading]           = useState(false)

  // Load aggregate summary — single RPC call instead of paginated full-table scan
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setExpandedProduct(null)
      setGapStores([])

      try {
        const masterReady = loadProductMaster()
        const { data, error: rpcError } = await supabase.rpc('get_vitasoy_distribution_summary', {
          p_state:          state          === 'All' ? 'All' : state,
          p_rep:            rep            === 'All' ? 'All' : rep,
          p_classification: (classification && classification !== 'All') ? classification : 'All',
        })

        if (rpcError) throw rpcError
        await masterReady
        if (!cancelled) setProducts(data || [])
      } catch (e) {
        if (!cancelled) setError(e.message)
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [state, rep, classification])

  // Fetch gap stores lazily when a product is expanded
  useEffect(() => {
    if (!expandedProduct) { setGapStores([]); return }

    let cancelled = false
    setGapLoading(true)

    supabase.rpc('get_vitasoy_gap_stores', {
      p_item_name:      expandedProduct,
      p_state:          state          === 'All' ? 'All' : state,
      p_rep:            rep            === 'All' ? 'All' : rep,
      p_classification: (classification && classification !== 'All') ? classification : 'All',
    }).then(({ data, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) console.error('gap stores RPC error', rpcError)
      setGapStores(data || [])
      setGapLoading(false)
    })

    return () => { cancelled = true }
  }, [expandedProduct, state, rep, classification])

  const grouped = useMemo(() => {
    const groups = {}
    products.forEach(r => {
      if (!r.item_name) return
      const total   = Number(r.total_stores)   || 0
      const stocked = Number(r.stocked_stores) || 0
      const cat = getCategory(r.item_name, r.pog_category, r.item_code) || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push({
        item_name: r.item_name,
        item_code: r.item_code,
        category:  cat,
        total,
        stocked,
        distPct:  total > 0 ? (stocked / total) * 100 : 0,
        gapCount: total - stocked,
      })
    })
    Object.values(groups).forEach(g => g.sort((a, b) => a.distPct - b.distPct))
    return groups
  }, [products])

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

  async function handleExport() {
    const PptxGenJS = (await import('pptxgenjs')).default
    const pptx = new PptxGenJS()

    const stateLabel = state !== 'All' ? state : 'All States'
    const repLabel   = rep   !== 'All' ? rep   : 'All Reps'
    const slideTitle = `Distribution Summary — Vitasoy — ${stateLabel} — ${repLabel}`

    const exportCats = Object.keys(grouped).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1; if (bi === -1) return -1
      return ai - bi
    })

    const DARK = '1a2b5e'
    const headerRow = [
      { text: 'Category', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 11 } },
      { text: 'Products',  options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 11, align: 'center' } },
      { text: 'Avg DIS%', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 11, align: 'center' } },
    ]
    const dataRows = exportCats.map(cat => {
      const prods = grouped[cat]
      const avg   = prods.reduce((s, p) => s + p.distPct, 0) / prods.length
      const color = avg >= 80 ? '16a085' : avg >= 60 ? 'e67e22' : 'CC0000'
      return [
        { text: cat,                  options: { fontSize: 11 } },
        { text: String(prods.length), options: { fontSize: 11, align: 'center' } },
        { text: avg.toFixed(1) + '%', options: { fontSize: 11, bold: true, color, align: 'center' } },
      ]
    })

    const slide = pptx.addSlide()
    slide.addText(slideTitle, { x: 0.3, y: 0.2, w: '94%', h: 0.5, fontSize: 15, bold: true, color: DARK })
    slide.addTable([headerRow, ...dataRows], {
      x: 0.3, y: 0.85, w: 9, colW: [5.5, 1.5, 2], rowH: 0.32,
      border: { type: 'solid', color: 'e0e0e0', pt: 0.5 },
    })

    const dateStr = new Date().toISOString().slice(0, 10)
    pptx.writeFile({ fileName: `distribution-summary-${dateStr}.pptx` })
  }

  async function handleCatExport(cat, prods) {
    const PptxGenJS = (await import('pptxgenjs')).default
    const pptx = new PptxGenJS()

    const stateLabel = state !== 'All' ? state : 'All States'
    const repLabel   = rep   !== 'All' ? rep   : 'All Reps'
    const slideTitle = `${cat} — Vitasoy — ${stateLabel} — ${repLabel}`

    const DARK = '1a2b5e'
    const headerRow = [
      { text: 'Product', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10 } },
      { text: 'DIS%',    options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10, align: 'center' } },
      { text: 'Gaps',    options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10, align: 'center' } },
    ]
    const dataRows = prods.map(p => {
      const color = p.distPct >= 80 ? '16a085' : p.distPct >= 60 ? 'e67e22' : 'CC0000'
      return [
        { text: cleanName(p.item_name),     options: { fontSize: 10 } },
        { text: p.distPct.toFixed(1) + '%', options: { fontSize: 10, bold: true, color, align: 'center' } },
        { text: String(p.gapCount),         options: { fontSize: 10, align: 'center' } },
      ]
    })

    const slide = pptx.addSlide()
    slide.addText(slideTitle, { x: 0.3, y: 0.2, w: '94%', h: 0.5, fontSize: 15, bold: true, color: DARK })
    slide.addTable([headerRow, ...dataRows], {
      x: 0.3, y: 0.85, w: 9, colW: [6, 1.5, 1.5], rowH: 0.28,
      border: { type: 'solid', color: 'e0e0e0', pt: 0.5 },
    })

    const slug    = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const dateStr = new Date().toISOString().slice(0, 10)
    pptx.writeFile({ fileName: `${slug}-products-${dateStr}.pptx` })
  }

  async function handleProductExport(itemName, stores) {
    const PptxGenJS = (await import('pptxgenjs')).default
    const pptx = new PptxGenJS()

    const stateLabel  = state !== 'All' ? state : 'All States'
    const repLabel    = rep   !== 'All' ? rep   : 'All Reps'
    const displayName = cleanName(itemName)
    const slideTitle  = `${displayName} — Vitasoy — ${stateLabel} — ${repLabel}`
    const subtitle    = `${stores.length} store${stores.length !== 1 ? 's are' : ' is'} a gap for ${displayName}`

    const DARK = '1a2b5e'
    const headerRow = [
      { text: 'Store', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10 } },
      { text: 'State', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10, align: 'center' } },
      { text: 'Rep',   options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: 10 } },
    ]
    const dataRows = stores.map(s => ([
      { text: s.store_name ?? '',  options: { fontSize: 10 } },
      { text: s.state ?? '',       options: { fontSize: 10, align: 'center' } },
      { text: s.rep_name ?? '—',   options: { fontSize: 10 } },
    ]))

    const slide = pptx.addSlide()
    slide.addText(slideTitle, { x: 0.3, y: 0.15, w: '94%', h: 0.45, fontSize: 15, bold: true, color: DARK })
    slide.addText(subtitle,   { x: 0.3, y: 0.6,  w: '94%', h: 0.28, fontSize: 11, color: '555555', italic: true })
    slide.addTable([headerRow, ...dataRows], {
      x: 0.3, y: 0.95, w: 9, colW: [5, 1.5, 2.5], rowH: 0.28,
      border: { type: 'solid', color: 'e0e0e0', pt: 0.5 },
    })

    const slug    = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const dateStr = new Date().toISOString().slice(0, 10)
    pptx.writeFile({ fileName: `${slug}-gaps-${dateStr}.pptx` })
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
      <div className="bdf-cat-bar">
        <button className="bdft-export-btn" onClick={handleExport}>Export Slide</button>
      </div>
      {sortedCats.map(cat => {
        const prods   = grouped[cat]
        const avgDist = prods.reduce((s, p) => s + p.distPct, 0) / prods.length
        const isOpen  = openSections.has(cat)

        return (
          <div key={cat} className="bdft-section">
            <div className="bdft-section-hdr" onClick={() => toggleSection(cat)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && toggleSection(cat)}>
              <span className="bdft-hdr-arrow">{isOpen ? '▾' : '▸'}</span>
              <span className="bdft-hdr-name">{cat}</span>
              <span className="bdft-hdr-count">
                {prods.length} product{prods.length !== 1 ? 's' : ''}
              </span>
              <span className="bdft-hdr-avg" style={{ color: distColor(avgDist) }}>
                avg {avgDist.toFixed(1)}%
              </span>
              {isOpen && (
                <button
                  className="bdft-cat-export-btn"
                  onClick={e => { e.stopPropagation(); handleCatExport(cat, prods) }}
                >Export Slide</button>
              )}
            </div>

            {isOpen && (
              <div className="bdft-product-list">
                {prods.map(product => (
                  <Fragment key={product.item_name}>
                    <div
                      className={`bdft-product-row${expandedProduct === product.item_name ? ' active' : ''}`}
                      onClick={() => handleProductClick(product.item_name)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && handleProductClick(product.item_name)}
                    >
                      <span className="bdft-prod-name">{cleanName(product.item_name)}</span>
                      <span className="bdft-prod-dist" style={{ color: distColor(product.distPct) }}>
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
                        {gapLoading ? (
                          <div className="bdft-gap-header">Loading gap stores…</div>
                        ) : (
                          <>
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
                          </>
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
