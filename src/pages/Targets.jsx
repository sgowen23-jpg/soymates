import { useState } from 'react'
import './Targets.css'

const CYCLE = 4

const REPS = [
  'Ashleigh Tasdarian',
  'David Kerr',
  'Dipen Surani',
  'Sam Gowen',
  'Shane Vandewardt',
]

const REP_COLORS = {
  'Ashleigh Tasdarian': '#1a2b5e',
  'David Kerr':         '#e67e22',
  'Dipen Surani':       '#8e44ad',
  'Sam Gowen':          '#16a085',
  'Shane Vandewardt':   '#CC0000',
}

const CATEGORIES = ['UHT Core', 'UHT Non Core', 'Chilled', 'Yoghurt']

const DATA = {
  'UHT Core': {
    'Shane Vandewardt':   { stores: 172, current: 1269, gap: 107, baseline: 1203 },
    'Sam Gowen':          { stores: 130, current: 983,  gap: 57,  baseline: 897  },
    'Ashleigh Tasdarian': { stores: 166, current: 1129, gap: 199, baseline: 1055 },
    'David Kerr':         { stores: 175, current: 1276, gap: 124, baseline: 1225 },
    'Dipen Surani':       { stores: 134, current: 1029, gap: 43,  baseline: 978  },
  },
  'UHT Non Core': {
    'Shane Vandewardt':   { stores: 172, current: 636, gap: 224, baseline: 595 },
    'Sam Gowen':          { stores: 130, current: 522, gap: 128, baseline: 468 },
    'Ashleigh Tasdarian': { stores: 166, current: 489, gap: 341, baseline: 430 },
    'David Kerr':         { stores: 175, current: 671, gap: 204, baseline: 623 },
    'Dipen Surani':       { stores: 134, current: 538, gap: 132, baseline: 491 },
  },
  'Chilled': {
    'Shane Vandewardt':   { stores: 172, current: 1354, gap: 1054, baseline: 1341 },
    'Sam Gowen':          { stores: 130, current: 1195, gap: 625,  baseline: 1072 },
    'Ashleigh Tasdarian': { stores: 166, current: 973,  gap: 1351, baseline: 842  },
    'David Kerr':         { stores: 175, current: 1223, gap: 1227, baseline: 1120 },
    'Dipen Surani':       { stores: 134, current: 1022, gap: 854,  baseline: 937  },
  },
  'Yoghurt': {
    'Shane Vandewardt':   { stores: 172, current: 287, gap: 1089, baseline: 280 },
    'Sam Gowen':          { stores: 130, current: 392, gap: 648,  baseline: 393 },
    'Ashleigh Tasdarian': { stores: 166, current: 218, gap: 1110, baseline: 212 },
    'David Kerr':         { stores: 175, current: 227, gap: 1173, baseline: 255 },
    'Dipen Surani':       { stores: 134, current: 74,  gap: 998,  baseline: 95  },
  },
}

function pct(current, gap) {
  const total = current + gap
  return total === 0 ? 0 : Math.round((current / total) * 100)
}

function getColor(p) {
  if (p >= 85) return '#16a085'
  if (p >= 65) return '#e67e22'
  return '#CC0000'
}

function CategorySummaryCard({ category, onClick, active }) {
  const totals = REPS.reduce((acc, rep) => {
    const d = DATA[category][rep]
    acc.current += d.current
    acc.gap += d.gap
    return acc
  }, { current: 0, gap: 0 })
  const p = pct(totals.current, totals.gap)
  return (
    <div className={`tgt-cat-card${active ? ' active' : ''}`} onClick={onClick}>
      <div className="tgt-cat-name">{category}</div>
      <div className="tgt-cat-pct" style={{ color: getColor(p) }}>{p}%</div>
      <div className="tgt-bar-wrap">
        <div className="tgt-bar-fill" style={{ width: p + '%', background: getColor(p) }} />
      </div>
      <div className="tgt-cat-sub">{totals.current.toLocaleString()} / {(totals.current + totals.gap).toLocaleString()} pts</div>
    </div>
  )
}

