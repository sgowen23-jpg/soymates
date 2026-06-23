import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import StoreProfile from './StoreMap/StoreProfile'
import { chainColor } from './StoreMap/chainColors'
import './ShareView.css'

export default function ShareView({ slug }) {
  const [view, setView]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [selectedStore, setSelectedStore] = useState(null)

  useEffect(() => {
    supabase
      .from('shared_views')
      .select('client, filter_state, snapshot, created_at')
      .eq('id', slug)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setError('Shared view not found.')
        else setView(data)
        setLoading(false)
      })
  }, [slug])

  if (loading) return <div className="sv-loading">Loading…</div>
  if (error)   return <div className="sv-error">{error}</div>

  const filters     = view.filter_state || {}
  const filterParts = [
    filters.state          && filters.state          !== 'All' ? `State: ${filters.state}`               : null,
    filters.rep            && filters.rep            !== 'All' ? `Rep: ${filters.rep}`                   : null,
    filters.classification && filters.classification !== 'All' ? filters.classification                   : null,
    filters.search         && filters.search.trim()            ? `"${filters.search.trim()}"` : null,
  ].filter(Boolean)

  const stores = (view.snapshot || []).map(s => ({
    ...s,
    ssCount: s.rows.filter(r => r.isS).length,
    mhCount: s.rows.filter(r => r.isM).length,
  }))

  // frozenData: rows from snapshot with isGap: true added (all stored rows are gaps by construction)
  const frozenRows = selectedStore
    ? selectedStore.rows.map(r => ({ ...r, isGap: true }))
    : null

  const storeForPanel = selectedStore
    ? {
        id:      selectedStore.id,
        name:    selectedStore.name,
        state:   selectedStore.state,
        chain:   selectedStore.chain,
        banner:  selectedStore.banner,
        address: selectedStore.address,
        region:  selectedStore.region,
        rep:     selectedStore.rep,
      }
    : null

  return (
    <div className="sv-page">
      <div className="sv-header">
        <span className="sv-brand">Soymates</span>
        <div className="sv-meta">
          <span className="sv-title">Beiersdorf · Sea Salt &amp; Must Have Gaps</span>
          {filterParts.length > 0 && (
            <span className="sv-filters">{filterParts.join(' · ')}</span>
          )}
          <span className="sv-date">
            Captured {new Date(view.created_at).toLocaleDateString('en-AU')}
          </span>
        </div>
        <span className="sv-readonly">Read only</span>
      </div>

      <div className="sv-body">
        <div className="sv-list-wrap">
          {stores.length === 0 ? (
            <div className="sv-empty">No SS or MH gap stores in this snapshot.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Chain</th>
                  <th>State</th>
                  <th>SS Gaps</th>
                  <th>MH Gaps</th>
                  <th>Rep</th>
                </tr>
              </thead>
              <tbody>
                {stores.map(s => (
                  <tr
                    key={s.id}
                    className={`sv-row${selectedStore?.id === s.id ? ' sv-row-active' : ''}`}
                    onClick={() => setSelectedStore(s)}
                  >
                    <td className="sv-td-name">{s.name}</td>
                    <td>
                      <span
                        className="sv-chain-badge"
                        style={{ background: chainColor(s.chain) }}
                      >{s.chain}</span>
                    </td>
                    <td>{s.state}</td>
                    <td>
                      {s.ssCount > 0
                        ? <span className="sv-gap-pill sv-gap-red">{s.ssCount}</span>
                        : <span className="sv-gap-pill sv-gap-green">✓</span>}
                    </td>
                    <td>
                      {s.mhCount > 0
                        ? <span className="sv-gap-pill sv-gap-red">{s.mhCount}</span>
                        : <span className="sv-gap-pill sv-gap-green">✓</span>}
                    </td>
                    <td>{s.rep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <StoreProfile
          store={storeForPanel}
          onClose={() => setSelectedStore(null)}
          frozenData={frozenRows}
        />
      </div>
    </div>
  )
}
