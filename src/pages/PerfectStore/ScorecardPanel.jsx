import { useMemo } from 'react'
import './PerfectStore.css'

const PENDING = <span className="psc-pending">— <span className="psc-pending-label">Pending movement tracking</span></span>
const PENDING_VISITS = <span className="psc-pending">— <span className="psc-pending-label">Pending visit-history join</span></span>
const PENDING_SOS = <span className="psc-pending">— <span className="psc-pending-label">SOS data manual/incomplete</span></span>
const PENDING_POG = <span className="psc-pending">— <span className="psc-pending-label">Not in data</span></span>

function Section({ title }) {
  return (
    <tr className="psc-section-header">
      <td colSpan={2}>{title}</td>
    </tr>
  )
}

function Row({ label, value, sub }) {
  return (
    <tr className="psc-row">
      <td className="psc-label">
        {label}
        {sub && <span className="psc-sub"> {sub}</span>}
      </td>
      <td className="psc-value">{value}</td>
    </tr>
  )
}

export default function ScorecardPanel({ rows, cycleLabel }) {
  const stats = useMemo(() => {
    if (!rows.length) return null

    const total = rows.length
    const uhtCore    = rows.filter(r => r.uht_core_gaps    === 0).length
    const uhtNonCore = rows.filter(r => r.uht_noncore_gaps === 0).length
    const chilled    = rows.filter(r => r.chilled_opp      === 0).length
    const rtd        = rows.filter(r => r.rtd_opp          === 0).length
    const yoghurt    = rows.filter(r => r.yoghurt_opp      === 0).length

    const withDist = rows.filter(r => r.distribution_pct != null)
    const avgDist  = withDist.length
      ? withDist.reduce((s, r) => s + r.distribution_pct, 0) / withDist.length
      : null

    const perfectStores = rows.filter(r =>
      r.classification?.toUpperCase().trim() === 'PERFECT STORE'
    ).length

    return { total, uhtCore, uhtNonCore, chilled, rtd, yoghurt, avgDist, perfectStores }
  }, [rows])

  if (!rows.length) {
    return <div className="ps-loading">Loading scorecard…</div>
  }

  const pct = v => v == null ? '—' : `${(v * 100).toFixed(1)}%`

  return (
    <div className="psc-panel">
      <p className="psc-cycle-label">{cycleLabel}</p>
      <table className="psc-table">
        <thead>
          <tr>
            <th className="psc-th-metric">Metric</th>
            <th className="psc-th-value">Current cycle</th>
          </tr>
        </thead>
        <tbody>
          <Section title="Store counts" />
          <Row label="No of stores (total)" value={stats.total} />
          <Row
            label="No of Perfect Stores"
            value={stats.perfectStores}
            sub="per current classification (definition under review)"
          />
          <Row label="No of stores called" value={PENDING_VISITS} />

          <Section title="Ranging" />
          <Row label="Stores ranging UHT Core"     value={stats.uhtCore} />
          <Row label="  ↳ cycle-over-cycle change" value={PENDING} />
          <Row label="Stores ranging UHT Non-Core" value={stats.uhtNonCore} />
          <Row label="  ↳ cycle-over-cycle change" value={PENDING} />
          <Row label="Stores ranging Chilled"      value={stats.chilled} />
          <Row label="  ↳ cycle-over-cycle change" value={PENDING} />
          <Row label="Stores ranging RTD"          value={stats.rtd} />
          <Row label="  ↳ cycle-over-cycle change" value={PENDING} />
          <Row label="Stores ranging Yoghurt"      value={stats.yoghurt} />
          <Row label="  ↳ cycle-over-cycle change" value={PENDING} />

          <Section title="Distribution" />
          <Row label="Overall distribution % (avg)" value={pct(stats.avgDist)} />
          <Row label="  ↳ cycle-over-cycle change"  value={PENDING} />

          <Section title="In-store execution" />
          <Row label="SOS > 30% (count)"  value={PENDING_SOS} />
          <Row label="Planograms compliant" value={PENDING_POG} />
        </tbody>
      </table>
    </div>
  )
}
