import { useEffect, useState, Fragment } from 'react'
import { supabase } from '../../lib/supabase'
import { useClient } from '../../context/ClientContext'
import { getProductCategory } from '../../utils/productCategory'
import { getRules, isProductValidForStore } from '../../utils/rangingRules'
import { chainColor } from './chainColors'
import './StoreProfile.css'

function clean(name) {
  return name.replace(/^\*\s*/, '').trim()
}

const CATEGORY_ORDER = ['UHT Core', 'UHT', 'Fresh', 'RTD', 'Yoghurt']

function Indicator({ val }) {
  if (val === null) return <span className="sp-ind-none">—</span>
  return val === 1
    ? <span className="sp-ind-tick">✓</span>
    : <span className="sp-ind-dot">●</span>
}

function latestBatch(data) {
  if (!data || data.length === 0) return []
  const max = data.reduce((m, r) => (r.uploaded_at > m ? r.uploaded_at : m), '')
  return data.filter(r => r.uploaded_at === max)
}

// Parse ( S ), ( M ), ( S / M ) ranging prefixes from Beiersdorf product names
function parseRanging(name) {
  const match = name.match(/^\(\s*([^)]+)\)/)
  if (!match) return { isS: false, isM: false }
  const prefix = match[1].toUpperCase()
  return { isS: prefix.includes('S'), isM: prefix.includes('M') }
}

