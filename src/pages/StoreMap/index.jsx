import { useState } from 'react'
import MapView from './MapView'
import ListView from './ListView'
import StoreProfile from './StoreProfile'
import './StoreMap.css'

const VIEWS = ['Map', 'List']

const CLIENTS = ['All', 'Vitasoy']
const STATES  = ['All', 'NSW', 'QLD', 'SA', 'VIC', 'WA']
const REPS    = ['All', 'Azra Horell', 'Ashleigh Tasdarian', 'David Kerr', 'Dipen Surani', 'Sam Gowen', 'Shane Vandewardt']

export default function StoreMap() {
  const [view, setView] = useState('Map')
  const [selectedStore, setSelectedStore] = useState(null)
  const [client, setClient] = useState('All')
  const [state, setState] = useState('All')
  const [rep, setRep] = useState('All')

  const filters = { client, state, rep }

  return (
    <div className="storemap-page">
      <div className="storemap-toolbar">
        <div className="view-tabs">
          {VIEWS.map(v => (
            <button
              key={v}
              className={`view-tab ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
            >{v}</button>
          ))}
        </div>

        <div className="filter-dropdowns">
          <select className="filter-select" value={client} onChange={e => setClient(e.target.value)}>
            {CLIENTS.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="filter-select" value={state} onChange={e => setState(e.target.value)}>
            {STATES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="filter-select" value={rep} onChange={e => setRep(e.target.value)}>
            {REPS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>

        <span className="storemap-title">Store Map</span>
      </div>

      <div className="storemap-content">
        {view === 'Map' && <MapView onStoreClick={s => setSelectedStore(s)} filters={filters} />}
        {view === 'List' && <ListView onStoreClick={s => setSelectedStore(s)} filters={filters} />}
      </div>

      <StoreProfile store={selectedStore} onClose={() => setSelectedStore(null)} />
    </div>
  )
}
