import { useState } from 'react'
import MapView from './MapView'
import ListView from './ListView'
import StoreProfile from './StoreProfile'
import './StoreMap.css'

const VIEWS = ['Map', 'List']

export default function StoreMap() {
  const [view, setView] = useState('Map')
  const [selectedStore, setSelectedStore] = useState(null)

  function handleStoreClick(store) {
    setSelectedStore(store)
  }

  function closeProfile() {
    setSelectedStore(null)
  }

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
        <span className="storemap-title">Store Map</span>
      </div>

      <div className="storemap-content">
        {view === 'Map' && <MapView onStoreClick={handleStoreClick} />}
        {view === 'List' && <ListView onStoreClick={handleStoreClick} />}
      </div>

      <StoreProfile store={selectedStore} onClose={closeProfile} />
    </div>
  )
}
