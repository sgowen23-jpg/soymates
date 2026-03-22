import { useState } from 'react'
import { CYCLE_NUMBER as CYCLE, CATEGORIES, TARGET_REPS as REPS, DATA, getCategorySummary } from '../data/targets'
import './Targets.css'

const REP_COLORS = {
  'Ashleigh Tasdarian': '#1a2b5e',
  'David Kerr':         '#e67e22',
  'Dipen Surani':       '#8e44ad',
  'Sam Gowen':          '#16a085',
  'Shane Vandewardt':   '#CC0000',
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
  const totals = getCategorySummary(category)
  const p = totals.pct
  return (
    <div className={`tgt-cat-card${active ? ' active' : ''}`} onClick={onClick}>
      <div className="tgt-cat-name">{category}</div>
      <div className="tgt-cat-pct" style={{ color: getColor(p) }}>{p}%</div>
      <div className="tgt-bar-wrap">
        <div className="tgt-bar-fill" style={{ width: p + '%', background: getColor(p) }} />
      </div>
      <div className="tgt-cat-sub">{totals.current.toLocaleString()} / {totals.total.toLocaleString()} pts</div>
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
