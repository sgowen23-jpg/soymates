import { useMemo } from 'react'
import { CYCLE_STARTS, CURRENT_CYCLE } from '../../constants'
import './PerfectStore.css'

// ── Constants ────────────────────────────────────────────────────────────────

const MONTHS_12 = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const TOPUP_TARGETS = [300, 1300, 1300, 350, 1350, 1350, 300, 1350, 1350, 350, 1350, 1350]

const REPS = ['Sam Gowen', 'Dipen Surani', 'Shane Vandewardt', 'David Kerr', 'NSW']

// Derive the 3 activity-month JS month numbers from the cycle start date.
// If cycle starts after the 15th, skip that partial month and start from the next.
function getCycleMonths() {
  const start = new Date(CYCLE_STARTS[CURRENT_CYCLE] + 'T00:00:00')
  const startMonth = start.getMonth() // 0-11
  const firstMonth = start.getDate() > 15 ? (startMonth + 1) % 12 : startMonth
  return [firstMonth, (firstMonth + 1) % 12, (firstMonth + 2) % 12]
}

const CYCLE_MONTH_NUMS = getCycleMonths() // e.g. [3, 4, 5] for Apr/May/Jun

// ── Placeholder cells ────────────────────────────────────────────────────────

const P_MOVEMENT = <span className="psc-pending">—<span className="psc-pending-label"> Pending movement tracking</span></span>
const P_SYSTEM   = <span className="psc-pending">—<span className="psc-pending-label"> Not tracked in system</span></span>
const P_GRID     = <span className="psc-pending ta-grid-dash">—</span>

// ── Shared table primitives ──────────────────────────────────────────────────

function SummarySection({ title, cols }) {
  return (
    <tr className="psc-section-header">
      <td colSpan={cols ?? 2}>{title}</td>
    </tr>
  )
}

function SummaryRow({ label, values, sub }) {
  // values: array of cells (one per column after label), or single value for 2-col
  const cells = Array.isArray(values) ? values : [values]
  return (
    <tr className="psc-row">
      <td className="psc-label">
        {label}
        {sub && <span className="psc-sub">{sub}</span>}
      </td>
      {cells.map((v, i) => (
        <td key={i} className="psc-value">{v}</td>
      ))}
    </tr>
  )
}

// ── 12-month grid table ──────────────────────────────────────────────────────

