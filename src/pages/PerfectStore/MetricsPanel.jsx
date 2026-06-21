import './PerfectStore.css'

const CLASS_COLORS = {
  'PERFECT STORE': '#2e7d32',
  'GROW':          '#0e7490',
  'DEVELOP':       '#e67e22',
  'EXPAND':        '#546e7a',
}

// Display order matches Azra's sheet
const ORDER = ['EXPAND', 'DEVELOP', 'GROW', 'PERFECT STORE']

function fmtThreshold(rule) {
  if (!rule) return '—'
  const t = rule.upgrade_threshold ?? rule.distribution_threshold ?? rule.min_distribution ?? null
  if (t == null) return '—'
  return `>${(t * 100).toFixed(0)}%`
}

function fmtCallFreq(rule) {
  if (!rule) return '—'
  const f = rule.call_freq
  if (f == null) return '—'
  const notes = {
    'EXPAND':        'calls',
    'DEVELOP':       'calls (fortnightly)',
    'GROW':          'calls (monthly)',
    'PERFECT STORE': 'calls (monthly)',
  }
  const suffix = notes[rule.classification?.toUpperCase().trim()] ?? 'calls'
  return `${f} ${suffix}`
}

function fmtFocus(rule) {
  if (!rule) return '—'
  return rule.strategic_focus ?? rule.focus ?? rule.target ?? rule.notes ?? '—'
}

export default function MetricsPanel({ rules }) {
  const loading = Object.keys(rules).length === 0

  if (loading) {
    return <div className="ps-loading">Loading classification rules…</div>
  }

  return (
    <div className="psm-panel">
      <p className="psm-intro">
        Classification rules are read live from <code>ps_classification_rules</code>.
        Update the table to change what appears here.
      </p>
      <div className="psm-grid">
        {ORDER.map(cls => {
          const rule = rules[cls] ?? rules[Object.keys(rules).find(k => k.toUpperCase().trim() === cls)]
          const color = CLASS_COLORS[cls] ?? '#888'
          return (
            <div className="psm-card" key={cls} style={{ borderTop: `4px solid ${color}` }}>
              <span
                className="psm-badge"
                style={{ background: color + '20', color }}
              >
                {cls}
              </span>
              <dl className="psm-dl">
                <div className="psm-row">
                  <dt>Call frequency</dt>
                  <dd>{fmtCallFreq(rule)}</dd>
                </div>
                <div className="psm-row">
                  <dt>Min. distribution</dt>
                  <dd>{fmtThreshold(rule)}</dd>
                </div>
                <div className="psm-row psm-row--focus">
                  <dt>Strategic focus</dt>
                  <dd>{fmtFocus(rule)}</dd>
                </div>
              </dl>
            </div>
          )
        })}
      </div>
    </div>
  )
}
