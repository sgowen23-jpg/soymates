import { useState } from 'react'
import MapView from './MapView'
import StoreProfile from './StoreProfile'
import StoreSearchInput from '../../components/StoreSearchInput'
import { useClient } from '../../context/ClientContext'
import './StoreMap.css'

const STATES = ['All', 'NSW', 'QLD', 'SA', 'VIC', 'WA']
const REPS   = ['All', 'Azra Horell', 'David Kerr', 'David Saleeb', 'Dipen Surani', 'Sam Gowen', 'Shane Vandewardt']

export default function StoreMap() {
  const [selectedStore, setSelectedStore] = useState(null)
  const [state, setState] = useState('All')
  const [rep, setRep] = useState('All')
  const [search, setSearch] = useState('')
  const { client, setClient } = useClient()

  const filters = { state, rep }

  return (
    <div className="storemap-page">
      <div className="storemap-toolbar">
        <div className="filter-dropdowns">
          <StoreSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search store…"
          />
          <div className="toolbar-client-switcher">
            <button
              className={`toolbar-client-btn ${client === 'vitasoy' ? 'active' : ''}`}
              onClick={() => setClient('vitasoy')}
            >Vitasoy</button>
            <button
              className={`toolbar-client-btn ${client === 'beiersdorf' ? 'active' : ''}`}
              onClick={() => setClient('beiersdorf')}
            >Beiersdorf</button>
          </div>
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
        <MapView
          onStoreClick={s => setSelectedStore(s)}
          filters={filters}
          search={search}
        />
      </div>

      <StoreProfile store={selectedStore} onClose={() => setSelectedStore(null)} />
    </div>
  )
}
