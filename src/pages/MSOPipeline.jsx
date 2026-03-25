import { useState } from 'react'
import './MSOPipeline.css'

const PIPELINE = [
  // FY2026
  {
    id: 'fresh-save',
    mso: 'Fresh & Save', state: 'QLD', stores: 9, volume: 240,
    value: 6000, stage: 'Closed - Won', status: 'Closed', fy: 2026,
    date: '10 Feb 26', orderDate: '28 Feb 26', vapMonth: 'March',
    owner: 'STP - Azra', opportunity: 'Volume Drive',
    notes: 'Closed majority UHT gaps Aug 2025. Will not range RTD or Yoghurt. Not accepting NPD <12 months.',
    volumeTarget: '200–300 ctns/month', gsvEstimate: '$6k/month / $72k p.a.',
    nextSteps: 'Maintain volume drive. Monitor compliance.',
    products: [
      { name: 'VITASOY ALM MILK U/SW UHT 1L', category: 'UHT', gaps: 0.89, gsv: 31.28 },
      { name: 'VITASOY ALMOND MILKY UHT 1L', category: 'UHT', gaps: 0.89, gsv: 28.08 },
      { name: 'VITASOY OAT MILK U/SW UHT 1L', category: 'UHT', gaps: 1, gsv: 31.28 },
      { name: 'VITASOY SOY MILKY LITE UHT 1L', category: 'UHT', gaps: 1, gsv: 22.93 },
      { name: 'VITASOY HOME BAR UHT ALM 1L', category: 'UHT', gaps: 'Not Ranged', gsv: null },
      { name: 'VITASOY HOME BAR UHT OAT 1L', category: 'UHT', gaps: 'Not Ranged', gsv: null },
      { name: 'VITASOY ORIGINAL UHT 1L', category: 'UHT', gaps: 'Not Ranged', gsv: null },
      { name: 'VITASOY PROTEIN PLUS UHT 1L', category: 'UHT', gaps: 'Not Ranged', gsv: null },
      { name: 'VITASOY FRSH CALCI PLUS 1L', category: 'Chilled', gaps: 1, gsv: 16.13 },
      { name: 'VITASOY SOY MILKY I/COFFEE 1L', category: 'Chilled', gaps: 1, gsv: 16.95 },
    ],
  },
  {
    id: 'seasons',
    mso: 'Seasons', state: 'QLD', stores: 9, volume: 240,
    value: 6000, stage: 'Closed - Won', status: 'Closed', fy: 2026,
    date: '10 Feb 26', orderDate: '1 Mar 26', vapMonth: 'March',
    owner: 'Kaytie @ Seasons', opportunity: 'Volume Drive',
    notes: 'Confirmed 240 ctns across weeks 12 & 14 for off-location.',
    volumeTarget: '240 ctns', gsvEstimate: '~$10k',
    nextSteps: 'Confirm week 12 & 14 delivery dates.',
    products: [
      { name: 'VITASOY CALCI-PLUS UHT 1L', category: 'UHT', gaps: 1, gsv: 28.77 },
      { name: 'VITASOY OAT MILK U/SW UHT 1L', category: 'UHT', gaps: 1, gsv: 31.28 },
      { name: 'VITASOY C/NUT MILK U/SW UHT 1L', category: 'UHT', gaps: 1, gsv: 31.28 },
      { name: 'VITASOY ORIGINAL UHT 1L', category: 'UHT', gaps: 1, gsv: 28.77 },
      { name: 'VITASOY PROTEIN PLUS UHT 1L', category: 'UHT', gaps: 1, gsv: 28.77 },
      { name: 'VITASOY YGT OAT BLUBRY 140GM', category: 'Yoghurt', gaps: 5, gsv: 100.40 },
      { name: 'VITASOY YGT GRK SOY VAN 450GM', category: 'Yoghurt', gaps: 5, gsv: 97.00 },
      { name: 'VITASOY YGT OAT VAN 140GM', category: 'Yoghurt', gaps: 5, gsv: 100.40 },
      { name: 'VITASOY YGT OAT VAN 450GM', category: 'Yoghurt', gaps: 7, gsv: 140.70 },
      { name: 'VITASOY MILKY ESL 1L', category: 'Chilled', gaps: 1, gsv: 13.30 },
    ],
  },
  {
    id: 'chapleys',
    mso: 'Chapleys', state: 'QLD', stores: 6, volume: 200,
    value: 5000, stage: 'Proposed', status: 'Open', fy: 2026,
    date: '1 Feb 26', orderDate: 'March', vapMonth: 'March',
    owner: 'Phil @ Chapleys', opportunity: 'Volume Drive',
    notes: null, volumeTarget: '200 ctns', gsvEstimate: '$5,000',
    nextSteps: 'Follow up with Phil on order confirmation.',
    products: [],
  },
  {
    id: 'spanos',
    mso: 'Spanos', state: 'QLD', stores: 5, volume: 90,
    value: 2250, stage: 'Closed - Won', status: 'Open', fy: 2026,
    date: '24 Feb 26', orderDate: 'Week 12', vapMonth: 'March',
    owner: 'Frank @ Spanos', opportunity: 'Volume Drive',
    notes: null, volumeTarget: '90 ctns', gsvEstimate: '$2,250',
    nextSteps: 'Confirm Week 12 delivery.',
    products: [],
  },
  {
    id: 'perries',
    mso: 'Peries', state: 'QLD', stores: 15, volume: 700,
    value: 17500, stage: 'Proposed', status: 'Open', fy: 2026,
    date: '26 Feb 26', orderDate: 'TBC', vapMonth: 'March',
    owner: 'Buyer & Peries', opportunity: 'Volume Drive',
    notes: 'GSV estimate $134k current. Opportunity to increase by 50%. Wants 4% terms to act as category captain.',
    volumeTarget: '700 ctns', gsvEstimate: '$17,500',
    nextSteps: 'Negotiate terms. Confirm order timeline.',
    products: [
      { name: 'VITASOY RICE MILK UHT 1L', category: 'UHT', gaps: 2, gsv: null },
      { name: 'VITASOY SOY MILKY LITE UHT 1L', category: 'UHT', gaps: 1, gsv: null },
      { name: 'VITASOY C/NUT MILK U/SW UHT 1L', category: 'UHT', gaps: 5, gsv: null },
      { name: 'VITASOY HOME BAR UHT OAT 1L', category: 'UHT', gaps: 2, gsv: null },
      { name: 'VITASOY ORIGINAL UHT 1L', category: 'UHT', gaps: 2, gsv: null },
      { name: 'VITASOY PROTEIN PLUS UHT 1L', category: 'UHT', gaps: 4, gsv: null },
      { name: 'VITASOY MILK ALMOND CHOC 330ML', category: 'RTD', gaps: 10, gsv: null },
      { name: 'VITASOY MILKY ESL 1L', category: 'Chilled', gaps: 4, gsv: null },
      { name: 'VITASOY MILKY ESL LTE 1L', category: 'Chilled', gaps: 8, gsv: null },
      { name: 'VITASOY OAT ICED COFF 330ML', category: 'RTD', gaps: 9, gsv: null },
    ],
  },
  {
    id: 'jones',
    mso: 'Jones Group', state: 'QLD', stores: 11, volume: 180,
    value: 4500, stage: 'Proposed', status: 'Open', fy: 2026,
    date: '19 Feb 26', orderDate: '—', vapMonth: 'March',
    owner: 'Pete @ Jones', opportunity: 'Volume Drive',
    notes: 'Target 150 ctns for March.',
    volumeTarget: '150–180 ctns', gsvEstimate: '$4,500',
    nextSteps: 'Confirm March order with Pete.',
    products: [
      { name: 'VITASOY RICE MILK UHT 1L', category: 'UHT', gaps: 3, gsv: 88.71 },
      { name: 'VITASOY HOME BAR UHT ALM 1L', category: 'UHT', gaps: 1, gsv: 31.96 },
      { name: 'VITASOY HOME BAR UHT OAT 1L', category: 'UHT', gaps: 1, gsv: 31.96 },
      { name: 'VITASOY C/NUT MILK U/SW UHT 1L', category: 'UHT', gaps: 2, gsv: 62.56 },
      { name: 'VITASOY ORIGINAL UHT 1L', category: 'UHT', gaps: 2, gsv: 57.54 },
      { name: 'VITASOY PROTEIN PLUS UHT 1L', category: 'UHT', gaps: 2, gsv: 57.54 },
      { name: 'VITASOY MILKY ESL 1L', category: 'Chilled', gaps: 1, gsv: 13.30 },
      { name: 'VITASOY MILK ALM U/SWT PRIS 1L', category: 'Chilled', gaps: 3, gsv: 53.07 },
      { name: 'VITASOY MILKY ESL LTE 1L', category: 'Chilled', gaps: 4, gsv: 53.20 },
    ],
  },
  {
    id: 'champions-26',
    mso: 'Champions', state: 'VIC', stores: 14, volume: null,
    value: 7000, stage: 'Proposed', status: 'Open', fy: 2026,
    date: '5 Mar 26', orderDate: 'March', vapMonth: 'March',
    owner: 'Azra', opportunity: 'Volume Drive',
    notes: null, volumeTarget: 'TBC', gsvEstimate: '$7,000',
    nextSteps: 'Confirm volume and order date.',
    products: [
      { name: 'VITASOY ALMOND MILKY UHT 1L', category: 'UHT', gaps: 1, gsv: 28.08 },
      { name: 'VITASOY RICE MILK UHT 1L', category: 'UHT', gaps: 1, gsv: 29.57 },
      { name: 'VITASOY C/NUT MILK U/SW UHT 1L', category: 'UHT', gaps: 5, gsv: 156.40 },
      { name: 'VITASOY HOME BAR UHT OAT 1L', category: 'UHT', gaps: 1, gsv: 31.96 },
      { name: 'VITASOY PROTEIN PLUS UHT 1L', category: 'UHT', gaps: 2, gsv: 57.54 },
      { name: 'VITASOY MILK ALMOND CHOC 330ML', category: 'RTD', gaps: 6, gsv: 76.32 },
      { name: 'VITASOY MILKY ESL LTE 1L', category: 'Chilled', gaps: 2, gsv: 26.60 },
      { name: 'VITASOY OAT ICED COFF 330ML', category: 'RTD', gaps: 4, gsv: 50.88 },
      { name: 'VITASOY OAT U/SWT ESL 1L', category: 'Chilled', gaps: 4, gsv: 63.84 },
      { name: 'VITASOY YGT OAT BLUBRY 140GM', category: 'Yoghurt', gaps: 8, gsv: 160.64 },
    ],
  },
  {
    id: 'whites',
    mso: 'Whites Group', state: 'QLD', stores: 5, volume: null,
    value: null, stage: 'Proposed', status: 'Open', fy: 2026,
    date: '25 Feb 26', orderDate: '—', vapMonth: 'March',
    owner: 'David', opportunity: 'Volume Drive',
    notes: null, volumeTarget: 'TBC', gsvEstimate: 'TBC',
    nextSteps: 'Initial contact. Confirm product gaps.',
    products: [
      { name: 'VITASOY PROTEIN PLUS UHT 1L', category: 'UHT', gaps: 5, gsv: 143.85 },
      { name: 'VITASOY MILK ALMOND CHOC 330ML', category: 'RTD', gaps: 2, gsv: 25.44 },
      { name: 'VITASOY MILKY ESL LTE 1L', category: 'Chilled', gaps: 2, gsv: 26.60 },
      { name: 'VITASOY OAT ICED COFF 330ML', category: 'RTD', gaps: 2, gsv: 25.44 },
      { name: 'VITASOY FRSH CALCI PLUS 1L', category: 'Chilled', gaps: 4, gsv: 64.52 },
      { name: 'VITASOY OAT U/SWT ESL 1L', category: 'Chilled', gaps: 1, gsv: 15.96 },
      { name: 'VITASOY SOY MILKY I/COFFEE 1L', category: 'Chilled', gaps: 1, gsv: 16.95 },
      { name: 'VITASOY YGT OAT BLUBRY 140GM', category: 'Yoghurt', gaps: 3, gsv: 60.24 },
      { name: 'VITASOY YGT GRK SOY VAN 450GM', category: 'Yoghurt', gaps: 3, gsv: 58.20 },
      { name: 'VITASOY YGT OAT VAN 140GM', category: 'Yoghurt', gaps: 3, gsv: 60.24 },
    ],
  },
  // FY2027
  {
    id: 'supabarn',
    mso: 'Supabarn', state: 'NSW', stores: 6, volume: 1800,
    value: 45000, stage: 'Discovery', status: 'Open', fy: 2027,
    date: '19 Feb 26', orderDate: '3 Jun 26', vapMonth: '—',
    owner: 'STP - Azra', opportunity: 'Volume Drive / Ranging / Relays',
    notes: null, volumeTarget: '1,800 ctns', gsvEstimate: '$45,000',
    nextSteps: 'Discovery phase. June timeline.',
    products: [],
  },
  {
    id: 'champions-27',
    mso: 'Champions', state: 'VIC', stores: 7, volume: null,
    value: null, stage: 'Discovery', status: 'Open', fy: 2027,
    date: '3 Jun 26', orderDate: '—', vapMonth: '—',
    owner: 'Azra', opportunity: 'Volume Drive / Ranging / Relays',
    notes: null, volumeTarget: 'TBC', gsvEstimate: 'TBC',
    nextSteps: 'Early discovery phase.',
    products: [],
  },
  {
    id: 'perries-27',
    mso: 'Peries', state: 'QLD', stores: 15, volume: 700,
    value: null, stage: 'Proposed', status: 'Open', fy: 2027,
    date: '26 Feb 26', orderDate: '—', vapMonth: '—',
    owner: 'Buyer & Peries', opportunity: 'Volume Drive / Ranging / Relays',
    notes: null, volumeTarget: '700 ctns', gsvEstimate: 'TBC',
    nextSteps: 'Pending FY26 close.',
    products: [],
  },
]