export default function Targets() {
  const [activeTab, setActiveTab] = useState('All')

  const tabs = ['All', ...CATEGORIES]

  // Which categories to show in the rep table
  const visibleCats = activeTab === 'All' ? CATEGORIES : [activeTab]

  return (
    <div className="tgt-page">

      {/* Header */}
      <div className="tgt-header">
        <div>
          <h1 className="tgt-title">Distribution Targets</h1>
          <p className="tgt-sub">Cycle {CYCLE} — Year-to-Date Progress</p>
        </div>
      </div>

      {/* Category summary cards */}
      <div className="tgt-cat-grid">
        {CATEGORIES.map(cat => (
          <CategorySummaryCard
            key={cat}
            category={cat}
            active={activeTab === cat}
            onClick={() => setActiveTab(activeTab === cat ? 'All' : cat)}
          />
        ))}
      </div>

      {/* Tab bar */}
      <div className="tgt-tabs">
        {tabs.map(t => (
          <button
            key={t}
            className={`tgt-tab${activeTab === t ? ' active' : ''}`}
            onClick={() => setActiveTab(t)}
          >{t}</button>
        ))}
      </div>

      {/* Rep progress table */}
      <div className="tgt-card">
        <div className="tgt-table-wrap">
          <table className="tgt-table">
            <thead>
              <tr>
                <th className="tgt-th-rep">Rep</th>
                <th>Stores</th>
                {visibleCats.map(cat => (
                  <th key={cat}>{cat}</th>
                ))}
                {activeTab === 'All' && <th>Overall</th>}
              </tr>
            </thead>
            <tbody>
              {REPS.map(rep => {
                const overallCurrent = CATEGORIES.reduce((s, c) => s + DATA[c][rep].current, 0)
                const overallGap    = CATEGORIES.reduce((s, c) => s + DATA[c][rep].gap, 0)
                const overallPct    = pct(overallCurrent, overallGap)
                const stores        = DATA['UHT Core'][rep].stores

                return (
                  <tr key={rep}>
                    <td className="tgt-td-rep">
                      <span className="tgt-rep-dot" style={{ background: REP_COLORS[rep] }} />
                      {rep}
                    </td>
                    <td className="tgt-td-num">{stores}</td>
                    {visibleCats.map(cat => {
                      const d = DATA[cat][rep]
                      const p = pct(d.current, d.gap)
                      return (
                        <td key={cat} className="tgt-td-pct">
                          <div className="tgt-cell-pct" style={{ color: getColor(p) }}>{p}%</div>
                          <div className="tgt-mini-bar-wrap">
                            <div className="tgt-mini-bar-fill" style={{ width: p + '%', background: getColor(p) }} />
                          </div>
                          <div className="tgt-cell-detail">{d.current} / {d.current + d.gap} <span className="tgt-gap">↑{d.gap}</span></div>
                        </td>
                      )
                    })}
                    {activeTab === 'All' && (
                      <td className="tgt-td-pct">
                        <div className="tgt-cell-pct" style={{ color: getColor(overallPct) }}>{overallPct}%</div>
                        <div className="tgt-mini-bar-wrap">
                          <div className="tgt-mini-bar-fill" style={{ width: overallPct + '%', background: getColor(overallPct) }} />
                        </div>
                        <div className="tgt-cell-detail">{overallCurrent.toLocaleString()} / {(overallCurrent + overallGap).toLocaleString()}</div>
                      </td>
                    )}
                  </tr>
                )
              })}

              {/* Team total row */}
              <tr className="tgt-total-row">
                <td className="tgt-td-rep"><strong>Team Total</strong></td>
                <td className="tgt-td-num">{REPS.reduce((s, r) => s + DATA['UHT Core'][r].stores, 0)}</td>
                {visibleCats.map(cat => {
                  const totCurrent = REPS.reduce((s, r) => s + DATA[cat][r].current, 0)
                  const totGap     = REPS.reduce((s, r) => s + DATA[cat][r].gap, 0)
                  const p          = pct(totCurrent, totGap)
                  return (
                    <td key={cat} className="tgt-td-pct">
                      <div className="tgt-cell-pct" style={{ color: getColor(p) }}><strong>{p}%</strong></div>
                      <div className="tgt-mini-bar-wrap">
                        <div className="tgt-mini-bar-fill" style={{ width: p + '%', background: getColor(p) }} />
                      </div>
                      <div className="tgt-cell-detail">{totCurrent.toLocaleString()} / {(totCurrent + totGap).toLocaleString()} <span className="tgt-gap">↑{totGap.toLocaleString()}</span></div>
                    </td>
                  )
                })}
                {activeTab === 'All' && (() => {
                  const totC = REPS.reduce((s, r) => s + CATEGORIES.reduce((sc, c) => sc + DATA[c][r].current, 0), 0)
                  const totG = REPS.reduce((s, r) => s + CATEGORIES.reduce((sc, c) => sc + DATA[c][r].gap, 0), 0)
                  const p    = pct(totC, totG)
                  return (
                    <td className="tgt-td-pct">
                      <div className="tgt-cell-pct" style={{ color: getColor(p) }}><strong>{p}%</strong></div>
                      <div className="tgt-mini-bar-wrap">
                        <div className="tgt-mini-bar-fill" style={{ width: p + '%', background: getColor(p) }} />
                      </div>
                      <div className="tgt-cell-detail">{totC.toLocaleString()} / {(totC + totG).toLocaleString()}</div>
                    </td>
                  )
                })()}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="tgt-legend">
        <span className="tgt-legend-item"><span className="tgt-legend-dot" style={{background:'#16a085'}}/>≥85% On track</span>
        <span className="tgt-legend-item"><span className="tgt-legend-dot" style={{background:'#e67e22'}}/>65–84% In progress</span>
        <span className="tgt-legend-item"><span className="tgt-legend-dot" style={{background:'#CC0000'}}/>{'<'}65% Needs attention</span>
        <span className="tgt-legend-note">pts = distribution points (stores × SKUs) · ↑ = gap to full distribution</span>
      </div>

    </div>
  )
}
