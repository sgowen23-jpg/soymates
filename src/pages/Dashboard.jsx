import { useState, lazy, Suspense } from 'react'
import { supabase } from '../lib/supabase'
import { ClientProvider } from '../context/ClientContext'
import './Dashboard.css'

// Lazy-load every page — they only download when first visited
const Home         = lazy(() => import('./Home'))
const StoreMap     = lazy(() => import('./StoreMap'))
const Distribution = lazy(() => import('./Distribution'))
const Tools        = lazy(() => import('./Tools'))
const Admin        = lazy(() => import('./Admin'))
const DataUpload    = lazy(() => import('./DataUpload'))
const WeeklyUpload  = lazy(() => import('./WeeklyUpload'))
const UploadLogs    = lazy(() => import('./UploadLogs'))
const LeaveCalendar = lazy(() => import('./LeaveCalendar'))
const MSOPipeline  = lazy(() => import('./MSOPipeline'))
const CyclePlanner = lazy(() => import('./CyclePlanner'))
const Promotions      = lazy(() => import('./Promotions'))
const StoreContacts   = lazy(() => import('./StoreContacts'))
const PerfectStore    = lazy(() => import('./PerfectStore'))
const Coverage        = lazy(() => import('./Coverage'))

function PageSpinner() {
  return (
    <div className="page-spinner">
      <div className="page-spinner-dot" />
      <p>Loading…</p>
    </div>
  )
}

const PLACEHOLDER_PAGES = ['GSV', 'Store Ranking', 'Targets']

// Everything that isn't a launcher tile lives behind the cog.
const OVERFLOW = [
  {
    group: 'Data & reports',
    items: [
      { label: 'MSO Pipeline',  icon: '📋' },
      { label: 'Coverage',      icon: '📍' },
      { label: 'GSV',           icon: '💰' },
      { label: 'Store Ranking', icon: '🏆' },
      { label: 'Targets',       icon: '🎯' },
    ],
  },
  {
    group: 'Admin',
    items: [
      { label: 'Data Upload',   icon: '📤' },
      { label: 'Weekly Upload', icon: '📥' },
      { label: 'Upload Logs',   icon: '📜' },
      { label: 'Admin',         icon: '🛡️' },
    ],
  },
]

export default function Dashboard() {
  const [activePage, setActivePage] = useState('Home')
  const [selectedRep, setSelectedRep] = useState(null)
  const [cogOpen, setCogOpen] = useState(false)

  function handleNavigate(page, rep = null) {
    setSelectedRep(rep)
    setActivePage(page)
    setCogOpen(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <ClientProvider>
      <div className="shell">
        <header className="topbar">
          <button className="topbar-home" onClick={() => handleNavigate('Home')} aria-label="Home">
            <span className="topbar-badge">
              <img src="/team-vb-logo.svg" alt="" width="30" height="30" />
            </span>
            <span className="topbar-brand">Team VB</span>
          </button>

          {activePage !== 'Home' && <span className="topbar-page">{activePage}</span>}

          <div className="topbar-right">
            <button
              className="topbar-cog"
              onClick={() => setCogOpen(o => !o)}
              aria-label="Menu"
              aria-expanded={cogOpen}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3.4" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15z" />
              </svg>
            </button>

            {cogOpen && (
              <>
                <div className="cog-scrim" onClick={() => setCogOpen(false)} />
                <div className="cog-panel" role="menu">
                  {OVERFLOW.map(g => (
                    <div key={g.group}>
                      <div className="cog-group">{g.group}</div>
                      {g.items.map(it => (
                        <button
                          key={it.label}
                          className={`cog-item ${activePage === it.label ? 'active' : ''}`}
                          onClick={() => handleNavigate(it.label)}
                          role="menuitem"
                        >
                          <span className="cog-item-icon">{it.icon}</span>{it.label}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className="cog-group">Session</div>
                  <button className="cog-item" onClick={handleSignOut} role="menuitem">
                    <span className="cog-item-icon">↩︎</span>Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="content">
          <Suspense fallback={<PageSpinner />}>
            {activePage === 'Home'          && <Home onNavigate={handleNavigate} />}
            {activePage === 'Store Map'     && <StoreMap />}
            {activePage === 'Distribution'   && <Distribution initialRep={selectedRep} />}
            {activePage === 'Store Contacts' && <StoreContacts />}
            {activePage === 'Tools'         && <Tools />}
            {activePage === 'Admin'         && <Admin />}
            {activePage === 'Data Upload'    && <DataUpload />}
            {activePage === 'Weekly Upload'  && <WeeklyUpload />}
            {activePage === 'Upload Logs'    && <UploadLogs />}
            {activePage === 'Leave Calendar'&& <LeaveCalendar />}
            {activePage === 'MSO Pipeline'  && <MSOPipeline />}
            {activePage === 'Cycle Planner' && <CyclePlanner />}
            {activePage === 'Promotions'    && <Promotions />}
            {activePage === 'Perfect Store' && <PerfectStore />}
            {activePage === 'Coverage'     && <Coverage />}
            {PLACEHOLDER_PAGES.includes(activePage) && (
              <div className="placeholder-page">
                <h2>{activePage}</h2>
                <p>Coming soon.</p>
              </div>
            )}
          </Suspense>
        </main>
      </div>
    </ClientProvider>
  )
}
