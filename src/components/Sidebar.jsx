import { supabase } from '../lib/supabase'
import './Sidebar.css'

const NAV_ITEMS = [
  { label: 'Store Map', icon: '🗺️' },
  { label: 'Distribution', icon: '📦' },
  { label: 'Targets', icon: '🎯' },
  { label: 'MSO Pipeline', icon: '📋' },
  { label: 'Perfect Store', icon: '⭐' },
  { label: 'Client', icon: '🤝' },
  { label: 'Tools', icon: '🔧' },
]

const ADMIN_ITEMS = [
  { label: 'Admin', icon: '🛡️' },
]

export default function Sidebar({ active, onNavigate }) {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo-icon">🌱</span>
        <span className="sidebar-title">Soymates</span>
      </div>

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
    </aside>
  )
}
