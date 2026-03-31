import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import './Promotions.css'

const RETAILERS = ['IGA', 'Ritchies', 'Foodworks', 'Foodland', 'Drakes']
const MONTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const METCASH_WEEKS = {
  '2025-11-05': 32, '2025-11-12': 33, '2025-11-19': 34, '2025-11-26': 35,
  '2025-12-03': 36, '2025-12-10': 37, '2025-12-17': 38, '2025-12-24': 39,
  '2025-12-31': 40, '2026-01-07': 41, '2026-01-14': 42, '2026-01-21': 43,
  '2026-01-28': 44, '2026-02-04': 45, '2026-02-11': 46, '2026-02-18': 47,
  '2026-02-25': 48, '2026-03-04': 49, '2026-03-11': 50, '2026-03-18': 51,
  '2026-03-25': 52, '2026-04-01':  1, '2026-04-08':  2, '2026-04-15':  3,
  '2026-04-22':  4, '2026-04-29':  5, '2026-05-06':  6, '2026-05-13':  7,
  '2026-05-20':  8, '2026-05-27':  9, '2026-06-03': 10, '2026-06-10': 11,
  '2026-06-17': 12, '2026-06-24': 13, '2026-07-01': 14, '2026-07-08': 15,
  '2026-07-15': 16, '2026-07-22': 17, '2026-07-29': 18, '2026-08-05': 19,
  '2026-08-12': 20, '2026-08-19': 21, '2026-08-26': 22, '2026-09-02': 23,
  '2026-09-09': 24, '2026-09-16': 25, '2026-09-23': 26, '2026-09-30': 27,
  '2026-10-07': 28, '2026-10-14': 29, '2026-10-21': 30, '2026-10-28': 31,
}

function toDate(str) { return new Date(str + 'T00:00:00') }
function fmtWeekHeader(str) {
  const d = toDate(str)
  return `${d.getDate()}/${d.getMonth() + 1}`
}
function fmtWeekLong(str) {
  const d = toDate(str)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}
function getCurrentWeek(weeks) {
  if (!weeks.length) return null
  const today = new Date(); today.setHours(0,0,0,0)
  // Find the last week whose start is <= today (the week currently in progress)
  let current = null
  for (const w of weeks) {
    if (toDate(w) <= today) current = w
    else break
  }
  // If today is before the first week, highlight the first week anyway
  return current || weeks[0]
}
function isUHT(p) { return /uht/i.test(p) }

function getSegment(p) {
  if (/ygt/i.test(p))       return 'Yoghurt'
  if (/frsh|esl/i.test(p))  return 'Fresh'
  if (/uht/i.test(p))       return 'UHT'
  return 'Other'
}

function segClass(seg) {
  if (seg === 'UHT')     return 'seg-uht'
  if (seg === 'Fresh')   return 'seg-fresh'
  if (seg === 'Yoghurt') return 'seg-yoghurt'
  return 'seg-other'
}

// Split a product name at a word boundary around maxChars
function splitName(name, maxChars = 22) {
  if (name.length <= maxChars) return [name, '']
  const slice = name.slice(0, maxChars + 1)
  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace > 0) return [name.slice(0, lastSpace), name.slice(lastSpace + 1)]
  return [name.slice(0, maxChars), name.slice(maxChars)]
}

