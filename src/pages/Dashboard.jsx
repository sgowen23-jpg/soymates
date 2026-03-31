import { useState, lazy, Suspense } from 'react'
import Sidebar from '../components/Sidebar'
import './Dashboard.css'

// Lazy-load every page — they only download when first visited
const Home         = lazy(() => import('./Home'))
const StoreMap     = lazy(() => import('./StoreMap'))
const Distribution = lazy(() => import('./Distribution'))
const Tools        = lazy(() => import('./Tools'))
const Admin        = lazy(() => import('./Admin'))
const DataUpload   = lazy(() => import('./DataUpload'))
const LeaveCalendar = lazy(() => import('./LeaveCalendar'))
const Targets      = lazy(() => import('./Targets'))
const MSOPipeline  = lazy(() => import('./MSOPipeline'))
const PerfectStore = lazy(() => import('./PerfectStore'))
const CyclePlanner = lazy(() => import('./CyclePlanner'))
// Promotions temporarily disconnected — files kept for reference
// const Promotions   = lazy(() => import('./Promotions'))

function PageSpinner() {
  return (
    <div className="page-spinner">
      <div className="page-spinner-dot" />
      <p>Loading…</p>
    </div>
  )
}

const PLACEHOLDER_PAGES = []

export default function Dashboard() {
  const [activePage, setActivePage] = useState('Home')
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

        <Suspense fallback={<PageSpinner />}>
          {activePage === 'Home'          && <Home onNavigate={handleNavigate} />}
          {activePage === 'Store Map'     && <StoreMap />}
          {activePage === 'Distribution'  && <Distribution />}
          {activePage === 'Tools'         && <Tools />}
          {activePage === 'Admin'         && <Admin />}
          {activePage === 'Data Upload'   && <DataUpload />}
          {activePage === 'Leave Calendar'&& <LeaveCalendar />}
          {activePage === 'Targets'       && <Targets />}
          {activePage === 'MSO Pipeline'  && <MSOPipeline />}
          {activePage === 'Perfect Store' && <PerfectStore />}
          {activePage === 'Cycle Planner' && <CyclePlanner />}
          {/* Promotions temporarily disconnected */}
          {PLACEHOLDER_PAGES.includes(activePage) && (
            <div className="placeholder-page">
              <h2>{activePage}</h2>
              <p>Coming soon.</p>
            </div>
          )}
        </Suspense>
      </main>
    </div>
  )
}
