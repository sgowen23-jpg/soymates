import { useState } from 'react'
import ListView from './StoreMap/ListView'
import StoreProfile from './StoreMap/StoreProfile'
import StoreSearchInput from '../components/StoreSearchInput'
import './Distribution.css'

const STATES = ['All', 'NSW', 'QLD', 'SA', 'VIC', 'WA']
const REPS   = ['All', 'Azra Horell', 'Ashleigh Tasdarian', 'David Kerr', 'Dipen Surani', 'Sam Gowen', 'Shane Vandewardt']

export default function Distribution() {
  const [selectedStore, setSelectedStore] = useState(null)
  const [state, setState] = useState('All')
  const [rep, setRep] = useState('All')
  const [search, setSearch] = useState('')
  const [bnbPeriod, setBnbPeriod] = useState('13wk')

  const filters = { state, rep, search }

  return (
    <div className="distribution-page">
      <div className="distribution-toolbar">
        <StoreSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search store…"
        />
        <select className="filter-select" value={state} onChange={e => setState(e.target.value)}>
          {STATES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={rep} onChange={e => setRep(e.target.value)}>
          {REPS.map(r => <option key={r}>{r}</option>)}
        </select>
        <div className="bnb-toggle">
          <button
            className={`bnb-btn ${bnbPeriod === '13wk' ? 'active' : ''}`}
            onClick={() => setBnbPeriod('13wk')}
          >13 Wk</button>
          <button
            className={`bnb-btn ${bnbPeriod === '26wk' ? 'active' : ''}`}
            onClick={() => setBnbPeriod('26wk')}
          >26 Wk</button>
        </div>
        <span className="distribution-title">Distribution</span>
      </div>

      <div className="distribution-content">
        <ListView onStoreClick={s => setSelectedStore(s)} filters={filters} hideSearch bnbPeriod={bnbPeriod} />
      </div>

      <StoreProfile store={selectedStore} onClose={() => setSelectedStore(null)} bnbPeriod={bnbPeriod} />
    </div>
  )
}
