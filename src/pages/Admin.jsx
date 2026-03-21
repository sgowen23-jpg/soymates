import './Admin.css'

const ADMIN_TOOLS = [
  {
    id: 'data-entry',
    icon: '📥',
    label: 'Data Entry',
    description: 'Upload and update store, BnB, and distribution data.',
    status: 'coming-soon',
  },
]

export default function Admin() {
  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>Admin</h2>
        <span className="admin-badge">Restricted</span>
      </div>
      <div className="admin-grid">
        {ADMIN_TOOLS.map(tool => (
          <div key={tool.id} className={`admin-card ${tool.status}`}>
            <div className="admin-card-icon">{tool.icon}</div>
            <div className="admin-card-info">
              <div className="admin-card-label">{tool.label}</div>
              <div className="admin-card-desc">{tool.description}</div>
            </div>
            {tool.status === 'coming-soon' && (
              <span className="admin-card-badge">Coming soon</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
