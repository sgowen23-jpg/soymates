import { useState, useMemo } from 'react'
import { STORES } from '../../data/stores'
import { BNB_DATA } from '../../data/bnbData'
import { chainColor } from './chainColors'
import './ListView.css'

function getStoreStats(name) {
  const data = BNB_DATA[name]
  if (!data?.products) return { gaps: '-', nbt: '-', listed: '-' }
  let gaps = 0, nbt = 0, listed = 0
  for (const p of Object.values(data.products)) {
    if (p.dis === 0)      gaps++
    else if (p.bnb === 0) nbt++
    else                  listed++
  }
  return { gaps, nbt, listed }
}

const ALL_CHAINS = [...new Set(STORES.map(s => s.chain))].sort()

export default function ListView({ onStoreClick, stateFilter }) {
  const [search, setSearch] = useState('')
  const [chainFilter, setChainFilter] = useState('')
  const [sortCol, setSortCol] = useState('name')
  const [sortAsc, setSortAsc] = useState(true)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return STORES.filter(s => {
      const matchSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        s.suburb.toLowerCase().includes(q) ||
        s.state.toLowerCase().includes(q)
      const matchChain = !chainFilter || s.chain === chainFilter
      const matchState = !stateFilter || stateFilter === 'All' || s.state === stateFilter
      return matchSearch && matchChain && matchState
    })
  }, [search, chainFilter, stateFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va, vb
      if (sortCol === 'gaps') {
        va = getStoreStats(a.name).gaps
        vb = getStoreStats(b.name).gaps
        if (va === '-') va = -1
        if (vb === '-') vb = -1
      } else {
        va = (a[sortCol] || '').toString().toLowerCase()
        vb = (b[sortCol] || '').toString().toLowerCase()
      }
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ? 1 : -1
      return 0
    })
  }, [filtered, sortCol, sortAsc])

  function toggleSort(col) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(true) }
  }

  function sortIcon(col) {
    if (sortCol !== col) return ''
    return sortAsc ? ' ↑' : ' ↓'
  }

  return (
    <div className="list-view">
      <div className="list-toolbar">
        <input
          className="list-search"
          type="search"
          placeholder="Search store, suburb, state…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="chain-filters">
          <button
            className={`chain-btn ${!chainFilter ? 'active' : ''}`}
            onClick={() => setChainFilter('')}
          >All</button>
          {ALL_CHAINS.map(c => (
            <button
              key={c}
              className={`chain-btn ${chainFilter === c ? 'active' : ''}`}
              style={chainFilter === c ? { background: chainColor(c), borderColor: chainColor(c) } : {}}
              onClick={() => setChainFilter(c === chainFilter ? '' : c)}
            >{c}</button>
          ))}
        </div>
        <span className="list-count">{sorted.length} stores</span>
      </div>

      <div className="list-wrap">
        <table className="store-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('name')}>Store{sortIcon('name')}</th>
              <th onClick={() => toggleSort('chain')}>Chain{sortIcon('chain')}</th>
              <th onClick={() => toggleSort('state')}>State{sortIcon('state')}</th>
              <th onClick={() => toggleSort('region')}>Region{sortIcon('region')}</th>
              <th onClick={() => toggleSort('gaps')}>Gaps{sortIcon('gaps')}</th>
              <th onClick={() => toggleSort('rep')}>Rep{sortIcon('rep')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(store => {
              const stats = getStoreStats(store.name)
              return (
                <tr key={store.id} onClick={() => onStoreClick(store)}>
                  <td>
                    <div className="store-name">{store.name}</div>
                    <div className="store-suburb">{store.suburb}</div>
                  </td>
                  <td>
                    <span
                      className="chain-badge"
                      style={{ background: chainColor(store.chain) }}
                    >{store.chain}</span>
                  </td>
                  <td>{store.state}</td>
                  <td>{store.region}</td>
                  <td>
                    {stats.gaps === '-' ? (
                      <span className="gap-pill grey">—</span>
                    ) : stats.gaps > 0 ? (
                      <span className="gap-pill red">{stats.gaps} gaps</span>
                    ) : (
                      <span className="gap-pill green">✓</span>
                    )}
                  </td>
                  <td className="rep-cell">{store.rep}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