export default function StoreProfile({ store, onClose }) {
  const { client } = useClient()

  // Vitasoy state
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)

  // Beiersdorf state
  const [bRows, setBRows]               = useState([])
  const [expandedCats, setExpandedCats] = useState(new Set())
  const [expandedTopSections, setExpandedTopSections] = useState(new Set())
  const [expandedSubCats, setExpandedSubCats]         = useState(new Set())

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!store) {
      setRows([])
      setBRows([])
      setExpandedCats(new Set())
      setExpandedTopSections(new Set())
      setExpandedSubCats(new Set())
      return
    }

    async function fetchData() {
      setLoading(true)
      setRows([])
      setBRows([])
      setExpandedCats(new Set())
      setExpandedTopSections(new Set())
      setExpandedSubCats(new Set())

      // ── Beiersdorf path ──────────────────────────────────────────────────────
      if (client === 'beiersdorf') {
        const { data: raw } = await supabase
          .from('bnb_26wk')
          .select('item_name, pog_category, ranging_gap, sum_of_ranging, uploaded_at')
          .eq('client', 'beiersdorf')
          .eq('store_name', store.name)

        const latest = latestBatch(raw || [])

        const mapped = latest.map(r => {
          const { isS, isM } = parseRanging(r.item_name || '')
          return {
            name:     r.item_name || '',
            category: r.pog_category ? r.pog_category.toUpperCase() : 'OTHER',
            isGap:    (r.ranging_gap ?? 0) > 0,
            isS,
            isM,
          }
        })

        // Auto-expand the category with the most gaps
        const gapsByCat = {}
        mapped.forEach(r => {
          gapsByCat[r.category] = (gapsByCat[r.category] || 0) + (r.isGap ? 1 : 0)
        })
        const topCat = Object.entries(gapsByCat).sort((a, b) => b[1] - a[1])[0]
        if (topCat && topCat[1] > 0) setExpandedCats(new Set([topCat[0]]))

        setBRows(mapped)
        setLoading(false)
        return
      }

      // ── Vitasoy path (unchanged) ─────────────────────────────────────────────
      const [distRes, bnb26Res, bnb13Res, rules] = await Promise.all([
        supabase.from('store_distribution')
          .select('item_name, item_code, latest_distribution')
          .eq('location_id', store.id),
        supabase.from('bnb_26wk')
          .select('item_id, sum_of_ranging, pog_category, uploaded_at')
          .eq('store_id', store.id),
        supabase.from('bnb_13wk')
          .select('item_id, sum_of_ranging, uploaded_at')
          .eq('store_id', store.id),
        getRules(),
      ])

      const bnb26 = latestBatch(bnb26Res.data)
      const bnb13 = latestBatch(bnb13Res.data)

      const bnb26Map = {}
      bnb26.forEach(r => { bnb26Map[String(r.item_id)] = r })
      const bnb13Map = {}
      bnb13.forEach(r => { bnb13Map[String(r.item_id)] = r })

      const merged = (distRes.data || []).map(r => {
        const b26 = bnb26Map[String(r.item_code)] ?? null
        const b13 = bnb13Map[String(r.item_code)] ?? null
        const pog = b26?.pog_category ?? null
        const name = clean(r.item_name)
        return {
          name,
          category: getProductCategory(name, pog, r.item_code),
          dis:   r.latest_distribution ?? null,
          bnb13: b13 !== null ? (b13.sum_of_ranging > 0 ? 1 : 0) : null,
          bnb26: b26 !== null ? (b26.sum_of_ranging > 0 ? 1 : 0) : null,
        }
      })

      const storeCtx = { state: store.state, banner: store.banner || store.chain || '' }
      setRows(merged.filter(r => isProductValidForStore(r.name, r.category, storeCtx, rules)))
      setLoading(false)
    }

    fetchData()
  }, [store, client])

  // ── Vitasoy grouping (unchanged) ───────────────────────────────────────────
  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, items: rows.filter(r => r.category === cat) }))
    .filter(g => g.items.length > 0)
  const knownCats = new Set(CATEGORY_ORDER)
  const others = rows.filter(r => !knownCats.has(r.category))
  if (others.length) grouped.push({ cat: 'Other', items: others })

  // ── Beiersdorf grouping ────────────────────────────────────────────────────
  const bCatMap = {}
  bRows.forEach(r => {
    if (!bCatMap[r.category]) bCatMap[r.category] = []
    bCatMap[r.category].push(r)
  })
  const bGrouped = Object.keys(bCatMap)
    .sort((a, b) => a === 'OTHER' ? 1 : b === 'OTHER' ? -1 : a.localeCompare(b))
    .map(cat => ({
      cat,
      items:    bCatMap[cat],
      gapCount: bCatMap[cat].filter(r => r.isGap).length,
    }))

  // ── Sea Salt / Must Have derived groupings ────────────────────────────────
  function buildNestedGroup(filterFn) {
    const catMap = {}
    bRows.filter(filterFn).forEach(r => {
      if (!catMap[r.category]) catMap[r.category] = []
      catMap[r.category].push(r)
    })
    return Object.keys(catMap)
      .sort((a, b) => a === 'OTHER' ? 1 : b === 'OTHER' ? -1 : a.localeCompare(b))
      .map(cat => ({ cat, items: catMap[cat], gapCount: catMap[cat].filter(r => r.isGap).length }))
  }
  const ssGrouped = buildNestedGroup(r => r.isS)
  const mhGrouped = buildNestedGroup(r => r.isM)

  function toggleTopSection(key) {
    setExpandedTopSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleSubCat(key) {
    setExpandedSubCats(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleCat(cat) {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className={`store-profile ${store ? 'open' : ''}`}>
      {store && (
        <>
          {/* ── Header — shared between both clients ── */}
          <div className="sp-header" style={{ background: chainColor(store.chain) }}>
            <button className="sp-close" onClick={onClose}>✕</button>
            <h2>{store.name}</h2>
            <div className="sp-addr">{store.address}</div>
            <div className="sp-meta">
              <span>{store.chain}</span>
              <span>{store.state} · {store.region}</span>
              {store.rep && <span>Rep: {store.rep}</span>}
            </div>
          </div>

          {/* ── Beiersdorf render path ── */}
          {client === 'beiersdorf' ? (
            loading ? (
              <div className="sp-no-data">Loading…</div>
            ) : bRows.length === 0 ? (
              <div className="sp-no-data">No Beiersdorf data for this store.</div>
            ) : (
              <>
                <div className="sp-stats">
                  <div className="sp-stat">
                    <strong>{bRows.filter(r => r.isGap).length}</strong>
                    <span>26wk gaps</span>
                  </div>
                  <div className="sp-stat">
                    <strong>{bRows.filter(r => r.isS && r.isGap).length}</strong>
                    <span>Sea Salt gaps</span>
                  </div>
                  <div className="sp-stat">
                    <strong>{bRows.filter(r => r.isM && r.isGap).length}</strong>
                    <span>Must Have gaps</span>
                  </div>
                </div>

                <div className="sp-body">
                  {/* ── Sea Salt and Must Have nested sections ── */}
                  {[
                    { key: 'ss', label: 'Sea Salt', groups: ssGrouped, totalGaps: bRows.filter(r => r.isS && r.isGap).length },
                    { key: 'mh', label: 'Must Have', groups: mhGrouped, totalGaps: bRows.filter(r => r.isM && r.isGap).length },
                  ].map(({ key, label, groups, totalGaps }) => groups.length > 0 && (
                    <div key={key} className="sp-b-section sp-b-top-section">
                      <button
                        className="sp-b-cat-header sp-b-top-header"
                        onClick={() => toggleTopSection(key)}
                      >
                        <span className="sp-b-cat-name">{label}</span>
                        {totalGaps > 0 && (
                          <span className="sp-b-gap-badge">
                            {totalGaps} gap{totalGaps !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="sp-b-chevron">
                          {expandedTopSections.has(key) ? '▲' : '▼'}
                        </span>
                      </button>

                      {expandedTopSections.has(key) && (
                        <div className="sp-b-nested">
                          {groups.map(({ cat, items, gapCount }) => {
                            const subKey = `${key}::${cat}`
                            return (
                              <div key={subKey} className="sp-b-section sp-b-sub-section">
                                <button
                                  className="sp-b-cat-header sp-b-sub-header"
                                  onClick={() => toggleSubCat(subKey)}
                                >
                                  <span className="sp-b-cat-name">{cat}</span>
                                  {gapCount > 0 && (
                                    <span className="sp-b-gap-badge">
                                      {gapCount} gap{gapCount !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                  <span className="sp-b-chevron">
                                    {expandedSubCats.has(subKey) ? '▲' : '▼'}
                                  </span>
                                </button>

                                {expandedSubCats.has(subKey) && (
                                  <div className="sp-b-items">
                                    {items.map(r => (
                                      <div key={r.name} className="sp-b-item">
                                        <span className="sp-b-item-name">{r.name}</span>
                                        {r.isGap
                                          ? <span className="sp-ind-dot">●</span>
                                          : <span className="sp-ind-tick">✓</span>
                                        }
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* ── Existing flat category sections ── */}
                  {bGrouped.map(({ cat, items, gapCount }) => (
                    <div key={cat} className="sp-b-section">
                      <button
                        className="sp-b-cat-header"
                        onClick={() => toggleCat(cat)}
                      >
                        <span className="sp-b-cat-name">{cat}</span>
                        {gapCount > 0 && (
                          <span className="sp-b-gap-badge">
                            {gapCount} gap{gapCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="sp-b-chevron">
                          {expandedCats.has(cat) ? '▲' : '▼'}
                        </span>
                      </button>

                      {expandedCats.has(cat) && (
                        <div className="sp-b-items">
                          {items.map(r => (
                            <div key={r.name} className="sp-b-item">
                              <span className="sp-b-item-name">{r.name}</span>
                              {r.isGap
                                ? <span className="sp-ind-dot">●</span>
                                : <span className="sp-ind-tick">✓</span>
                              }
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )
          ) : (
            /* ── Vitasoy render path (unchanged) ── */
            <>
              {!loading && rows.length > 0 && (
                <div className="sp-stats">
                  <div className="sp-stat">
                    <strong>{rows.filter(r => r.dis === 0).length}</strong>
                    <span>DIS gaps</span>
                  </div>
                  <div className="sp-stat">
                    <strong>{rows.filter(r => r.bnb13 === 0).length}</strong>
                    <span>13wk gaps</span>
                  </div>
                  <div className="sp-stat">
                    <strong>{rows.filter(r => r.bnb26 === 0).length}</strong>
                    <span>26wk gaps</span>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="sp-no-data">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="sp-no-data">No distribution data for this store.</div>
              ) : (
                <div className="sp-body">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th className="sp-th-name">Product</th>
                        <th className="sp-th-ind">DIS</th>
                        <th className="sp-th-ind">13wk</th>
                        <th className="sp-th-ind">26wk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped.map(({ cat, items }) => (
                        <Fragment key={cat}>
                          <tr className="sp-cat-row">
                            <td colSpan={4} className="sp-cat-header">{cat}</td>
                          </tr>
                          {items.map(row => (
                            <tr key={row.name} className="sp-product-row">
                              <td className="sp-td-name">{row.name}</td>
                              <td className="sp-td-ind"><Indicator val={row.dis} /></td>
                              <td className="sp-td-ind"><Indicator val={row.bnb13} /></td>
                              <td className="sp-td-ind"><Indicator val={row.bnb26} /></td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
