import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { CURRENT_CYCLE, CURRENT_YEAR } from '../constants'
import './GsvPlannerTab.css'

// ─── Constants ────────────────────────────────────────────────────────────────
const PS_CYCLE = String(CURRENT_CYCLE) // Perfect Store cycle — separate from planner cycle (1,2,3)

const REP_STATES = {
  'Sam Gowen':          ['South Australia'],
  'Dipen Surani':       ['Western Australia'],
  'Ashleigh Tasdarian': ['New South Wales'],
  'David Kerr':         ['Queensland'],
  'Shane Vandewardt':   ['Victoria'],
  'Azra Horell':        ['Victoria'],
}

const ACTION_TYPES = [
  { value: 'gap_fill',     label: 'Gap Fill',     color: '#2980b9', bg: '#ebf5fb' },
  { value: 'planogram',    label: 'Planogram',    color: '#8e44ad', bg: '#f5eef8' },
  { value: 'off_location', label: 'Off Location', color: '#e67e22', bg: '#fef9e7' },
]

const PRODUCT_CATS = ['UHT Core', 'UHT Non-Core', 'Chilled', 'RTD', 'Yoghurt']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function actionMeta(type) {
  return ACTION_TYPES.find(a => a.value === type) || { label: type || '—', color: '#888', bg: '#f4f6f7' }
}

