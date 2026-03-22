import { useState } from 'react'
import ListView from './StoreMap/ListView'
import StoreProfile from './StoreMap/StoreProfile'
import './Distribution.css'

const STATES = ['All', 'NSW', 'QLD', 'SA', 'VIC', 'WA']
const REPS   = ['All', 'Azra Horell', 'Ashleigh Tasdarian', 'David Kerr', 'Dipen Surani', 'Sam Gowen', 'Shane Vandewardt']

export default function Distribution() {
  const [selectedStore, setSelectedStore] = useState(null)
  const [state, setState] = useState('All')
  const [rep, setRep] = useState('All')

  const filters = { state, rep }

  return (
    <div className="distribution-page">
      <div className="distribution-toolbar">
        <select className="filter-select" value={state} onChange={e => setState(e.target.value)}>
          {STATES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={rep} onChange={e => setRep(e.target.value)}>
          {REPS.map(r => <option key={r}>{r}</option>)}
        </select>
        <span className="distribution-title">Distribution</span>
      </div>

      <div className="distribution-content">
        <ListView onStoreClick={s => setSelectedStore(s)} filters={filters} />
      </div>

      <StoreProfile store={selectedStore} onClose={() => setSelectedStore(null)} />
    </div>
  )
}
