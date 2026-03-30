import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import './Promotions.css'

const RETAILERS = ['IGA', 'Ritchies', 'Foodworks', 'Foodland', 'Drakes']

function toDate(str) {
  return new Date(str + 'T00:00:00')
}

function fmtWeekHeader(str) {
  const d = toDate(str)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function getCurrentWeek(weeks) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Find the latest week_start that is <= today
  return weeks.filter(w => toDate(w) <= today).slice(-1)[0] || null
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Promotions() {
  const [retailer, setRetailer]   = useState('IGA')
  const [month, setMonth]         = useState('all')
  const [promoType, setPromoType] = useState('all')
  const [data, setData]           = useState([])
  const [loading, setLoading]     = useState(true)

  // Make main-content scrollable while mounted
  useEffect(() => {
    const mc = document.querySelector('.main-content')
    if (mc) mc.style.overflowY = 'auto'
    return () => { if (mc) mc.style.overflowY = '' }
  }, [])

  // Load data for selected retailer
  useEffect(() => {
    setLoading(true)
    setData([])
    supabase
      .from('promo_calendar')
      .select('product_description, sku, week_start, promo_type, value, display_value')
      .eq('retailer', retailer)
      .order('week_start')
      .then(({ data: rows }) => {
        setData(rows || [])
        setLoading(false)
      })
  }, [retailer])

  // All unique weeks, sorted
  const allWeeks = useMemo(() => (
    [...new Set(data.map(r => r.week_start))].sort()
  ), [data])

  // Available months derived from data
  const availableMonths = useMemo(() => {
    const seen = new Set()
    allWeeks.forEach(w => {
      const d = toDate(w)
      seen.add(`${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`)
    })
    return [...seen].sort()
  }, [allWeeks])

  function monthLabel(key) {
    if (key === 'all') return 'All months'
    const [y, m] = key.split('-')
    const d = new Date(+y, +m, 1)
    return d.toLocaleString('en-AU', { month: 'short', year: '2-digit' })
  }

  // Filtered weeks by month
  const filteredWeeks = useMemo(() => {
    if (month === 'all') return allWeeks
    return allWeeks.filter(w => {
      const d = toDate(w)
      return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}` === month
    })
  }, [allWeeks, month])

  // Current week
  const currentWeek = useMemo(() => getCurrentWeek(allWeeks), [allWeeks])

  // Build lookup: product → promo_type → week_start → display_value
  const lookup = useMemo(() => {
    const map = {}
    data.forEach(r => {
      if (!map[r.product_description]) map[r.product_description] = {}
      if (!map[r.product_description][r.promo_type]) map[r.product_description][r.promo_type] = {}
      map[r.product_description][r.promo_type][r.week_start] = r.display_value || (r.value != null ? `$${r.value}` : '?')
    })
    return map
  }, [data])

  // Products visible based on promoType filter
  const products = useMemo(() => {
    const inRange = (pd, type) =>
      filteredWeeks.some(w => lookup[pd]?.[type]?.[w])

    const all = Object.keys(lookup).sort()
    if (promoType === 'all') return all
    if (promoType === 'price')     return all.filter(p => inRange(p, 'price'))
    if (promoType === 'case_deal') return all.filter(p => inRange(p, 'case_deal'))
    if (promoType === 'both')      return all.filter(p => inRange(p, 'price') && inRange(p, 'case_deal'))
    return all
  }, [lookup, filteredWeeks, promoType])

  // Month groups for header colspan
  const monthGroups = useMemo(() => {
    const groups = []
    filteredWeeks.forEach(w => {
      const d = toDate(w)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const label = d.toLocaleString('en-AU', { month: 'long', year: 'numeric' })
      if (!groups.length || groups[groups.length - 1].key !== key) {
        groups.push({ key, label, count: 1 })
      } else {
        groups[groups.length - 1].count++
      }
    })
    return groups
  }, [filteredWeeks])

  // Stats
  const activeProductCount = useMemo(() => {
    const cw = currentWeek
    if (!cw) return 0
    return products.filter(p =>
      lookup[p]?.['price']?.[cw] || lookup[p]?.['case_deal']?.[cw]
    ).length
  }, [products, lookup, currentWeek])

  const activePriceThisMonth = useMemo(() =>
    products.filter(p => filteredWeeks.some(w => lookup[p]?.['price']?.[w])).length,
    [products, filteredWeeks, lookup]
  )

  const activeCaseThisMonth = useMemo(() =>
    products.filter(p => filteredWeeks.some(w => lookup[p]?.['case_deal']?.[w])).length,
    [products, filteredWeeks, lookup]
  )

  return (
    <div className="promo-page">

      {/* ── Filter bar ── */}
      <div className="promo-topbar">
        <div className="promo-retailer-tabs">
          {RETAILERS.map(r => (
            <button
              key={r}
              className={`promo-retailer-tab ${retailer === r ? 'active' : ''}`}
              onClick={() => setRetailer(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="promo-filter-row">
          <select
            className="promo-select"
            value={month}
            onChange={e => setMonth(e.target.value)}
          >
            <option value="all">All months</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <div className="promo-type-tabs">
            {[['all','All'],['price','Price'],['case_deal','Case Deal'],['both','Both']].map(([v, l]) => (
              <button
                key={v}
                className={`promo-type-tab ${promoType === v ? 'active' : ''}`}
                onClick={() => setPromoType(v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="promo-stats">
        <div className="promo-stat">
          <div className="promo-stat-val">{products.length}</div>
          <div className="promo-stat-lbl">Products on promo</div>
        </div>
        <div className="promo-stat">
          <div className="promo-stat-val">{activePriceThisMonth}</div>
          <div className="promo-stat-lbl">Price promos {month === 'all' ? 'total' : 'this month'}</div>
        </div>
        <div className="promo-stat">
          <div className="promo-stat-val">{activeCaseThisMonth}</div>
          <div className="promo-stat-lbl">Case deals {month === 'all' ? 'total' : 'this month'}</div>
        </div>
        <div className="promo-stat">
          <div className="promo-stat-val">{activeProductCount}</div>
          <div className="promo-stat-lbl">Active this week</div>
        </div>
      </div>

      {/* ── Calendar table ── */}
      {loading ? (
        <div className="promo-loading">
          <div className="promo-spinner" />
          <p>Loading {retailer} promotions…</p>
        </div>
      ) : products.length === 0 ? (
        <div className="promo-empty">No promotions found for this filter.</div>
      ) : (
        <div className="promo-table-wrap">
          <table className="promo-table">
            <thead>
              {/* Month group row */}
              <tr className="promo-month-tr">
                <th className="promo-product-th">Product</th>
                {monthGroups.map(g => (
                  <th key={g.key} colSpan={g.count} className="promo-month-th">
                    {g.label}
                  </th>
                ))}
              </tr>
              {/* Week date row */}
              <tr className="promo-week-tr">
                <th className="promo-product-th promo-product-sub">
                  <span className="promo-legend">
                    <span className="promo-badge price-badge">Price</span>
                    <span className="promo-badge case-badge">Case Deal</span>
                  </span>
                </th>
                {filteredWeeks.map(w => (
                  <th
                    key={w}
                    className={`promo-week-th ${w === currentWeek ? 'current-week' : ''}`}
                  >
                    {fmtWeekHeader(w)}
                    {w === currentWeek && <span className="promo-now-dot" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((product, pi) => (
                <tr key={product} className={`promo-row ${pi % 2 === 1 ? 'alt' : ''}`}>
                  <td className="promo-product-td" title={product}>
                    {product}
                  </td>
                  {filteredWeeks.map(w => {
                    const pv = (promoType === 'all' || promoType === 'price' || promoType === 'both')
                      ? lookup[product]?.['price']?.[w]
                      : null
                    const cv = (promoType === 'all' || promoType === 'case_deal' || promoType === 'both')
                      ? lookup[product]?.['case_deal']?.[w]
                      : null
                    return (
                      <td
                        key={w}
                        className={`promo-cell ${w === currentWeek ? 'current-week' : ''} ${pv || cv ? 'has-promo' : ''}`}
                      >
                        {pv && <span className="promo-badge price-badge">{pv}</span>}
                        {cv && <span className="promo-badge case-badge">{cv}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
