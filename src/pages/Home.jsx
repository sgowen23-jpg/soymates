import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CYCLE_NUMBER, CATEGORIES, getCategorySummary, getOverallSummary } from '../data/targets'
import './Home.css'

// Cycle 1 starts March 30, 2026
const CYCLE_START = new Date('2026-03-30')
const CYCLE_WEEKS = 12

const REPS = [
  'Azra Horell',
  'Ashleigh Tasdarian',
  'David Kerr',
  'Dipen Surani',
  'Sam Gowen',
  'Shane Vandewardt',
]

const PIE_DATA = [
  {
    label: 'Vitasoy UHT',
    segments: [
      { label: 'Listed', value: 68, color: '#1a2b5e' },
      { label: 'Gap',    value: 22, color: '#CC0000' },
      { label: 'NBT',    value: 10, color: '#fb8c00' },
    ],
  },
  {
    label: 'Vitasoy Chilled',
    segments: [
      { label: 'Listed', value: 55, color: '#1a2b5e' },
      { label: 'Gap',    value: 30, color: '#CC0000' },
      { label: 'NBT',    value: 15, color: '#fb8c00' },
    ],
  },
  {
    label: 'Califia',
    segments: [
      { label: 'Listed', value: 40, color: '#1a2b5e' },
      { label: 'Gap',    value: 35, color: '#CC0000' },
      { label: 'NBT',    value: 25, color: '#fb8c00' },
    ],
  },
]


function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getCycleInfo() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(CYCLE_START)
  start.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { week: 0, label: 'Pre-Cycle', daysLeft: Math.abs(diffDays) }
  const week = Math.min(Math.floor(diffDays / 7) + 1, CYCLE_WEEKS)
  return { week, label: `Week ${week}`, daysLeft: null }
}

function formatDate(d) {
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtShort(str) {
  const [y, m, day] = str.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function PieChart({ segments, size = 80 }) {
  const r = size / 2 - 4
  const cx = size / 2
  const cy = size / 2
  const total = segments.reduce((a, s) => a + s.value, 0)
  let startAngle = -Math.PI / 2
  const paths = segments.map(seg => {
    const angle = (seg.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(startAngle + angle)
    const y2 = cy + r * Math.sin(startAngle + angle)
    const large = angle > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    startAngle += angle
    return { d, color: seg.color }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth="1.5" />
      ))}
    </svg>
  )
}

export default function Home({ onNavigate }) {
  const [leaveEntries, setLeaveEntries] = useState([])
  const today     = new Date()
  const todayStr  = toDateStr(today)
  const { week, label, daysLeft } = getCycleInfo()

  useEffect(() => {
    async function fetchLeave() {
      const { data } = await supabase
        .from('leave_entries')
        .select('rep_name, start_date, end_date, leave_type')
        .lte('start_date', todayStr)
        .gte('end_date',   todayStr)
      setLeaveEntries(data || [])
    }
    fetchLeave()
  }, [])

  // Build per-rep leave status for today
  function getRepLeave(rep) {
    return leaveEntries.filter(e => e.rep_name === rep)
  }

  function isOnLeave(rep) {
    return getRepLeave(rep).length > 0
  }

  function leaveTooltip(rep) {
    const entries = getRepLeave(rep)
    if (!entries.length) return 'Available'
    return entries.map(e =>
      `${e.leave_type}: ${fmtShort(e.start_date)}${e.start_date !== e.end_date ? ' → ' + fmtShort(e.end_date) : ''}`
    ).join('\n')
  }

  return (
    <div className="home-page">
      {/* Header */}
      <div className="home-header">
        <div className="home-date">{formatDate(today)}</div>
        <div className="home-cycle-badge">
          {daysLeft != null
            ? `Cycle starts in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
            : `Cycle 1 — ${label}`}
        </div>
      </div>

      {/* Team Availability */}
      <section className="home-section">
        <h2 className="home-section-title">
          Team Availability
          <span className="home-section-hint"> — click a rep to view leave calendar</span>
        </h2>
        <div className="rep-cards">
          {REPS.map(rep => {
            const onLeave = isOnLeave(rep)
            const tip = leaveTooltip(rep)
            const initials = rep.split(' ').map(n => n[0]).join('')
            return (
              <button
                key={rep}
                className={`rep-card ${onLeave ? 'unavailable' : 'available'}`}
                onClick={() => onNavigate('Leave Calendar')}
              >
                <div className="rep-tooltip">{tip}</div>
                <span className="rep-status-dot" />
                <span className="rep-initials">{initials}</span>
                <span className="rep-name">{rep.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Cycle Progress */}
      <section className="home-section">
        <h2 className="home-section-title">Cycle Progress — Cycle {CYCLE_NUMBER}</h2>
        <div className="cycle-progress-wrap">
          <div className="cycle-weeks">
            {Array.from({ length: CYCLE_WEEKS }, (_, i) => i + 1).map(w => (
              <div key={w} className={`cycle-week ${w < week ? 'done' : w === week ? 'current' : ''}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="cycle-bar-wrap">
            <div className="cycle-bar-fill" style={{ width: `${Math.max(0, (week - 1) / CYCLE_WEEKS * 100)}%` }} />
          </div>
          <div className="cycle-bar-label">
            {week === 0 ? 'Not started' : week > CYCLE_WEEKS ? 'Cycle complete' : `${week} of ${CYCLE_WEEKS} weeks`}
          </div>
        </div>
      </section>

      {/* Distribution Charts */}
      <section className="home-section">
        <h2 className="home-section-title">
          Distribution Summary
          <span className="home-section-hint"> — click to view details</span>
        </h2>
        <div className="pie-row">
          {PIE_DATA.map(chart => (
            <button key={chart.label} className="pie-card" onClick={() => onNavigate('Distribution')} title="View Distribution">
              <PieChart segments={chart.segments} size={90} />
              <div className="pie-label">{chart.label}</div>
              <div className="pie-legend">
                {chart.segments.map(s => (
                  <div key={s.label} className="pie-legend-item">
                    <span className="pie-legend-dot" style={{ background: s.color }} />
                    <span>{s.label} {s.value}%</span>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Targets */}
      <section className="home-section">
        <h2 className="home-section-title">
          Distribution Targets — Cycle {CYCLE_NUMBER}
          <span className="home-section-hint"> — click to view details</span>
        </h2>
        <div className="pie-row">
          {CATEGORIES.map(cat => {
            const s   = getCategorySummary(cat)
            const col = s.pct >= 85 ? '#16a085' : s.pct >= 65 ? '#e67e22' : '#CC0000'
            return (
              <button key={cat} className="pie-card" onClick={() => onNavigate('Targets')} title="View Targets">
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <PieChart
                    segments={[
                      { value: s.pct,       color: col      },
                      { value: 100 - s.pct, color: '#eee'   },
                    ]}
                    size={90}
                  />
                  <div className="pie-center-label">{s.pct}%</div>
                </div>
                <div className="pie-label">{cat}</div>
                <div className="pie-legend">
                  <div className="pie-legend-item">
                    <span className="pie-legend-dot" style={{ background: col }} />
                    <span>Achieved {s.current.toLocaleString()}</span>
                  </div>
                  <div className="pie-legend-item">
                    <span className="pie-legend-dot" style={{ background: '#eee', border: '1px solid #ddd' }} />
                    <span>Gap {s.gap.toLocaleString()}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
