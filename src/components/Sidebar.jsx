import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Sidebar.css'

const NAV_STRUCTURE = [
  { label: 'Home', icon: '🏠' },
  {
    group: 'Rep Planner', icon: '📋',
    children: [
      { label: 'Distribution',   icon: '📦' },
      { label: 'Store Map',      icon: '🗺️' },
      { label: 'Store Contacts', icon: '📇' },
      { label: 'Cycle Planner',  icon: '📆' },
      { label: 'Promotions',     icon: '🏷️' },
      {
        group: 'Order Sheets', icon: '📝',
        children: [
          { label: 'Vitasoy Aug 2026', icon: '🥛', href: '/vitasoy-aug26-order.html' },
          { label: 'NIVEA SUN 2026',   icon: '☀️', href: '/nivea-sun-order.html' },
        ],
      },
    ],
  },
  { label: 'Perfect Store', icon: '🎯' },
  {
    group: 'Data', icon: '📊',
    children: [
      { label: 'MSO Pipeline',   icon: '📋' },
      { label: 'Coverage',       icon: '📍' },
      { label: 'GSV',            icon: '💰' },
      { label: 'Store Ranking',  icon: '🏆' },
      { label: 'Targets',        icon: '🎯' },
    ],
  },
  { label: 'Leave Calendar', icon: '📅' },
]

const ADMIN_GROUP = {
  group: 'Admin', icon: '🛡️',
  children: [
    { label: 'Data Upload',   icon: '📤' },
    { label: 'Weekly Upload', icon: '📥' },
    { label: 'Upload Logs',   icon: '📜' },
    { label: 'Admin',         icon: '🛡️' },
  ],
}

export default function Sidebar({ active, onNavigate, isOpen, onToggle }) {
  const allGroups = [...NAV_STRUCTURE, ADMIN_GROUP]
  const initialOpen = allGroups.find(
    item => item.children?.some(c => c.label === active)
  )?.group ?? null

  const [openMenu, setOpenMenu] = useState(initialOpen)
  const [openSubMenu, setOpenSubMenu] = useState(null)

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function toggleGroup(groupName) {
    setOpenMenu(prev => prev === groupName ? null : groupName)
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <button className="hamburger" onClick={onToggle} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        {isOpen && (
          <img src="/team-vb-logo.svg" alt="Team VB" width="48" height="48" className="sidebar-vb-badge" />
        )}
      </div>

      {isOpen && (
        <>
          <nav className="sidebar-nav">
            {NAV_STRUCTURE.map(item => {
              if (item.group) {
                const isGroupOpen = openMenu === item.group
                const hasActiveChild = item.children.some(c => c.label === active)
                return (
                  <div key={item.group}>
                    <button
                      className={`sidebar-link sidebar-group-header ${hasActiveChild ? 'active' : ''}`}
                      onClick={() => toggleGroup(item.group)}
                    >
                      <span className="sidebar-icon">{item.icon}</span>
                      {item.group}
                      <span className={`sidebar-chevron${isGroupOpen ? ' open' : ''}`}>›</span>
                    </button>
                    {isGroupOpen && (
                      <div className="sidebar-group-children">
                        {item.children.map(child => {
                          if (child.group) {
                            const isSubOpen = openSubMenu === child.group
                            return (
                              <div key={child.group}>
                                <button
                                  className="sidebar-link sidebar-child sidebar-group-header"
                                  onClick={() => setOpenSubMenu(prev => prev === child.group ? null : child.group)}
                                >
                                  <span className="sidebar-icon">{child.icon}</span>
                                  {child.group}
                                  <span className={`sidebar-chevron${isSubOpen ? ' open' : ''}`}>›</span>
                                </button>
                                {isSubOpen && (
                                  <div className="sidebar-group-children" style={{ paddingLeft: '0.75rem' }}>
                                    {child.children.map(link => (
                                      <a
                                        key={link.label}
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="sidebar-link sidebar-child"
                                      >
                                        <span className="sidebar-icon">{link.icon}</span>
                                        {link.label}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          }
                          if (child.href) {
                            return (
                              <a
                                key={child.label}
                                href={child.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="sidebar-link sidebar-child"
                              >
                                <span className="sidebar-icon">{child.icon}</span>
                                {child.label}
                              </a>
                            )
                          }
                          return (
                            <button
                              key={child.label}
                              className={`sidebar-link sidebar-child ${active === child.label ? 'active' : ''}`}
                              onClick={() => onNavigate(child.label)}
                            >
                              <span className="sidebar-icon">{child.icon}</span>
                              {child.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }
              if (item.href) {
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sidebar-link"
                  >
                    <span className="sidebar-icon">{item.icon}</span>
                    {item.label}
                  </a>
                )
              }
              return (
                <button
                  key={item.label}
                  className={`sidebar-link ${active === item.label ? 'active' : ''}`}
                  onClick={() => onNavigate(item.label)}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {item.label}
                  {item.soon && <span className="sidebar-soon">soon</span>}
                </button>
              )
            })}

            <div className="sidebar-divider" />

            {(() => {
              const isGroupOpen = openMenu === ADMIN_GROUP.group
              const hasActiveChild = ADMIN_GROUP.children.some(c => c.label === active)
              return (
                <div>
                  <button
                    className={`sidebar-link sidebar-group-header ${hasActiveChild ? 'active' : ''}`}
                    onClick={() => toggleGroup(ADMIN_GROUP.group)}
                  >
                    <span className="sidebar-icon">{ADMIN_GROUP.icon}</span>
                    {ADMIN_GROUP.group}
                    <span className={`sidebar-chevron${isGroupOpen ? ' open' : ''}`}>›</span>
                  </button>
                  {isGroupOpen && (
                    <div className="sidebar-group-children">
                      {ADMIN_GROUP.children.map(child => (
                        <button
                          key={child.label}
                          className={`sidebar-link sidebar-child ${active === child.label ? 'active' : ''}`}
                          onClick={() => onNavigate(child.label)}
                        >
                          <span className="sidebar-icon">{child.icon}</span>
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
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
