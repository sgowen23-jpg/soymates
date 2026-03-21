import { useEffect } from 'react'
import { BNB_DATA } from '../../data/bnbData'
import { PROD_CATEGORIES } from '../../data/prodCategories'
import { chainColor } from './chainColors'
import './StoreProfile.css'

function getStoreData(name) {
  return BNB_DATA[name] || null
}

export default function StoreProfile({ store, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const data = store ? getStoreData(store.name) : null

  let gaps = [], nbt = [], good = []
  if (data?.products) {
    for (const [k, p] of Object.entries(data.products)) {
      if (p.dis === 0)      gaps.push(k)
      else if (p.bnb === 0) nbt.push(k)
      else                  good.push(k)
    }
  }

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
              {data?.rep && <span>Rep: {data.rep}</span>}
            </div>
          </div>

          {data ? (
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
                <ProfileSection title="🔴 Not Ranged" items={gaps} type="gap" />
                <ProfileSection title="🟡 Not Bought (13wk)" items={nbt} type="nbt" />
                <ProfileSection title="🟢 Ranged & Buying" items={good} type="good" />
              </div>
            </>
          ) : (
            <div className="sp-no-data">No BnB data for this store.</div>
          )}
        </>
      )}
    </div>
  )
}

function ProfileSection({ title, items, type }) {
  if (!items.length) return null

  // Group by product category
  const byCategory = []
  for (const [cat, skus] of Object.entries(PROD_CATEGORIES)) {
    const catItems = items.filter(k => skus.includes(k))
    if (catItems.length) byCategory.push({ cat, items: catItems })
  }
  // Uncategorised
  const allCatSkus = Object.values(PROD_CATEGORIES).flat()
  const uncategorised = items.filter(k => !allCatSkus.includes(k))
  if (uncategorised.length) byCategory.push({ cat: 'Other', items: uncategorised })

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
