import { useState, useEffect } from 'react'
import ListView from './StoreMap/ListView'
import StoreProfile from './StoreMap/StoreProfile'
import StoreSearchInput from '../components/StoreSearchInput'
import ByProductView from './ByProductView'
import Targets from './Targets'
import BeiersdorfTargetsView from './Distribution/BeiersdorfTargetsView'
import VitasoyByProductView from './Distribution/VitasoyByProductView'
import { useClient } from '../context/ClientContext'
import { useDataFreshness } from '../hooks/useDataFreshness'
import './Distribution.css'

const STATES          = ['All', 'NSW', 'QLD', 'SA', 'VIC', 'WA']
const REPS            = ['All', 'David Kerr', 'Dipen Surani', 'Melissa Robbie', 'Sam Gowen', 'Shane Vandewardt']
const CLASSIFICATIONS = ['All', 'Metro', 'Regional', 'Remote']

export default function Distribution({ initialRep = null }) {
  const [view, setView]               = useState('store')
  const [selectedStore, setSelectedStore] = useState(null)
  const [state, setState]             = useState('All')
  const [rep, setRep]                 = useState(
    initialRep && REPS.includes(initialRep) ? initialRep : 'All'
  )
  const [classification, setClassification] = useState('All')
  const [search, setSearch]           = useState('')
  const [bnbPeriod, setBnbPeriod]     = useState('dis')
  const freshness                     = useDataFreshness()
  const { client, setClient }         = useClient()

  // Beiersdorf only has 26wk BNB data — DIS and 13wk paths query store_distribution (Vitasoy-only)
  useEffect(() => {
    if (client === 'beiersdorf') setBnbPeriod('26wk')
  }, [client])

  const filters = { state, rep, classification, search }

  const activeDate = bnbPeriod === '26wk' ? freshness.bnb26 : bnbPeriod === '13wk' ? freshness.bnb13 : freshness.dis

  return (
    <div className="distribution-page">
      <div className="distribution-toolbar">
        {/* View toggle */}
        <div className="view-toggle">
          <button
            className={`view-btn ${view === 'store' ? 'active' : ''}`}
            onClick={() => setView('store')}
          >By Store</button>
          <button
            className={`view-btn ${view === 'product' ? 'active' : ''}`}
            onClick={() => setView('product')}
          >By Product</button>
          <button
            className={`view-btn ${view === 'targets' ? 'active' : ''}`}
            onClick={() => setView('targets')}
          >Targets</button>
        </div>

        <div className="toolbar-client-switcher" data-client={client}>
          <button
            className={`toolbar-client-btn ${client === 'vitasoy' ? 'active' : ''}`}
            onClick={() => setClient('vitasoy')}
          >Vitasoy</button>
          <button
            className={`toolbar-client-btn ${client === 'beiersdorf' ? 'active' : ''}`}
            onClick={() => setClient('beiersdorf')}
          >Beiersdorf</button>
        </div>

        {view === 'store' && (
          <>
            <StoreSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search store…"
            />
            <div className="bnb-toggle">
              {client !== 'beiersdorf' && (
                <>
                  <button
                    className={`bnb-btn ${bnbPeriod === 'dis' ? 'active' : ''}`}
                    onClick={() => setBnbPeriod('dis')}
                  >DIS</button>
                  <button
                    className={`bnb-btn ${bnbPeriod === '13wk' ? 'active' : ''}`}
                    onClick={() => setBnbPeriod('13wk')}
                  >13 Wk</button>
                </>
              )}
              <button
                className={`bnb-btn ${bnbPeriod === '26wk' ? 'active' : ''}`}
                onClick={() => setBnbPeriod('26wk')}
              >26 Wk</button>
            </div>
            {activeDate && <span className="data-freshness">Data: {activeDate}</span>}
          </>
        )}

        <select className="filter-select" value={state} onChange={e => setState(e.target.value)}>
          {STATES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={rep} onChange={e => setRep(e.target.value)}>
          {REPS.map(r => <option key={r}>{r}</option>)}
        </select>
        <select className="filter-select" value={classification} onChange={e => setClassification(e.target.value)}>
          {CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}
        </select>

        <span className="distribution-title">Distribution</span>
      </div>

      {view === 'store' && (
        <>
          <div className="distribution-content">
            <ListView onStoreClick={s => setSelectedStore(s)} filters={filters} hideSearch bnbPeriod={bnbPeriod} />
          </div>
          <StoreProfile store={selectedStore} onClose={() => setSelectedStore(null)} bnbPeriod={bnbPeriod} />
        </>
      )}
      {view === 'product' && client === 'vitasoy'    && <VitasoyByProductView state={state} rep={rep} classification={classification} />}
      {view === 'product' && client === 'beiersdorf' && <BeiersdorfTargetsView state={state} rep={rep} classification={classification} />}
      {view === 'product' && client !== 'vitasoy' && client !== 'beiersdorf' && (
        <div className="distribution-content">
          <ByProductView state={state} rep={rep} classification={classification} />
        </div>
      )}
      {view === 'targets' && client === 'vitasoy'    && <Targets />}
    </div>
  )
}
