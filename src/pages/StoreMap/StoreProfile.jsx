import { useEffect, useState, Fragment } from 'react'
import { supabase } from '../../lib/supabase'
import { getProductCategory } from '../../utils/productCategory'
import { getRules, isProductValidForStore } from '../../utils/rangingRules'
import { chainColor } from './chainColors'
import './StoreProfile.css'

function clean(name) {
  return name.replace(/^\*\s*/, '').trim()
}

const CATEGORY_ORDER = ['UHT Core', 'UHT', 'Fresh', 'Yoghurt']

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

export default function StoreProfile({ store, onClose }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!store) { setRows([]); return }
    async function fetchData() {
      setLoading(true)
      setRows([])

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
          category: getProductCategory(name, pog),
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
  }, [store])

  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, items: rows.filter(r => r.category === cat) }))
    .filter(g => g.items.length > 0)

  const knownCats = new Set(CATEGORY_ORDER)
  const others = rows.filter(r => !knownCats.has(r.category))
  if (others.length) grouped.push({ cat: 'Other', items: others })

  return (
    <div className={`store-profile ${store ? 'open' : ''}`}>
      {store && (
        <>
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
    </div>
  )
}
