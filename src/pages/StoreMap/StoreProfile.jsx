import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getProductCategory } from '../../utils/productCategory'
import { chainColor } from './chainColors'
import './StoreProfile.css'

// Strip leading asterisk from product names (raw data uses * prefix for core range)
function clean(name) {
  return name.replace(/^\*\s*/, '').trim()
}

export default function StoreProfile({ store, onClose, bnbPeriod = '13wk' }) {
  const [productData, setProductData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!store) { setProductData(null); return }
    async function fetchData() {
      setLoading(true)
      setProductData(null)
      const table = bnbPeriod === '26wk' ? 'bnb_26wk' : 'bnb_13wk'
      const [distRes, bnbRes] = await Promise.all([
        supabase.from('store_distribution').select('item_name, latest_distribution').eq('location_id', store.id),
        supabase.from(table).select('item_name, ranging_gap, pog_category').eq('store_id', store.id),
      ])
      const bnbMap = {}
      const pogMap = {}
      bnbRes.data?.forEach(r => {
        const name = clean(r.item_name)
        bnbMap[name] = r.ranging_gap
        if (r.pog_category) pogMap[name] = r.pog_category
      })

      const gaps = [], nbt = [], good = []
      distRes.data?.forEach(r => {
        const name = clean(r.item_name)
        if (r.latest_distribution === 0) {
          gaps.push(name)
        } else {
          if (bnbMap[name] === 1) nbt.push(name)
          else good.push(name)
        }
      })
      setProductData({ gaps, nbt, good, pogMap })
      setLoading(false)
    }
    fetchData()
  }, [store, bnbPeriod])

  const gaps   = productData?.gaps   || []
  const nbt    = productData?.nbt    || []
  const good   = productData?.good   || []
  const pogMap = productData?.pogMap || {}

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

          {loading ? (
            <div className="sp-no-data">Loading…</div>
          ) : productData ? (
            <>
              <div className="sp-stats">
                <div className="sp-stat gap">
                  <strong>{gaps.length}</strong>
                  <span>Not Ranged</span>
                </div>
                <div className="sp-stat nbt">
                  <strong>{nbt.length}</strong>
                  <span>Not Bought</span>
                </div>
                <div className="sp-stat good">
                  <strong>{good.length}</strong>
                  <span>Buying</span>
                </div>
              </div>

              <div className="sp-body">
                <ProfileSection title="🔴 Not Ranged" items={gaps} pogMap={pogMap} type="gap" />
                <ProfileSection title={`🟡 Not Bought (${bnbPeriod})`} items={nbt} pogMap={pogMap} type="nbt" />
                <ProfileSection title="🟢 Ranged & Buying" items={good} pogMap={pogMap} type="good" />
              </div>
            </>
          ) : (
            <div className="sp-no-data">No distribution data for this store.</div>
          )}
        </>
      )}
    </div>
  )
}

const CATEGORY_ORDER = ['UHT Core', 'UHT', 'Fresh', 'Yoghurt']

function ProfileSection({ title, items, pogMap, type }) {
  if (!items.length) return null

  const grouped = {}
  items.forEach(k => {
    const cat = getProductCategory(k, pogMap[k])
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(k)
  })
  const byCategory = CATEGORY_ORDER.filter(c => grouped[c]).map(c => ({ cat: c, items: grouped[c] }))

  return (
    <div className="sp-section">
      <div className={`sp-section-title ${type}`}>{title} ({items.length})</div>
      {byCategory.map(({ cat, items: catItems }) => (
        <div key={cat}>
          <div className="sp-cat-label">{cat}</div>
          {catItems.map(k => (
            <div key={k} className={`sp-row ${type}`}>
              <div className="sp-dot" />
              <span>{k}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
