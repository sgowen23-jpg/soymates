import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import StoreMap from './StoreMap'
import Distribution from './Distribution'
import Tools from './Tools'
import Admin from './Admin'
import './Dashboard.css'

const PLACEHOLDER_PAGES = ['Targets', 'MSO Pipeline', 'Perfect Store', 'Client']

export default function Dashboard() {
  const [activePage, setActivePage] = useState('Store Map')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  function handleNavigate(page) {
    setActivePage(page)
    // On mobile, close sidebar after navigating
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        active={activePage}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      <main className={`main-content${!sidebarOpen ? ' sidebar-closed' : ''}`}>
        {/* Hamburger shown when sidebar is closed */}
        {!sidebarOpen && (
          <button className="hamburger-floating" onClick={() => setSidebarOpen(true)}>
            <span /><span /><span />
          </button>
        )}

        {activePage === 'Store Map' && <StoreMap />}
        {activePage === 'Distribution' && <Distribution />}
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