const STAGE_COLORS = {
  'Closed - Won': '#16a085',
  'Proposed': '#e67e22',
  'Discovery': '#2980b9',
}

const CAT_COLORS = {
  'UHT': '#1a2b5e',
  'Chilled': '#2980b9',
  'RTD': '#8e44ad',
  'Yoghurt': '#16a085',
}

function fmt(v) {
  if (v == null) return '—'
  return '$' + v.toLocaleString()
}

export default function MSOPipeline() {
  const [fyFilter, setFyFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selected, setSelected] = useState(null)

  const filtered = PIPELINE.filter(p => {
    if (fyFilter !== 'All' && p.fy !== Number(fyFilter)) return false
    if (statusFilter !== 'All' && p.status !== statusFilter) return false
    return true
  })

  const fy26 = PIPELINE.filter(p => p.fy === 2026)
  const totalValue26 = fy26.reduce((s, p) => s + (p.value || 0), 0)
  const openValue26 = fy26.filter(p => p.status === 'Open').reduce((s, p) => s + (p.value || 0), 0)
  const closedValue26 = fy26.filter(p => p.status === 'Closed').reduce((s, p) => s + (p.value || 0), 0)
  const totalStores = [...new Set(PIPELINE.map(p => p.mso))].length

  const detail = selected ? PIPELINE.find(p => p.id === selected) : null

  const catGroups = detail
    ? ['UHT', 'Chilled', 'RTD', 'Yoghurt'].reduce((acc, cat) => {
        const items = detail.products.filter(p => p.category === cat)
        if (items.length) acc[cat] = items
        return acc
      }, {})
    : {}

  return (
    <div className="mso-page">
      {/* Header */}
      <div className="mso-header">
        <div>
          <h1 className="mso-title">MSO Opportunity Pipeline</h1>
          <p className="mso-sub">FY2026 / FY2027 — Major Store Opportunities</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mso-stats">
        <div className="mso-stat">
          <div className="mso-stat-val">{fmt(totalValue26)}</div>
          <div className="mso-stat-lbl">Total FY26 Value</div>
        </div>
        <div className="mso-stat mso-stat-open">
          <div className="mso-stat-val">{fmt(openValue26)}</div>
          <div className="mso-stat-lbl">Open Pipeline</div>
        </div>
        <div className="mso-stat mso-stat-won">
          <div className="mso-stat-val">{fmt(closedValue26)}</div>
          <div className="mso-stat-lbl">Closed Won</div>
        </div>
        <div className="mso-stat">
          <div className="mso-stat-val">{totalStores}</div>
          <div className="mso-stat-lbl">MSO Groups</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mso-filters">
        <div className="mso-filter-group">
          <span className="mso-filter-lbl">FY:</span>
          {['All', '2026', '2027'].map(f => (
            <button key={f} className={`mso-filter-btn ${fyFilter === f ? 'active' : ''}`} onClick={() => setFyFilter(f)}>{f}</button>
          ))}
        </div>
        <div className="mso-filter-group">
          <span className="mso-filter-lbl">Status:</span>
          {['All', 'Open', 'Closed'].map(f => (
            <button key={f} className={`mso-filter-btn ${statusFilter === f ? 'active' : ''}`} onClick={() => setStatusFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {/* Pipeline list + detail panel */}
      <div className={`mso-body ${detail ? 'with-panel' : ''}`}>
        {/* Table */}
        <div className="mso-table-wrap">
          <table className="mso-table">
            <thead>
              <tr>
                <th>MSO</th>
                <th>State</th>
                <th>Stores</th>
                <th>Volume (ctns)</th>
                <th>Est. Value</th>
                <th>Stage</th>
                <th>FY</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr
                  key={p.id}
                  className={`mso-row ${selected === p.id ? 'selected' : ''}`}
                  onClick={() => setSelected(selected === p.id ? null : p.id)}
                >
                  <td className="mso-mso-name">{p.mso}</td>
                  <td>{p.state}</td>
                  <td>{p.stores ?? '—'}</td>
                  <td>{p.volume ? p.volume.toLocaleString() : '—'}</td>
                  <td className="mso-value">{fmt(p.value)}</td>
                  <td>
                    <span className="mso-stage-badge" style={{ background: STAGE_COLORS[p.stage] + '22', color: STAGE_COLORS[p.stage], border: `1px solid ${STAGE_COLORS[p.stage]}` }}>
                      {p.stage}
                    </span>
                  </td>
                  <td><span className="mso-fy-badge">FY{p.fy}</span></td>
                  <td className="mso-owner">{p.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {detail && (
          <div className="mso-panel">
            <div className="mso-panel-header">
              <div>
                <h2 className="mso-panel-title">{detail.mso}</h2>
                <div className="mso-panel-meta">{detail.state} · {detail.stores} stores · FY{detail.fy}</div>
              </div>
              <button className="mso-panel-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* Key details */}
            <div className="mso-panel-details">
              <div className="mso-detail-row">
                <span className="mso-detail-lbl">Stage</span>
                <span className="mso-stage-badge" style={{ background: STAGE_COLORS[detail.stage] + '22', color: STAGE_COLORS[detail.stage], border: `1px solid ${STAGE_COLORS[detail.stage]}` }}>{detail.stage}</span>
              </div>
              <div className="mso-detail-row">
                <span className="mso-detail-lbl">Opportunity</span>
                <span>{detail.opportunity}</span>
              </div>
              <div className="mso-detail-row">
                <span className="mso-detail-lbl">Est. Value</span>
                <span className="mso-detail-val">{fmt(detail.value)}</span>
              </div>
              <div className="mso-detail-row">
                <span className="mso-detail-lbl">Volume Target</span>
                <span>{detail.volumeTarget}</span>
              </div>
              <div className="mso-detail-row">
                <span className="mso-detail-lbl">GSV Estimate</span>
                <span>{detail.gsvEstimate}</span>
              </div>
              <div className="mso-detail-row">
                <span className="mso-detail-lbl">Order Date</span>
                <span>{detail.orderDate}</span>
              </div>
              <div className="mso-detail-row">
                <span className="mso-detail-lbl">VAP Month</span>
                <span>{detail.vapMonth}</span>
              </div>
              <div className="mso-detail-row">
                <span className="mso-detail-lbl">Owner</span>
                <span>{detail.owner}</span>
              </div>
            </div>

            {detail.notes && (
              <div className="mso-panel-notes">
                <div className="mso-notes-lbl">Notes</div>
                <p>{detail.notes}</p>
              </div>
            )}

            {detail.nextSteps && (
              <div className="mso-panel-notes mso-next-steps">
                <div className="mso-notes-lbl">Next Steps</div>
                <p>{detail.nextSteps}</p>
              </div>
            )}

            {/* Product gaps by category */}
            {Object.keys(catGroups).length > 0 && (
              <div className="mso-panel-products">
                <div className="mso-products-title">Product Gaps</div>
                {Object.entries(catGroups).map(([cat, items]) => (
                  <div key={cat} className="mso-cat-block">
                    <div className="mso-cat-header" style={{ color: CAT_COLORS[cat] }}>{cat}</div>
                    {items.map(item => (
                      <div key={item.name} className="mso-product-row">
                        <span className="mso-product-name">{item.name}</span>
                        <span className="mso-product-gap">
                          {typeof item.gaps === 'number' ? `${item.gaps} store${item.gaps !== 1 ? 's' : ''}` : item.gaps}
                        </span>
                        {item.gsv && <span className="mso-product-gsv">${item.gsv.toFixed(2)}</span>}
                      </div>
                    ))}
                  </div>
                ))}
                <div className="mso-gsv-total">
                  Total GSV Opp: <strong>${detail.products.reduce((s, p) => s + (p.gsv || 0), 0).toFixed(2)}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
