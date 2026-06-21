import './PerfectStore.css'

const PENDING_MOVEMENT = <span className="psc-pending">— <span className="psc-pending-label">Pending movement tracking</span></span>
const PENDING_SYSTEM   = <span className="psc-pending">— <span className="psc-pending-label">Not tracked in system</span></span>

function Section({ title }) {
  return (
    <tr className="psc-section-header">
      <td colSpan={2}>{title}</td>
    </tr>
  )
}

function Row({ label, value }) {
  return (
    <tr className="psc-row">
      <td className="psc-label">{label}</td>
      <td className="psc-value">{value}</td>
    </tr>
  )
}

export default function TeamActivityPanel({ visitCounts, visitsLoading, visitsError, cycleLabel }) {
  if (visitsError) {
    return <div className="ps-error">Failed to load visit data: {visitsError}</div>
  }

  if (visitsLoading) {
    return <div className="ps-loading">Loading visit data…</div>
  }

  const totalVisits = Object.values(visitCounts).reduce((s, c) => s + c, 0)

  return (
    <div className="psc-panel">
      <p className="psc-cycle-label">{cycleLabel} — successful visits only</p>
      <table className="psc-table">
        <thead>
          <tr>
            <th className="psc-th-metric">Activity metric</th>
            <th className="psc-th-value">Current cycle</th>
          </tr>
        </thead>
        <tbody>
          <Section title="Store visits" />
          <Row label="Total store visits" value={totalVisits} />

          <Section title="Ranging activity" />
          <Row label="Total UHT Core gaps closed"     value={PENDING_MOVEMENT} />
          <Row label="Total UHT Non-Core gaps closed" value={PENDING_MOVEMENT} />
          <Row label="Total Chilled gaps closed"      value={PENDING_MOVEMENT} />
          <Row label="Total Yoghurt gaps closed"      value={PENDING_MOVEMENT} />

          <Section title="In-store execution" />
          <Row label="Total POGs"                       value={PENDING_SYSTEM} />
          <Row label="Total additional facings"         value={PENDING_SYSTEM} />
          <Row label="Total top-up stores"              value={PENDING_SYSTEM} />
          <Row label="Total top-up volume"              value={PENDING_SYSTEM} />
          <Row label="Total orders placed"              value={PENDING_SYSTEM} />
          <Row label="Total stores activity achieved"   value={PENDING_SYSTEM} />
        </tbody>
      </table>
    </div>
  )
}
