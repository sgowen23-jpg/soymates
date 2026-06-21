import { useMemo } from 'react'
import './PerfectStore.css'

const MONTHS = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR']

const TOPUP_TARGETS = [300, 1300, 1300, 350, 1350, 1350, 300, 1350, 1350, 350, 1350, 1350]

const REPS = ['Sam Gowen', 'Dipen Surani', 'Shane Vandewardt', 'David Kerr', 'NSW']

const PENDING_MOVEMENT = (
  <span className="psc-pending">— <span className="psc-pending-label">Pending movement tracking</span></span>
)
const PENDING_SYSTEM = (
  <span className="psc-pending">— <span className="psc-pending-label">Not tracked in system</span></span>
)
const PENDING_GRID = (
  <span className="psc-pending">—</span>
)

// ── 2-column summary table helpers ──────────────────────────────────────────

function SummarySection({ title }) {
  return (
    <tr className="psc-section-header">
      <td colSpan={2}>{title}</td>
    </tr>
  )
}

function SummaryRow({ label, value, sub }) {
  return (
    <tr className="psc-row">
      <td className="psc-label">
        {label}
        {sub && <span className="psc-sub">{sub}</span>}
      </td>
      <td className="psc-value">{value}</td>
    </tr>
  )
}

// ── 13-column grid table ─────────────────────────────────────────────────────

function GridTable({ title, rows }) {
  return (
    <div className="ta-section">
      <div className="ta-section-title">{title}</div>
      <div className="ta-grid-wrap">
        <table className="ta-grid">
          <thead>
            <tr>
              <th className="ta-grid-th-label"></th>
              {MONTHS.map(m => <th key={m} className="ta-grid-th-month">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={row.isTarget ? 'ta-grid-row-target' : 'ta-grid-row'}>
                <td className="ta-grid-label">{row.label}</td>
                {MONTHS.map((m, j) => (
                  <td key={m} className="ta-grid-cell">
                    {row.values[j] ?? PENDING_GRID}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function TeamActivityPanel({ visitCounts, visitsLoading, visitsError, rows, cycleLabel }) {
  if (visitsError) {
    return <div className="ps-error">Failed to load visit data: {visitsError}</div>
  }

  if (visitsLoading) {
    return <div className="ps-loading">Loading visit data…</div>
  }

  const totalVisits = Object.values(visitCounts).reduce((s, c) => s + c, 0)

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

  return (
    <div className="psc-panel ta-panel">
      <p className="psc-cycle-label">{cycleLabel} — successful visits only</p>

      {/* ── Section 1: Activity Summary ── */}
      <div className="ta-section">
        <div className="ta-section-title">Activity summary</div>
        <table className="psc-table">
          <thead>
            <tr>
              <th className="psc-th-metric">Metric</th>
              <th className="psc-th-value">Current cycle</th>
            </tr>
          </thead>
          <tbody>
            <SummarySection title="Store visits" />
            <SummaryRow label="Total store visits" value={totalVisits} />

            <SummarySection title="Ranging activity" />
            <SummaryRow label="UHT Core gaps closed"     value={PENDING_MOVEMENT} />
            <SummaryRow label="UHT Non-Core gaps closed" value={PENDING_MOVEMENT} />
            <SummaryRow label="Chilled gaps closed"      value={PENDING_MOVEMENT} />
            <SummaryRow label="Yoghurt gaps closed"      value={PENDING_MOVEMENT} />

            <SummarySection title="In-store execution" />
            <SummaryRow label="Total POGs"                     value={PENDING_SYSTEM} />
            <SummaryRow label="Additional facings"             value={PENDING_SYSTEM} />
            <SummaryRow label="Top-up stores"                  value={PENDING_SYSTEM} />
            <SummaryRow label="Top-up volume"                  value={PENDING_SYSTEM} />
            <SummaryRow label="Orders placed"                  value={PENDING_SYSTEM} />
            <SummaryRow label="Stores activity achieved"       value={PENDING_SYSTEM} />
            <SummaryRow label="Strike rate"                    value={PENDING_SYSTEM} />
          </tbody>
        </table>
      </div>

      {/* ── Section 2: Stores by Classification ── */}
      <div className="ta-section">
        <div className="ta-section-title">Stores by classification</div>
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
                <SummaryRow label="Total stores"   value={classCounts.total} />
                <SummaryRow label="Perfect Store"  value={classCounts.perfectStore} />
                <SummaryRow label="Grow"           value={classCounts.grow} />
                <SummaryRow label="Develop"        value={classCounts.develop} />
                <SummaryRow label="Expand"         value={classCounts.expand} />
                <SummaryRow label="Drakes"         value={classCounts.drakes} />
              </>
            ) : (
              <SummaryRow label="Store data" value={<span className="psc-pending">— <span className="psc-pending-label">Loading…</span></span>} />
            )}
          </tbody>
        </table>
      </div>

      {/* ── Section 3: Planograms ── */}
      <GridTable
        title="Planograms forecast vs actual"
        rows={[
          {
            label: 'Target / No of planograms',
            isTarget: true,
            values: MONTHS.map(() => 20),
          },
          {
            label: 'Planograms completed',
            isTarget: false,
            values: MONTHS.map(() => null),
          },
        ]}
      />

      {/* ── Section 4: Top-up Volume ── */}
      <GridTable
        title="Top-up volume forecast vs actual"
        rows={[
          {
            label: 'Target volume / cartons',
            isTarget: true,
            values: TOPUP_TARGETS,
          },
          {
            label: 'Actual volume',
            isTarget: false,
            values: MONTHS.map(() => null),
          },
          {
            label: 'Off locations / no of',
            isTarget: false,
            values: MONTHS.map(() => null),
          },
        ]}
      />

      {/* ── Section 5: EDI Orders by Rep ── */}
      <GridTable
        title="EDI orders by rep"
        rows={REPS.map(rep => ({
          label: rep,
          isTarget: false,
          values: MONTHS.map(() => null),
        }))}
      />

      {/* ── Section 6: EDI Order GSV Value by Rep ── */}
      <GridTable
        title="EDI order GSV value by rep"
        rows={REPS.map(rep => ({
          label: rep,
          isTarget: false,
          values: MONTHS.map(() => null),
        }))}
      />
    </div>
  )
}
