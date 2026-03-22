import { supabase } from '../lib/supabase'
import './Sidebar.css'

const NAV_ITEMS = [
  { label: 'Home', icon: '🏠' },
  { label: 'Store Map', icon: '🗺️' },
  { label: 'Distribution', icon: '📦' },
  { label: 'Targets', icon: '🎯' },
  { label: 'MSO Pipeline', icon: '📋' },
  { label: 'Perfect Store', icon: '⭐' },
  { label: 'Client', icon: '🤝' },
  { label: 'Tools', icon: '🔧' },
  { label: 'Data Upload', icon: '📤' },
  { label: 'Leave Calendar', icon: '📅' },
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
            <span className="sidebar-logo-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="14" cy="14" r="13" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5"/>
                {/* Centre stem */}
                <line x1="14" y1="22" x2="14" y2="11" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                {/* Left leaf */}
                <path d="M14 16 C11 14 9 11 10 8 C11 8 13 10 14 13" fill="white"/>
                {/* Right leaf */}
                <path d="M14 14 C17 12 19 9 18 6 C17 6 15 8 14 11" fill="white"/>
                {/* Top leaf */}
                <path d="M14 11 C13 8 13.5 5 14 4 C14.5 5 15 8 14 11" fill="white"/>
              </svg>
            </span>
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