function GridTable({ rows }) {
  return (
    <div className="ta-grid-wrap">
      <table className="ta-grid">
        <thead>
          <tr>
            <th className="ta-grid-th-label"></th>
            {MONTHS_12.map(m => <th key={m} className="ta-grid-th-month">{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={row.isTarget ? 'ta-grid-row-target' : 'ta-grid-row'}>
              <td className="ta-grid-label">{row.label}</td>
              {MONTHS_12.map((_, j) => (
                <td key={j} className="ta-grid-cell">
                  {row.values[j] != null ? row.values[j] : P_GRID}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Inline SVG bar chart ─────────────────────────────────────────────────────
// data: array of 12 { label, target, actual } — actual=null means untracked

function BarChart({ data, caption }) {
  const PAD_L = 42, PAD_R = 12, PAD_T = 12, PAD_B = 32
  const W = 680, H = 160
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const maxTarget = Math.max(...data.map(d => d.target ?? 0))
  const maxVal = Math.max(maxTarget, 1)

  // Round maxY up to a nice number
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)))
  const maxY = Math.ceil(maxVal / magnitude) * magnitude

  const groupW = innerW / data.length
  const barW = Math.max(4, groupW * 0.28)
  const gap = Math.max(2, groupW * 0.06)

  const yScale = v => innerH - (v / maxY) * innerH

  // Y gridlines at 0, 25%, 50%, 75%, 100%
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD_T + yScale(f * maxY),
    label: Math.round(f * maxY).toLocaleString(),
  }))

  return (
    <div className="ta-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="ta-chart-svg" aria-hidden="true">
        {/* gridlines */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y}
              stroke="#e8e8e8" strokeWidth="1"
            />
            <text
              x={PAD_L - 5} y={g.y + 4}
              textAnchor="end" fontSize="9" fill="#bbb"
            >{g.label}</text>
          </g>
        ))}

        {/* bars */}
        {data.map((d, i) => {
          const cx = PAD_L + i * groupW + groupW / 2
          const targetH = Math.max(0, (d.target / maxY) * innerH)
          const actualH = d.actual != null ? Math.max(0, (d.actual / maxY) * innerH) : 0

          const tx = cx - gap / 2 - barW
          const ax = cx + gap / 2

          return (
            <g key={i}>
              {/* target bar */}
              <rect
                x={tx} y={PAD_T + yScale(d.target ?? 0)}
                width={barW} height={targetH}
                fill="#d0d5db" rx="1"
              />
              {/* actual bar — only render if tracked */}
              {d.actual != null && (
                <rect
                  x={ax} y={PAD_T + yScale(d.actual)}
                  width={barW} height={actualH}
                  fill="#CC0000" rx="1"
                />
              )}
              {/* month label */}
              <text
                x={cx} y={H - PAD_B + 14}
                textAnchor="middle" fontSize="9" fill="#aaa"
              >{d.label}</text>
            </g>
          )
        })}

        {/* legend */}
        <rect x={PAD_L} y={H - PAD_B + 22} width={8} height={8} fill="#d0d5db" rx="1" />
        <text x={PAD_L + 11} y={H - PAD_B + 29} fontSize="9" fill="#aaa">Target</text>
        <rect x={PAD_L + 52} y={H - PAD_B + 22} width={8} height={8} fill="#CC0000" rx="1" />
        <text x={PAD_L + 63} y={H - PAD_B + 29} fontSize="9" fill="#aaa">Actual</text>
      </svg>
      {caption && <p className="ta-chart-caption">{caption}</p>}
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="ta-section">
      <div className="ta-section-title">{title}</div>
      {children}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function TeamActivityPanel({
  visitCounts, visitMonthCounts, visitsLoading, visitsError, rows, cycleLabel,
}) {
  if (visitsError) {
    return <div className="ps-error">Failed to load visit data: {visitsError}</div>
  }
  if (visitsLoading) {
    return <div className="ps-loading">Loading visit data…</div>
  }

  // Derived month labels for Section 1 columns
  const cycleMonthLabels = CYCLE_MONTH_NUMS.map(m => MONTH_NAMES[m])

  // Visits per activity month
  const visitsByCol = CYCLE_MONTH_NUMS.map(m => visitMonthCounts[m] ?? 0)

  // Classification counts from perfect_store_v2 rows
  const classCounts = useMemo(() => {
    if (!rows?.length) return null
    return {
      total:        rows.length,
      perfectStore: rows.filter(r => r.classification?.toUpperCase().trim() === 'PERFECT STORE').length,
      grow:         rows.filter(r => r.classification?.toUpperCase().trim() === 'GROW').length,
      develop:      rows.filter(r => r.classification?.toUpperCase().trim() === 'DEVELOP').length,
      expand:       rows.filter(r => r.classification?.toUpperCase().trim() === 'EXPAND').length,
      drakes:       rows.filter(r => r.banner?.toLowerCase().includes('drakes')).length,
    }
  }, [rows])

  // Planogram chart data (target=20, actual=null)
  const plogData = MONTHS_12.map(m => ({ label: m, target: 20, actual: null }))

  // Top-up volume chart data
  const topupData = MONTHS_12.map((m, i) => ({ label: m, target: TOPUP_TARGETS[i], actual: null }))

  const colCount = 3 // activity summary column count (3 months)

  return (
    <div className="psc-panel ta-panel">
      <p className="psc-cycle-label">{cycleLabel} — successful visits only</p>

      {/* ── Section 1: Activity Summary ── */}
      <Section title="Activity summary">
        <div className="ta-grid-wrap">
          <table className="ta-grid ta-activity-grid">
            <thead>
              <tr>
                <th className="ta-grid-th-label">Metric</th>
                {cycleMonthLabels.map(m => (
                  <th key={m} className="ta-grid-th-month">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="psc-section-header">
                <td colSpan={colCount + 1}>Store visits</td>
              </tr>
              <tr className="psc-row">
                <td className="psc-label">Total store visits</td>
                {visitsByCol.map((v, i) => (
                  <td key={i} className="psc-value">{v}</td>
                ))}
              </tr>

              <tr className="psc-section-header">
                <td colSpan={colCount + 1}>Ranging activity</td>
              </tr>
              {['UHT Core gaps closed', 'UHT Non-Core gaps closed', 'Chilled gaps closed', 'Yoghurt gaps closed'].map(label => (
                <tr key={label} className="psc-row">
                  <td className="psc-label">{label}</td>
                  {Array.from({ length: colCount }).map((_, i) => (
                    <td key={i} className="psc-value">{P_MOVEMENT}</td>
                  ))}
                </tr>
              ))}

              <tr className="psc-section-header">
                <td colSpan={colCount + 1}>In-store execution</td>
              </tr>
              {['Total POGs', 'Additional facings', 'Top-up stores', 'Top-up volume', 'Orders placed', 'Stores activity achieved', 'Strike rate'].map(label => (
                <tr key={label} className="psc-row">
                  <td className="psc-label">{label}</td>
                  {Array.from({ length: colCount }).map((_, i) => (
                    <td key={i} className="psc-value">{P_SYSTEM}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Section 2: Stores by Classification ── */}
      <Section title="Stores by classification">
        <table className="psc-table">
          <thead>
            <tr>
              <th className="psc-th-metric">Classification</th>
              <th className="psc-th-value">Store count</th>
            </tr>
          </thead>
          <tbody>
            {classCounts ? (
              <>
                <SummaryRow label="Total stores"  values={classCounts.total} />
                <SummaryRow label="Perfect Store" values={classCounts.perfectStore} sub="per current classification (definition under review)" />
                <SummaryRow label="Grow"          values={classCounts.grow} />
                <SummaryRow label="Develop"       values={classCounts.develop} />
                <SummaryRow label="Expand"        values={classCounts.expand} />
                <SummaryRow label="Drakes"        values={classCounts.drakes} />
              </>
            ) : (
              <SummaryRow label="Store data" values={<span className="psc-pending">— <span className="psc-pending-label">Loading…</span></span>} />
            )}
          </tbody>
        </table>
      </Section>

      {/* ── Section 3: Planograms ── */}
      <Section title="Planograms forecast vs actual">
        <GridTable
          rows={[
            { label: 'Target / no of planograms', isTarget: true,  values: MONTHS_12.map(() => 20) },
            { label: 'Planograms completed',       isTarget: false, values: MONTHS_12.map(() => null) },
          ]}
        />
        <BarChart
          data={plogData}
          caption="Actuals will populate once planogram tracking is added."
        />
      </Section>

      {/* ── Section 4: Top-up Volume ── */}
      <Section title="Top-up volume forecast vs actual">
        <GridTable
          rows={[
            { label: 'Target volume / cartons', isTarget: true,  values: TOPUP_TARGETS },
            { label: 'Actual volume',           isTarget: false, values: MONTHS_12.map(() => null) },
            { label: 'Off locations / no of',   isTarget: false, values: MONTHS_12.map(() => null) },
          ]}
        />
        <BarChart
          data={topupData}
          caption="Actuals will populate once top-up volume tracking is added."
        />
      </Section>

      {/* ── Section 5: EDI Orders by Rep ── */}
      <Section title="EDI orders by rep">
        <GridTable
          rows={REPS.map(rep => ({
            label: rep, isTarget: false, values: MONTHS_12.map(() => null),
          }))}
        />
      </Section>

      {/* ── Section 6: EDI GSV Value by Rep ── */}
      <Section title="EDI order GSV value by rep">
        <GridTable
          rows={REPS.map(rep => ({
            label: rep, isTarget: false, values: MONTHS_12.map(() => null),
          }))}
        />
      </Section>
    </div>
  )
}
