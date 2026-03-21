import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import StoreMap from './StoreMap'
import Tools from './Tools'
import Admin from './Admin'
import './Dashboard.css'

const PLACEHOLDER_PAGES = ['Distribution', 'Targets', 'MSO Pipeline', 'Perfect Store', 'Client']

export default function Dashboard() {
  const [activePage, setActivePage] = useState('Store Map')

  return (
    <div className="app-layout">
      <Sidebar active={activePage} onNavigate={setActivePage} />
      <main className="main-content">
        {activePage === 'Store Map' && <StoreMap />}
        {activePage === 'Tools' && <Tools />}
        {activePage === 'Admin' && <Admin />}
        {PLACEHOLDER_PAGES.includes(activePage) && (
          <div className="placeholder-page">
            <h2>{activePage}</h2>
            <p>Coming soon.</p>
          </div>
        )}
      </main>
    </div>
  )
}
