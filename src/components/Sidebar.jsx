import { supabase } from '../lib/supabase'
import './Sidebar.css'

const NAV_ITEMS = [
  { label: 'Home', icon: '🏠' },
  { label: 'Store Map', icon: '🗺️' },
  { label: 'Distribution', icon: '📦' },
  { label: 'Targets', icon: '🎯' },
  { label: 'MSO Pipeline', icon: '📋' },
  { label: 'Perfect Store', icon: '⭐' },
  { label: 'Data Upload', icon: '📤' },
  { label: 'Leave Calendar', icon: '📅' },
  { label: 'Chat bot', icon: '💬', soon: true },
  { label: 'Download', icon: '⬇️', soon: true },
]

const ADMIN_ITEMS = [
  { label: 'Admin', icon: '🛡️' },
]

export default function Sidebar({ active, onNavigate, isOpen, onToggle }) {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <button className="hamburger" onClick={onToggle} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        {isOpen && (
          <>
            <img src="/vitasoy-logo-white.svg" alt="Vitasoy" className="sidebar-vitasoy-logo" />
            <span className="sidebar-title">Soymates</span>
          </>
        )}
      </div>

      {isOpen && (
        <>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.label}
                className={`sidebar-link ${active === item.label ? 'active' : ''}`}
                onClick={() => onNavigate(item.label)}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {item.label}
                {item.soon && <span className="sidebar-soon">soon</span>}
              </button>
            ))}

            <div className="sidebar-divider" />

            {ADMIN_ITEMS.map(item => (
              <button
                key={item.label}
                className={`sidebar-link ${active === item.label ? 'active' : ''}`}
                onClick={() => onNavigate(item.label)}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className="sidebar-signout" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