// ─── Mobile List View ─────────────────────────────────────────────────────────
function PromoListView({ productRows, orderedProducts, lookup, filteredWeeks, currentWeek }) {
  const cards = useMemo(() => {
    const seen = new Set()
    const list = []
    productRows.forEach(({ p }) => {
      if (!seen.has(p)) { seen.add(p); list.push(p) }
    })
    return list.map(p => {
      const types = productRows.filter(r => r.p === p).map(r => r.type)
      const activeWeeks = filteredWeeks.filter(w =>
        types.some(t => lookup[p]?.[t]?.[w])
      )
      return { p, types, activeWeeks }
    })
  }, [productRows, filteredWeeks, lookup])

  if (cards.length === 0) return (
    <div className="promo-empty">No promotions found for this filter.</div>
  )

  return (
    <div className="promo-list-view">
      {cards.map(({ p, types, activeWeeks }) => {
        const seg = isUHT(p) ? 'UHT' : getSegment(p)
        return (
          <div key={p} className="promo-card">
            <div className="promo-card-header">
              <span className="promo-card-name">{p}</span>
              <span className={`promo-card-seg ${segClass(seg)}`}>{seg}</span>
            </div>
            <div className="promo-card-weeks">
              {activeWeeks.length === 0
                ? <span style={{ fontSize: 12, color: '#aaa' }}>No promos in selected period</span>
                : activeWeeks.map(w => {
                  const priceVal = lookup[p]?.['price']?.[w]
                  const caseVal  = lookup[p]?.['case_deal']?.[w]
                  const isCurrent = w === currentWeek
                  return (
                    <div key={w} className="promo-card-week-row"
                      style={isCurrent ? { background: '#fffbea', borderRadius: 4, padding: '2px 4px', margin: '0 -4px' } : {}}>
                      <span className="promo-card-date">{fmtWeekLong(w)}</span>
                      <div className="promo-card-badges">
                        {priceVal && <span className="promo-badge price-badge">{priceVal}</span>}
                        {caseVal  && <span className="promo-badge case-badge">{caseVal}</span>}
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Promotions() {
  const [retailer, setRetailer]     = useState('IGA')
  const [month, setMonth]           = useState('all')
  const [category, setCategory]     = useState('all')
  const [mobileView, setMobileView] = useState('table')
  const [data, setData]             = useState([])
  const [loading, setLoading]       = useState(true)
  const tableWrapRef  = useRef(null)
  const didAutoScroll = useRef(false)

  useEffect(() => {
    setLoading(true)
    setData([])
    supabase
      .from('promo_calendar')
      .select('product_description, week_start, promo_type, value, display_value, sort_order')
      .eq('retailer', retailer)
      .gte('week_start', '2026-01-01')
      .order('sort_order', { ascending: true })
      .order('promo_type', { ascending: true })
      .then(({ data: rows }) => {
        setData(rows || [])
        setLoading(false)
      })
  }, [retailer])

  const allWeeks = useMemo(() => (
    [...new Set(data.map(r => r.week_start))].sort()
  ), [data])

  const availableMonths = useMemo(() => {
    const seen = new Set()
    allWeeks.forEach(w => {
      const d = toDate(w)
      seen.add(`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`)
    })
    return [...seen].sort()
  }, [allWeeks])

  function monthLabel(key) {
    const [y, m] = key.split('-')
    return new Date(+y, +m, 1).toLocaleString('en-AU', { month: 'short', year: '2-digit' })
  }

  const filteredWeeks = useMemo(() => {
    if (month === 'all') return allWeeks
    return allWeeks.filter(w => {
      const d = toDate(w)
      return `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}` === month
    })
  }, [allWeeks, month])

  const currentWeek = useMemo(() => getCurrentWeek(allWeeks), [allWeeks])

  const lookup = useMemo(() => {
    const map = {}
    data.forEach(r => {
      if (!map[r.product_description]) map[r.product_description] = {}
      if (!map[r.product_description][r.promo_type]) map[r.product_description][r.promo_type] = {}
      map[r.product_description][r.promo_type][r.week_start] =
        r.display_value || (r.value != null ? `$${r.value}` : '?')
    })
    return map
  }, [data])

  const orderedProducts = useMemo(() => {
    const seen = new Set()
    const list = []
    data.forEach(r => {
      if (!seen.has(r.product_description)) {
        seen.add(r.product_description)
        list.push(r.product_description)
      }
    })
    return list
  }, [data])

  // Always show both types — no promoType filter
  const productRows = useMemo(() => {
    const inRange = (p, type) => filteredWeeks.some(w => lookup[p]?.[type]?.[w])

    let filtered = orderedProducts
    if (category === 'uht')   filtered = filtered.filter(isUHT)
    if (category === 'dairy') filtered = filtered.filter(p => !isUHT(p))

    const rows = []
    filtered.forEach(p => {
      if (inRange(p, 'price'))     rows.push({ p, type: 'price' })
      if (inRange(p, 'case_deal')) rows.push({ p, type: 'case_deal' })
    })
    return rows
  }, [orderedProducts, lookup, filteredWeeks, category])

  const monthGroups = useMemo(() => {
    const groups = []
    filteredWeeks.forEach(w => {
      const d = toDate(w)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const label = d.toLocaleString('en-AU', { month: 'long', year: 'numeric' })
      if (!groups.length || groups[groups.length-1].key !== key)
        groups.push({ key, label, count: 1 })
      else
        groups[groups.length-1].count++
    })
    return groups
  }, [filteredWeeks])

  const uniqueProducts = useMemo(() => [...new Set(productRows.map(r => r.p))], [productRows])
  const activeProductCount = useMemo(() => {
    if (!currentWeek) return 0
    return uniqueProducts.filter(p =>
      lookup[p]?.['price']?.[currentWeek] || lookup[p]?.['case_deal']?.[currentWeek]
    ).length
  }, [uniqueProducts, lookup, currentWeek])
  const activePriceCount = useMemo(() =>
    uniqueProducts.filter(p => filteredWeeks.some(w => lookup[p]?.['price']?.[w])).length,
    [uniqueProducts, filteredWeeks, lookup])
  const activeCaseCount = useMemo(() =>
    uniqueProducts.filter(p => filteredWeeks.some(w => lookup[p]?.['case_deal']?.[w])).length,
    [uniqueProducts, filteredWeeks, lookup])

  // Auto-scroll to current week on first render of the table
  useEffect(() => {
    if (!currentWeek || !tableWrapRef.current || didAutoScroll.current) return
    const th = tableWrapRef.current.querySelector(`th[data-week="${currentWeek}"]`)
    if (!th) return
    didAutoScroll.current = true
    const wrap = tableWrapRef.current
    console.log(`[Promotions] ${retailer} — scrollWidth: ${wrap.scrollWidth}, clientWidth: ${wrap.clientWidth}, overflow: ${wrap.scrollWidth > wrap.clientWidth ? 'YES (table wider than container)' : 'NO (table fits — nothing to scroll)'}`)
    const stickyWidth = 220 + 52 // product + type columns
    const colOffset = th.offsetLeft
    const colWidth  = th.offsetWidth
    const viewWidth = wrap.clientWidth
    wrap.scrollLeft = colOffset - stickyWidth - (viewWidth - stickyWidth - colWidth) / 2
  }, [currentWeek, filteredWeeks, loading])

  // Reset auto-scroll flag when retailer changes so it re-centres on new data
  useEffect(() => { didAutoScroll.current = false }, [retailer])

  return (
    <div className="promo-page">

      {/* ── Filter bar ── */}
      <div className="promo-topbar">
        <div className="promo-retailer-tabs">
          {RETAILERS.map(r => (
            <button key={r}
              className={`promo-retailer-tab ${retailer === r ? 'active' : ''}`}
              onClick={() => setRetailer(r)}>{r}</button>
          ))}
        </div>
        <div className="promo-filter-row">
          <select className="promo-select" value={month} onChange={e => setMonth(e.target.value)}>
            <option value="all">All months</option>
            {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <div className="promo-type-tabs">
            {[['all','All'],['uht','UHT'],['dairy','Dairy']].map(([v,l]) => (
              <button key={v}
                className={`promo-type-tab ${category === v ? 'active' : ''}`}
                onClick={() => setCategory(v)}>{l}</button>
            ))}
          </div>
        </div>

        {/* Table / List toggle */}
        <div className="promo-view-toggle">
          <button
            className={`promo-mobile-toggle-btn ${mobileView === 'table' ? 'active' : ''}`}
            onClick={() => setMobileView('table')}>Table</button>
          <button
            className={`promo-mobile-toggle-btn ${mobileView === 'list' ? 'active' : ''}`}
            onClick={() => setMobileView('list')}>List</button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="promo-stats">
        <div className="promo-stat">
          <div className="promo-stat-val">{uniqueProducts.length}</div>
          <div className="promo-stat-lbl">Products on promo</div>
        </div>
        <div className="promo-stat">
          <div className="promo-stat-val">{activePriceCount}</div>
          <div className="promo-stat-lbl">Price promos {month === 'all' ? 'total' : 'this month'}</div>
        </div>
        <div className="promo-stat">
          <div className="promo-stat-val">{activeCaseCount}</div>
          <div className="promo-stat-lbl">Case deals {month === 'all' ? 'total' : 'this month'}</div>
        </div>
        <div className="promo-stat">
          <div className="promo-stat-val">{activeProductCount}</div>
          <div className="promo-stat-lbl">Active this week</div>
        </div>
      </div>

      {/* ── Calendar table / List ── */}
      {loading ? (
        <div className="promo-loading">
          <div className="promo-spinner" />
          <p>Loading {retailer} promotions…</p>
        </div>
      ) : productRows.length === 0 ? (
        <div className="promo-empty">No promotions found for this filter.</div>
      ) : mobileView === 'list' ? (
        <PromoListView
          productRows={productRows}
          orderedProducts={orderedProducts}
          lookup={lookup}
          filteredWeeks={filteredWeeks}
          currentWeek={currentWeek}
        />
      ) : (
        <div className="promo-table-outer">
          <div className="promo-table-wrap" ref={tableWrapRef}>
            <table className="promo-table">
              <thead>
                <tr className="promo-month-tr">
                  <th className="promo-product-th">Product</th>
                  <th className="promo-type-th"></th>
                  {monthGroups.map(g => (
                    <th key={g.key} colSpan={g.count} className="promo-month-th">{g.label}</th>
                  ))}
                </tr>
                <tr className="promo-metcash-tr">
                  <th className="promo-product-th promo-metcash-label-th">Metcash Wk</th>
                  <th className="promo-type-th"></th>
                  {filteredWeeks.map(w => (
                    <th key={w} className={`promo-metcash-th ${w === currentWeek ? 'current-week' : ''}`}>
                      {METCASH_WEEKS[w] ?? ''}
                    </th>
                  ))}
                </tr>
                <tr className="promo-week-tr">
                  <th className="promo-product-th promo-product-sub"></th>
                  <th className="promo-type-th promo-type-sub">Type</th>
                  {filteredWeeks.map(w => (
                    <th key={w} data-week={w} className={`promo-week-th ${w === currentWeek ? 'current-week' : ''}`}>
                      {w === currentWeek
                        ? <><span className="promo-now-label">Now</span>{fmtWeekHeader(w)}</>
                        : fmtWeekHeader(w)
                      }
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productRows.map(({ p, type }, pi) => {
                  const productIdx      = orderedProducts.indexOf(p)
                  const isAlt           = productIdx % 2 === 1
                  const isFirstOfProduct = pi === 0 || productRows[pi-1].p !== p
                  const isLastOfProduct  = pi === productRows.length - 1 || productRows[pi+1].p !== p

                  // Split name: line1 in first row, line2 in last row (sub-row)
                  const [line1, line2] = splitName(p)
                  // Show line2 only in the sub-row of a multi-row product
                  const hasSubRow = !isLastOfProduct || !isFirstOfProduct
                  // This row is the sub-row (second/last row of a product)
                  const isSubRow  = !isFirstOfProduct

                  return (
                    <tr key={`${p}_${type}`} className={`promo-row ${isAlt ? 'alt' : ''} ${isSubRow ? 'promo-sub-row' : ''}`}>
                      <td
                        className={`promo-product-td ${isSubRow ? 'promo-product-td-sub' : ''}`}
                        title={p}
                      >
                        {isFirstOfProduct ? line1 : line2 || ''}
                      </td>
                      <td className={`promo-type-cell ${type === 'price' ? 'type-price' : 'type-case'}`}>
                        {type === 'price' ? 'Price' : 'Case'}
                      </td>
                      {filteredWeeks.map(w => {
                        const val = lookup[p]?.[type]?.[w]
                        return (
                          <td key={w}
                            className={`promo-cell ${w === currentWeek ? 'current-week' : ''} ${isSubRow ? 'promo-cell-sub' : ''}`}>
                            {val && (
                              <span className={`promo-badge ${type === 'price' ? 'price-badge' : 'case-badge'}`}>
                                {val}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