function fmt$(v) {
  if (v == null || v === '') return '—'
  return `$${Number(v).toFixed(2)}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// ─── Action Type Pill ─────────────────────────────────────────────────────────
function ActionPill({ type }) {
  const m = actionMeta(type)
  return (
    <span className="gp-pill" style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  )
}

// ─── Strategy Pill ────────────────────────────────────────────────────────────
const STRAT_META = {
  'PERFECT STORE': { color: '#16a085', bg: '#e8f8f5' },
  'DEVELOP':       { color: '#2980b9', bg: '#ebf5fb' },
  'GROW':          { color: '#e67e22', bg: '#fef9e7' },
  'EXPAND':        { color: '#8e44ad', bg: '#f5eef8' },
}
function StratPill({ value }) {
  if (!value) return <span className="gp-muted">—</span>
  const key = Object.keys(STRAT_META).find(k => value.toUpperCase().includes(k))
  const m = key ? STRAT_META[key] : { color: '#888', bg: '#f4f6f7' }
  const label = key
    ? key.charAt(0) + key.slice(1).toLowerCase().replace(' store', ' Store')
    : value
  return <span className="gp-pill" style={{ color: m.color, background: m.bg }}>{label}</span>
}

// ─── Blank form ───────────────────────────────────────────────────────────────
const BLANK = {
  action_type:      'gap_fill',
  product_category: 'UHT Core',
  skus_added:       '',
  gsv_value:        '',
  notes:            '',
  action_date:      today(),
}

// ─── Inline Add-Action Form ───────────────────────────────────────────────────
function AddActionForm({ store, rep, onSave, onCancel }) {
  const [form, setForm] = useState({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    setErr(null)
    setSaving(true)
    const { data, error } = await supabase
      .from('gsv_actions')
      .insert({
        store_id:         store.store_id,
        store_name:       store.store_name,
        rep_name:         rep,
        cycle:            PS_CYCLE,
        action_type:      form.action_type,
        product_category: form.product_category || null,
        skus_added:       form.skus_added !== '' ? parseInt(form.skus_added) : null,
        gsv_value:        form.gsv_value  !== '' ? parseFloat(form.gsv_value) : null,
        status:           'planned',
        notes:            form.notes || null,
        action_date:      form.action_date || null,
      })
      .select()
      .single()
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSave(data)
  }

  return (
    <div className="gp-add-form">
      <div className="gp-form-store-name">+ Adding action for <strong>{store.store_name}</strong></div>

      <div className="gp-form-row">
        <div className="gp-form-group">
          <label>Action Type</label>
          <select value={form.action_type} onChange={e => set('action_type', e.target.value)}>
            {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div className="gp-form-group">
          <label>Product Category</label>
          <select value={form.product_category} onChange={e => set('product_category', e.target.value)}>
            {PRODUCT_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="gp-form-group gp-form-group--sm">
          <label>SKUs to Add</label>
          <input type="number" min="0" placeholder="0"
            value={form.skus_added} onChange={e => set('skus_added', e.target.value)} />
        </div>
        <div className="gp-form-group gp-form-group--sm">
          <label>Est. GSV $</label>
          <input type="number" min="0" step="0.01" placeholder="0.00"
            value={form.gsv_value} onChange={e => set('gsv_value', e.target.value)} />
        </div>
        <div className="gp-form-group gp-form-group--sm">
          <label>Planned Date</label>
          <input type="date" value={form.action_date} onChange={e => set('action_date', e.target.value)} />
        </div>
      </div>

      <div className="gp-form-row">
        <div className="gp-form-group gp-form-group--full">
          <label>Notes</label>
          <input type="text" placeholder="Optional notes…"
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>

      {err && <div className="gp-form-err">Error: {err}</div>}

      <div className="gp-form-actions">
        <button className="gp-btn gp-btn--save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : '+ Add Action'}
        </button>
        <button className="gp-btn gp-btn--cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GsvPlannerTab({ rep, cycleNum }) {
  const [focusStores,     setFocusStores]     = useState([])
  const [actions,         setActions]         = useState([])
  const [plannerStoreIds, setPlannerStoreIds] = useState(new Set())
  const [loading,         setLoading]         = useState(true)
  const [addingFor,       setAddingFor]       = useState(null) // store_id with open form
  const [markingId,       setMarkingId]       = useState(null) // action id being saved

  // ── Load all data ──────────────────────────────────────────────────────────
  useEffect(() => { load() }, [rep, cycleNum])

  async function load() {
    setLoading(true)
    const repStates = REP_STATES[rep] || []

    const [psRes, actRes, slotsRes] = await Promise.all([
      // Focus stores for this rep
      supabase
        .from('perfect_store')
        .select('store_id,store_name,state,strategy_c4,focus_store_status,gsv_potential,call_fqy_target,c4_call_fqy,total_ranging,vitasoy_rank')
        .eq('cycle', 4)
        .not('focus_store', 'is', null)
        .in('state', repStates.length ? repStates : ['__none__'])
        .order('vitasoy_rank', { ascending: true }),

      // GSV actions for this rep in PS cycle 4
      supabase
        .from('gsv_actions')
        .select('*')
        .eq('rep_name', rep)
        .eq('cycle', PS_CYCLE)
        .order('created_at', { ascending: false }),

      // Which stores are in the rep's current planner cycle (for cross-ref badge)
      supabase
        .from('cycle_planner_slots')
        .select('store_id')
        .eq('rep_name', rep)
        .eq('cycle', String(cycleNum)),
    ])

    setFocusStores(psRes.data  || [])
    setActions(actRes.data     || [])
    setPlannerStoreIds(new Set((slotsRes.data || []).map(s => s.store_id)))
    setLoading(false)
  }

  // ── Optimistic state updates ───────────────────────────────────────────────
  const handleActionSaved = useCallback((newAction) => {
    setActions(prev => [newAction, ...prev])
    setAddingFor(null)
  }, [])

  async function markAchieved(actionId) {
    setMarkingId(actionId)
    const { error } = await supabase
      .from('gsv_actions')
      .update({ status: 'achieved' })
      .eq('id', actionId)
    setMarkingId(null)
    if (!error) setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: 'achieved' } : a))
  }

  async function deleteAction(actionId) {
    if (!window.confirm('Delete this action?')) return
    const { error } = await supabase.from('gsv_actions').delete().eq('id', actionId)
    if (!error) setActions(prev => prev.filter(a => a.id !== actionId))
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const plannedActions  = useMemo(() => actions.filter(a => a.status === 'planned'),  [actions])
  const achievedActions = useMemo(() => actions.filter(a => a.status === 'achieved'), [actions])

  // Active focus stores (exclude Won)
  const activeStores = useMemo(() =>
    focusStores.filter(s => s.focus_store_status !== 'Won'),
    [focusStores]
  )

  // Planned actions grouped by store_id
  const actionsByStore = useMemo(() => {
    const map = {}
    plannedActions.forEach(a => {
      if (!map[a.store_id]) map[a.store_id] = []
      map[a.store_id].push(a)
    })
    return map
  }, [plannedActions])

  // KPI totals for achieved section
  const kpis = useMemo(() => ({
    totalGsv:   achievedActions.reduce((s, a) => s + (a.gsv_value || 0), 0),
    gapFills:   achievedActions.filter(a => a.action_type === 'gap_fill').length,
    planograms: achievedActions.filter(a => a.action_type === 'planogram').length,
    offLoc:     achievedActions.filter(a => a.action_type === 'off_location').length,
  }), [achievedActions])

  // ── Export to Excel ────────────────────────────────────────────────────────
  function exportExcel() {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Planned
    const plannedRows = activeStores.flatMap(s => {
      const acts = actionsByStore[s.store_id] || []
      const base = {
        'Store Name':   s.store_name,
        'State':        s.state,
        'Strategy C4':  s.strategy_c4 || '',
        'GSV Opp $':    s.gsv_potential || 0,
        'In Planner':   plannerStoreIds.has(s.store_id) ? 'Yes' : 'No',
      }
      if (acts.length === 0) return [{ ...base, 'Action Type': '', 'Category': '', 'SKUs': '', 'Est. GSV $': '', 'Planned Date': '', 'Notes': '' }]
      return acts.map(a => ({
        ...base,
        'Action Type':  actionMeta(a.action_type).label,
        'Category':     a.product_category || '',
        'SKUs':         a.skus_added ?? '',
        'Est. GSV $':   a.gsv_value ?? '',
        'Planned Date': a.action_date || '',
        'Notes':        a.notes || '',
      }))
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plannedRows.length ? plannedRows : [{}]), 'Planned Actions')

    // Sheet 2: Achieved
    const achievedRows = achievedActions.map(a => ({
      'Store Name':   a.store_name || '',
      'Action Type':  actionMeta(a.action_type).label,
      'Category':     a.product_category || '',
      'SKUs Added':   a.skus_added ?? '',
      'GSV $ Gained': a.gsv_value ?? '',
      'Date':         a.action_date || '',
      'Notes':        a.notes || '',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(achievedRows.length ? achievedRows : [{}]), 'Achieved')

    const stamp = today().replace(/-/g, '')
    XLSX.writeFile(wb, `GSV_Planner_${rep.replace(/ /g, '_')}_${stamp}.xlsx`)
  }

  // ── Export to PDF ──────────────────────────────────────────────────────────
  function exportPdf() {
    const prev = document.title
    document.title = `GSV_Planner_${rep.replace(/ /g, '_')}_${today()}`
    window.print()
    setTimeout(() => { document.title = prev }, 1000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="gp-loading">
      <div className="gp-spinner" />
      <p>Loading GSV Planner…</p>
    </div>
  )

  return (
    <div className="gp-wrap">

      {/* ── Page header ── */}
      <div className="gp-header gp-print-hide">
        <div>
          <h2 className="gp-title">GSV Planner — Cycle {CURRENT_CYCLE} {CURRENT_YEAR}</h2>
          <p className="gp-sub">
            {rep} · {activeStores.length} active focus stores · {plannedActions.length} actions planned
          </p>
        </div>
        <div className="gp-export-btns">
          <button className="gp-export-btn" onClick={exportExcel}>📊 Export Excel</button>
          <button className="gp-export-btn" onClick={exportPdf}>🖨 Export PDF</button>
        </div>
      </div>

      {/* PDF-only title */}
      <div className="gp-print-only gp-pdf-title">
        GSV Planner — Cycle {CURRENT_CYCLE} {CURRENT_YEAR} — {rep} — {today()}
      </div>

      {/* ════ Section A: Planned Actions ════ */}
      <section className="gp-section">
        <h3 className="gp-section-title">A — Planned Actions</h3>

        {activeStores.length === 0 ? (
          <div className="gp-empty">No active focus stores found for {rep} in this cycle.</div>
        ) : (
          <div className="gp-table-wrap">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>Store Name</th>
                  <th>Strategy</th>
                  <th className="gp-num">GSV Opp $</th>
                  <th className="gp-num">Ranging</th>
                  <th>Action Type</th>
                  <th>Category</th>
                  <th className="gp-num">SKUs</th>
                  <th className="gp-num">Est. GSV $</th>
                  <th>Date</th>
                  <th>Notes</th>
                  <th className="gp-center">Planner</th>
                  <th className="gp-print-hide gp-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeStores.map(s => {
                  const storeActs = actionsByStore[s.store_id] || []
                  const inPlanner = plannerStoreIds.has(s.store_id)
                  const isAdding  = addingFor === s.store_id

                  return (
                    <Fragment key={s.store_id}>

                      {/* ── Store row (no actions) ── */}
                      {storeActs.length === 0 && (
                        <tr className="gp-row gp-row--store">
                          <td className="gp-store-name-cell">
                            {s.store_name}
                            {inPlanner && <span className="gp-planner-dot" title="In Cycle Planner">📅</span>}
                          </td>
                          <td><StratPill value={s.strategy_c4} /></td>
                          <td className="gp-num gp-gsv">{fmt$(s.gsv_potential)}</td>
                          <td className="gp-num">{s.total_ranging ?? '—'}/30</td>
                          <td colSpan={6} className="gp-no-actions-cell">
                            <span className="gp-no-actions">No actions yet</span>
                          </td>
                          <td className="gp-center">{inPlanner ? '✅' : <span className="gp-muted">—</span>}</td>
                          <td className="gp-print-hide gp-center" />
                        </tr>
                      )}

                      {/* ── Store row (first action, then action sub-rows) ── */}
                      {storeActs.map((a, ai) => (
                        <tr key={a.id} className={`gp-row ${ai === 0 ? 'gp-row--store' : 'gp-row--action-cont'}`}>
                          {ai === 0 ? (
                            <td className="gp-store-name-cell">
                              {s.store_name}
                              {inPlanner && <span className="gp-planner-dot" title="In Cycle Planner">📅</span>}
                            </td>
                          ) : (
                            <td className="gp-store-name-cell gp-row-cont-indent" />
                          )}
                          {ai === 0 ? <td><StratPill value={s.strategy_c4} /></td> : <td />}
                          {ai === 0 ? <td className="gp-num gp-gsv">{fmt$(s.gsv_potential)}</td> : <td />}
                          {ai === 0 ? <td className="gp-num">{s.total_ranging ?? '—'}/30</td> : <td />}
                          <td><ActionPill type={a.action_type} /></td>
                          <td className="gp-muted">{a.product_category || '—'}</td>
                          <td className="gp-num">{a.skus_added ?? '—'}</td>
                          <td className="gp-num gp-gsv">{fmt$(a.gsv_value)}</td>
                          <td className="gp-muted">{fmtDate(a.action_date)}</td>
                          <td className="gp-notes gp-muted">{a.notes || '—'}</td>
                          {ai === 0 ? (
                            <td className="gp-center">{inPlanner ? '✅' : <span className="gp-muted">—</span>}</td>
                          ) : <td />}
                          <td className="gp-print-hide gp-action-btns-cell">
                            <button
                              className="gp-action-btn gp-action-btn--achieve"
                              onClick={() => markAchieved(a.id)}
                              disabled={markingId === a.id}
                              title="Mark as achieved"
                            >{markingId === a.id ? '…' : '✓ Achieved'}</button>
                            <button
                              className="gp-action-btn gp-action-btn--del"
                              onClick={() => deleteAction(a.id)}
                              title="Delete action"
                            >✕</button>
                          </td>
                        </tr>
                      ))}

                      {/* ── Add form row ── */}
                      {isAdding && (
                        <tr className="gp-form-row-tr gp-print-hide">
                          <td colSpan={12} style={{ padding: 0 }}>
                            <AddActionForm
                              store={s}
                              rep={rep}
                              onSave={handleActionSaved}
                              onCancel={() => setAddingFor(null)}
                            />
                          </td>
                        </tr>
                      )}

                      {/* ── Add action trigger ── */}
                      {!isAdding && (
                        <tr className="gp-add-trigger-row gp-print-hide">
                          <td colSpan={12}>
                            <button
                              className="gp-add-trigger"
                              onClick={() => setAddingFor(s.store_id)}
                            >+ Add action for {s.store_name}</button>
                          </td>
                        </tr>
                      )}

                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ════ Section B: Achieved ════ */}
      <section className="gp-section">
        <h3 className="gp-section-title">B — Achieved (Cycle {CURRENT_CYCLE} {CURRENT_YEAR})</h3>

        {/* KPI bar */}
        <div className="gp-kpi-bar">
          <div className="gp-kpi gp-kpi--green">
            <div className="gp-kpi-val">{fmt$(kpis.totalGsv)}</div>
            <div className="gp-kpi-lbl">Total GSV Achieved</div>
          </div>
          <div className="gp-kpi gp-kpi--blue">
            <div className="gp-kpi-val">{kpis.gapFills}</div>
            <div className="gp-kpi-lbl">Gap Fills</div>
          </div>
          <div className="gp-kpi gp-kpi--purple">
            <div className="gp-kpi-val">{kpis.planograms}</div>
            <div className="gp-kpi-lbl">Planograms</div>
          </div>
          <div className="gp-kpi gp-kpi--orange">
            <div className="gp-kpi-val">{kpis.offLoc}</div>
            <div className="gp-kpi-lbl">Off Locations</div>
          </div>
        </div>

        {achievedActions.length === 0 ? (
          <div className="gp-empty">
            No achieved actions yet — mark planned actions as ✓ Achieved above.
          </div>
        ) : (
          <div className="gp-table-wrap">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>Store Name</th>
                  <th>Action Type</th>
                  <th>Category</th>
                  <th className="gp-num">SKUs Added</th>
                  <th className="gp-num">GSV $ Gained</th>
                  <th>Date</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {achievedActions.map(a => (
                  <tr key={a.id} className="gp-row gp-row--achieved">
                    <td className="gp-store-name-cell">{a.store_name || '—'}</td>
                    <td><ActionPill type={a.action_type} /></td>
                    <td className="gp-muted">{a.product_category || '—'}</td>
                    <td className="gp-num">{a.skus_added ?? '—'}</td>
                    <td className="gp-num gp-gsv">{fmt$(a.gsv_value)}</td>
                    <td className="gp-muted">{fmtDate(a.action_date)}</td>
                    <td className="gp-notes gp-muted">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}
