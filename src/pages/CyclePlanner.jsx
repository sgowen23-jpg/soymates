import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { STORES } from '../data/stores'
import './CyclePlanner.css'

// ─── Constants ────────────────────────────────────────────────────────────────
const REPS = [
  'Ashleigh Tasdarian',
  'Shane Vandewardt',
  'David Kerr',
  'Sam Gowen',
  'Dipen Surani',
  'Azra Horell',
]

const CYCLE_STARTS = {
  1: '2026-03-30',
  2: '2026-06-22',
  3: '2026-09-14',
}

// Which states each rep covers — must match exact DB values
const REP_STATES = {
  'Sam Gowen':          ['South Australia'],
  'Dipen Surani':       ['Western Australia'],
  'Ashleigh Tasdarian': ['New South Wales'],
  'David Kerr':         ['Queensland'],
  'Shane Vandewardt':   ['Victoria'],
  'Azra Horell':        ['Victoria'],
}

// Parse FQY target string → visits per 12-wk cycle
function parseFQY(fqy) {
  if (!fqy) return 1
  const m = String(fqy).match(/^(\d+)/)
  if (m) return parseInt(m[1])
  if (String(fqy).toLowerCase().includes('alternate')) return 6
  return 1
}

const STRATEGY_META = {
  GROW:    { label: 'Grow',    colour: '#16a085', bg: '#e8f8f5' },
  DEVELOP: { label: 'Develop', colour: '#e67e22', bg: '#fef5e7' },
  EXPAND:  { label: 'Expand',  colour: '#CC0000', bg: '#fdedec' },
}

const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri']
const DAY_KEYS  = ['mon','tue','wed','thu','fri']
const PRESET_COLOURS = ['#1a2b5e','#CC0000','#16a085','#e67e22','#8e44ad','#2980b9','#c0392b','#27ae60']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDS(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtDay(d) {
  return `${DAY_SHORT[d.getDay()-1]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
function getCycleDates(cycle) {
  const start = new Date(CYCLE_STARTS[cycle] + 'T00:00:00')
  return Array.from({ length: 12 }, (_, w) =>
    Array.from({ length: 5 }, (_, d) => {
      const day = new Date(start)
      day.setDate(start.getDate() + w * 7 + d)
      return day
    })
  )
}
function psPriority(score) {
  if (score == null) return null
  if (score >= 20) return 'green'
  if (score >= 12) return 'orange'
  return 'red'
}

// ─── Searchable Store Picker ──────────────────────────────────────────────────
function StoreSelect({ psScores, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [q, setQ]       = useState('')
  const wrapRef  = useRef(null)
  const inputRef = useRef(null)

  const selected = value ? STORES.find(s => s.id === value) : null

  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const filtered = useMemo(() => {
    const lq = q.toLowerCase()
    const list = q
      ? STORES.filter(s =>
          s.name.toLowerCase().includes(lq) ||
          (s.suburb || '').toLowerCase().includes(lq) ||
          (s.state  || '').toLowerCase().includes(lq) ||
          (s.chain  || '').toLowerCase().includes(lq)
        )
      : STORES
    return list.slice(0, 60)
  }, [q])

  const ps       = value ? psScores[value] : null
  const priority = ps ? psPriority(ps.total_ranging) : null

  function openPicker() {
    setOpen(true); setQ('')
    setTimeout(() => inputRef.current?.focus(), 30)
  }
  function pick(store) { onChange(store?.id || null, store); setOpen(false); setQ('') }

  return (
    <div className="cp-ss-wrap" ref={wrapRef}>
      <button type="button" className={`cp-ss-btn ${priority || ''}`}
        onClick={open ? () => setOpen(false) : openPicker}>
        {priority && <span className={`cp-dot ${priority}`} />}
        <span className="cp-ss-name">
          {selected ? selected.name : <span className="cp-ss-ph">+ Add store</span>}
        </span>
        {ps && <span className="cp-ss-score">{ps.total_ranging ?? '?'}/28</span>}
        {value && <span className="cp-ss-x" onClick={e => { e.stopPropagation(); pick(null) }}>✕</span>}
      </button>
      {open && (
        <div className="cp-ss-drop">
          <input ref={inputRef} className="cp-ss-search"
            placeholder="Search by name, suburb, state…" value={q}
            onChange={e => setQ(e.target.value)} onClick={e => e.stopPropagation()} />
          <div className="cp-ss-list">
            {filtered.length === 0 && <div className="cp-ss-empty">No stores found</div>}
            {filtered.map(s => {
              const sps  = psScores[s.id]
              const spri = sps ? psPriority(sps.total_ranging) : null
              return (
                <div key={s.id} className={`cp-ss-opt ${s.id === value ? 'active' : ''}`} onClick={() => pick(s)}>
                  {spri && <span className={`cp-dot ${spri}`} />}
                  <span className="cp-ss-opt-name">{s.name}</span>
                  <span className="cp-ss-opt-sub">{s.suburb || s.state}</span>
                  {sps && <span className={`cp-ss-opt-score ${spri || ''}`}>{sps.total_ranging ?? '?'}/28</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Build route URLs ─────────────────────────────────────────────────────────
function buildRouteUrls(storeIds, homeBase) {
  const storeObjs = storeIds.map(id => STORES.find(s => s.id === id)).filter(Boolean)
  if (!storeObjs.length) return null
  const addrs     = storeObjs.map(s => s.address || [s.name, s.suburb, s.state].filter(Boolean).join(', '))
  const originRaw = homeBase?.start_point  || homeBase?.home_address || ''
  const destRaw   = homeBase?.finish_point || homeBase?.home_address || ''
  const googleStops = []
  if (originRaw) googleStops.push(originRaw)
  googleStops.push(...addrs)
  if (destRaw) googleStops.push(destRaw)
  const google = 'https://www.google.com/maps/dir/' + googleStops.map(s => encodeURIComponent(s)).join('/')
  const aOrigin = encodeURIComponent(originRaw || addrs[0])
  const aDests  = (destRaw ? [...addrs, destRaw] : addrs).map(a => encodeURIComponent(a))
  let apple = `https://maps.apple.com/?saddr=${aOrigin}&dirflg=d`
  aDests.forEach(d => { apple += `&daddr=${d}` })
  const waze = `waze://?q=${encodeURIComponent(addrs[0])}&navigate=yes`
  return { google, apple, waze, storeCount: storeObjs.length }
}

// ─── Day Card ─────────────────────────────────────────────────────────────────
function DayCard({ date, psScores, daySlots, dayNotes, leaveInfo, homeBase,
                   dayRuns, appliedRun, onSlotChange, onNotesChange, onApplyRun, onClearRun }) {
  const isLeave   = !!leaveInfo
  const leaveType = leaveInfo?.type || null
  const ds        = toDS(date)
  const [showRouteMenu, setShowRouteMenu] = useState(false)
  const routeRef = useRef(null)

  useEffect(() => {
    if (!showRouteMenu) return
    function onDown(e) {
      if (routeRef.current && !routeRef.current.contains(e.target)) setShowRouteMenu(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown) }
  }, [showRouteMenu])

  function openMap(url) {
    if (url.startsWith('waze://')) { window.location.href = url }
    else { window.open(url, '_blank', 'noopener,noreferrer') }
    setShowRouteMenu(false)
  }

  const storeIds = Array.from({ length: 8 }, (_, i) => daySlots[i]).filter(Boolean)
  const routes   = storeIds.length ? buildRouteUrls(storeIds, homeBase) : null

  if (isLeave) {
    const isPH      = leaveType === 'Public Holiday'
    const leaveName = leaveInfo?.name || ''
    return (
      <div className={`cp-day cp-day-leave ${isPH ? 'cp-day-pubhol' : ''}`}>
        <div className="cp-day-hd">
          <span className="cp-day-lbl">{fmtDay(date)}</span>
          <span className={`cp-leave-tag ${isPH ? 'cp-leave-tag-ph' : ''}`}>
            {isPH ? '🏛 Public Holiday' : '🏖 On Leave'}
          </span>
        </div>
        {leaveName && <div className="cp-leave-name">{leaveName}</div>}
      </div>
    )
  }

  return (
    <div className="cp-day">
      <div className="cp-day-hd">
        <span className="cp-day-lbl">{fmtDay(date)}</span>
        <div className="cp-route-wrap" ref={routeRef}>
          <button className="cp-route-btn" type="button" onClick={() => {
            if (!routes) { alert('Add at least one store to this day first.'); return }
            setShowRouteMenu(v => !v)
          }}>🗺 Route</button>
          {showRouteMenu && routes && (
            <div className="cp-route-menu">
              <div className="cp-route-menu-title">{routes.storeCount} stop{routes.storeCount !== 1 ? 's' : ''} — open in</div>
              <button className="cp-route-app cp-route-google" onClick={() => openMap(routes.google)}>
                <span className="cp-route-app-icon">🗺</span><span>Google Maps</span>
                <span className="cp-route-app-note">all stops</span>
              </button>
              <button className="cp-route-app cp-route-apple" onClick={() => openMap(routes.apple)}>
                <span className="cp-route-app-icon">🍎</span><span>Apple Maps</span>
                <span className="cp-route-app-note">all stops</span>
              </button>
              <button className="cp-route-app cp-route-waze" onClick={() => openMap(routes.waze)}>
                <span className="cp-route-app-icon">
                  <img src="https://www.waze.com/assets/waze-logo.svg" alt="Waze" className="cp-waze-icon"
                    onError={e => { e.target.style.display='none'; e.target.parentNode.textContent='🚗' }} />
                </span>
                <span>Waze</span><span className="cp-route-app-note">first stop</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Applied run banner OR run picker */}
      {appliedRun ? (
        <div className="cp-applied-run" style={{ borderColor: appliedRun.colour, background: appliedRun.colour + '18' }}>
          <span className="cp-applied-run-dot" style={{ background: appliedRun.colour }} />
          <span className="cp-applied-run-name">{appliedRun.run_name}</span>
          {appliedRun.is_regional && <span className="cp-regional-tag">Regional</span>}
          <button className="cp-applied-run-x" onClick={onClearRun} title="Clear this day">✕</button>
        </div>
      ) : dayRuns.length > 0 ? (
        <select className="cp-run-picker" defaultValue=""
          onChange={e => {
            const run = dayRuns.find(r => String(r.id) === e.target.value)
            if (run) onApplyRun(run)
            e.target.value = ''
          }}>
          <option value="">Apply a run…</option>
          {dayRuns.map(r => (
            <option key={r.id} value={r.id}>
              {r.run_name}{r.is_regional ? ' 📍 Regional' : ''}
            </option>
          ))}
        </select>
      ) : null}

      <div className="cp-slots">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="cp-slot">
            <span className="cp-slot-n">{i + 1}</span>
            <StoreSelect psScores={psScores} value={daySlots[i] || null}
              onChange={(id, store) => onSlotChange(ds, i, id, store)} />
          </div>
        ))}
      </div>

      <textarea className="cp-notes" placeholder="Notes for the day…"
        value={dayNotes || ''} onChange={e => onNotesChange(ds, e.target.value)} rows={2} />
    </div>
  )
}

// ─── Run Form (create / edit) ─────────────────────────────────────────────────
function RunForm({ initial, psScores, onSave, onCancel }) {
  const blank = { run_name: '', is_regional: false, colour: '#1a2b5e', store_ids: [] }
  const [form, setForm] = useState(initial || blank)
  const [saving, setSaving] = useState(false)

  function setField(f, v) { setForm(prev => ({ ...prev, [f]: v })) }

  function setSlot(idx, storeId) {
    setForm(prev => {
      const ids = [...(prev.store_ids || [])]
      if (storeId) { ids[idx] = storeId } else { ids.splice(idx, 1) }
      return { ...prev, store_ids: ids.filter(Boolean) }
    })
  }

  async function handleSave() {
    if (!form.run_name.trim()) { alert('Please enter a run name.'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="cp-run-form">
      <div className="cp-run-form-row">
        <input className="cp-run-input" placeholder="Run name e.g. East Run"
          value={form.run_name} onChange={e => setField('run_name', e.target.value)} />
        <label className="cp-run-toggle">
          <input type="checkbox" checked={form.is_regional}
            onChange={e => setField('is_regional', e.target.checked)} />
          <span>Regional</span>
        </label>
      </div>
      <div className="cp-run-colour-row">
        <span className="cp-field-lbl">Colour</span>
        <div className="cp-colour-presets">
          {PRESET_COLOURS.map(c => (
            <button key={c} type="button"
              className={`cp-colour-swatch ${form.colour === c ? 'active' : ''}`}
              style={{ background: c }} onClick={() => setField('colour', c)} />
          ))}
          <input type="color" className="cp-colour-custom" value={form.colour}
            onChange={e => setField('colour', e.target.value)} title="Custom colour" />
        </div>
      </div>
      <div className="cp-field-lbl" style={{ marginBottom: 4 }}>Stores (up to 8)</div>
      <div className="cp-run-slots">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="cp-slot">
            <span className="cp-slot-n">{i + 1}</span>
            <StoreSelect psScores={psScores}
              value={form.store_ids[i] || null}
              onChange={(id) => setSlot(i, id)} />
          </div>
        ))}
      </div>
      <div className="cp-run-form-actions">
        <button className="cp-btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Update Run' : 'Save Run'}
        </button>
        <button className="cp-btn-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Template Form (create / edit) ───────────────────────────────────────────
function TemplateForm({ initial, dayRuns, onSave, onCancel }) {
  const blank = { template_name: '', mon_run_id: null, tue_run_id: null, wed_run_id: null, thu_run_id: null, fri_run_id: null }
  const [form, setForm] = useState(initial || blank)
  const [saving, setSaving] = useState(false)

  function setDay(key, val) { setForm(prev => ({ ...prev, [`${key}_run_id`]: val || null })) }

  async function handleSave() {
    if (!form.template_name.trim()) { alert('Please enter a template name.'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="cp-run-form">
      <input className="cp-run-input" placeholder="Template name e.g. Week A"
        value={form.template_name} onChange={e => setForm(p => ({ ...p, template_name: e.target.value }))} />
      <div className="cp-tpl-days">
        {DAY_KEYS.map((key, i) => (
          <div key={key} className="cp-tpl-day-row">
            <span className="cp-tpl-day-lbl">{DAY_SHORT[i]}</span>
            <select className="cp-tpl-day-sel"
              value={form[`${key}_run_id`] || ''}
              onChange={e => setDay(key, e.target.value ? Number(e.target.value) : null)}>
              <option value="">No run</option>
              {dayRuns.map(r => (
                <option key={r.id} value={r.id}>
                  {r.run_name}{r.is_regional ? ' 📍' : ''}
                </option>
              ))}
            </select>
            {form[`${key}_run_id`] && (() => {
              const r = dayRuns.find(x => x.id === Number(form[`${key}_run_id`]))
              return r ? <span className="cp-tpl-run-dot" style={{ background: r.colour }} /> : null
            })()}
          </div>
        ))}
      </div>
      <div className="cp-run-form-actions">
        <button className="cp-btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Update Template' : 'Save Template'}
        </button>
        <button className="cp-btn-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Cycle Builder Tab ────────────────────────────────────────────────────────
function BuilderTab({ rep, psScores, dayRuns, weekTemplates, onRunsChange, onTemplatesChange }) {
  const [showNewRun, setShowNewRun]   = useState(false)
  const [editRun, setEditRun]         = useState(null)  // run object being edited
  const [showNewTpl, setShowNewTpl]   = useState(false)
  const [editTpl, setEditTpl]         = useState(null)

  // ── Day Runs CRUD ──────────────────────────────────────────────────────────
  async function saveRun(form) {
    const payload = {
      rep_name: rep,
      run_name: form.run_name.trim(),
      is_regional: form.is_regional,
      colour: form.colour,
      store_ids: (form.store_ids || []).filter(Boolean),
      updated_at: new Date().toISOString(),
    }
    if (form.id) {
      await supabase.from('cycle_day_runs').update(payload).eq('id', form.id)
    } else {
      await supabase.from('cycle_day_runs').insert({ ...payload, created_at: new Date().toISOString() })
    }
    const { data } = await supabase.from('cycle_day_runs').select('*').eq('rep_name', rep).order('run_name')
    onRunsChange(data || [])
    setShowNewRun(false)
    setEditRun(null)
  }

  async function deleteRun(run) {
    if (!window.confirm(`Delete "${run.run_name}"? This cannot be undone.`)) return
    await supabase.from('cycle_day_runs').delete().eq('id', run.id)
    onRunsChange(dayRuns.filter(r => r.id !== run.id))
  }

  // ── Week Templates CRUD ───────────────────────────────────────────────────
  async function saveTemplate(form) {
    const payload = {
      rep_name: rep,
      template_name: form.template_name.trim(),
      mon_run_id: form.mon_run_id || null,
      tue_run_id: form.tue_run_id || null,
      wed_run_id: form.wed_run_id || null,
      thu_run_id: form.thu_run_id || null,
      fri_run_id: form.fri_run_id || null,
      updated_at: new Date().toISOString(),
    }
    if (form.id) {
      await supabase.from('cycle_week_templates').update(payload).eq('id', form.id)
    } else {
      await supabase.from('cycle_week_templates').insert({ ...payload, created_at: new Date().toISOString() })
    }
    const { data } = await supabase.from('cycle_week_templates').select('*').eq('rep_name', rep).order('template_name')
    onTemplatesChange(data || [])
    setShowNewTpl(false)
    setEditTpl(null)
  }

  async function deleteTemplate(tpl) {
    if (!window.confirm(`Delete "${tpl.template_name}"? This cannot be undone.`)) return
    await supabase.from('cycle_week_templates').delete().eq('id', tpl.id)
    onTemplatesChange(weekTemplates.filter(t => t.id !== tpl.id))
  }

  function runForDay(tpl, key) {
    const id = tpl[`${key}_run_id`]
    return id ? dayRuns.find(r => r.id === id) : null
  }

  return (
    <div className="cp-builder">

      {/* ── Day Runs ── */}
      <div className="cp-builder-section">
        <div className="cp-builder-section-hd">
          <h2 className="cp-builder-h2">Day Runs</h2>
          {!showNewRun && <button className="cp-btn-new" onClick={() => { setShowNewRun(true); setEditRun(null) }}>+ New Run</button>}
        </div>
        <p className="cp-builder-hint">Build named store runs that can be applied to any day in the planner.</p>

        {showNewRun && (
          <RunForm psScores={psScores} onSave={saveRun} onCancel={() => setShowNewRun(false)} />
        )}

        {dayRuns.length === 0 && !showNewRun && (
          <div className="cp-builder-empty">No runs yet — create your first run above.</div>
        )}

        <div className="cp-run-list">
          {dayRuns.map(run => (
            editRun?.id === run.id ? (
              <RunForm key={run.id} initial={editRun} psScores={psScores}
                onSave={saveRun} onCancel={() => setEditRun(null)} />
            ) : (
              <div key={run.id} className={`cp-run-card ${run.is_regional ? 'cp-run-card-regional' : ''}`}
                style={{ borderLeftColor: run.colour }}>
                <div className="cp-run-card-hd">
                  <span className="cp-run-card-dot" style={{ background: run.colour }} />
                  <span className="cp-run-card-name">{run.run_name}</span>
                  {run.is_regional && <span className="cp-regional-tag">📍 Regional</span>}
                  <span className="cp-run-card-count">{(run.store_ids || []).length} store{(run.store_ids || []).length !== 1 ? 's' : ''}</span>
                  <div className="cp-run-card-actions">
                    <button className="cp-btn-edit" onClick={() => { setEditRun(run); setShowNewRun(false) }}>Edit</button>
                    <button className="cp-btn-delete" onClick={() => deleteRun(run)}>Delete</button>
                  </div>
                </div>
                {(run.store_ids || []).length > 0 && (
                  <div className="cp-run-card-stores">
                    {(run.store_ids || []).map((sid, i) => {
                      const s = STORES.find(x => x.id === sid)
                      return s ? (
                        <span key={i} className="cp-run-store-chip">{i + 1}. {s.name}</span>
                      ) : null
                    })}
                  </div>
                )}
              </div>
            )
          ))}
        </div>
      </div>

      {/* ── Week Templates ── */}
      <div className="cp-builder-section">
        <div className="cp-builder-section-hd">
          <h2 className="cp-builder-h2">Week Templates</h2>
          {!showNewTpl && dayRuns.length > 0 && (
            <button className="cp-btn-new" onClick={() => { setShowNewTpl(true); setEditTpl(null) }}>+ New Template</button>
          )}
        </div>
        <p className="cp-builder-hint">Build full Mon–Fri week templates from your saved runs.</p>

        {dayRuns.length === 0 && (
          <div className="cp-builder-empty">Create at least one day run above before building week templates.</div>
        )}

        {showNewTpl && (
          <TemplateForm dayRuns={dayRuns} onSave={saveTemplate} onCancel={() => setShowNewTpl(false)} />
        )}

        {weekTemplates.length === 0 && !showNewTpl && dayRuns.length > 0 && (
          <div className="cp-builder-empty">No templates yet — create your first week template above.</div>
        )}

        <div className="cp-run-list">
          {weekTemplates.map(tpl => (
            editTpl?.id === tpl.id ? (
              <TemplateForm key={tpl.id} initial={editTpl} dayRuns={dayRuns}
                onSave={saveTemplate} onCancel={() => setEditTpl(null)} />
            ) : (
              <div key={tpl.id} className="cp-tpl-card">
                <div className="cp-run-card-hd">
                  <span className="cp-tpl-card-name">{tpl.template_name}</span>
                  <div className="cp-run-card-actions">
                    <button className="cp-btn-edit" onClick={() => { setEditTpl(tpl); setShowNewTpl(false) }}>Edit</button>
                    <button className="cp-btn-delete" onClick={() => deleteTemplate(tpl)}>Delete</button>
                  </div>
                </div>
                <div className="cp-tpl-card-days">
                  {DAY_KEYS.map((key, i) => {
                    const r = runForDay(tpl, key)
                    return (
                      <div key={key} className="cp-tpl-card-day">
                        <span className="cp-tpl-card-day-lbl">{DAY_SHORT[i]}</span>
                        {r ? (
                          <span className="cp-tpl-card-run" style={{ borderColor: r.colour, background: r.colour + '18' }}>
                            <span className="cp-run-card-dot" style={{ background: r.colour }} />
                            {r.run_name}
                          </span>
                        ) : (
                          <span className="cp-tpl-card-none">—</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Perfect Cycle Tab ────────────────────────────────────────────────────────
function PerfectCycleTab({ rep, cycle, slots, psScores, weeks, leaveDates, repStoreData }) {
  const [locFilter, setLocFilter] = useState('all')

  // Visit count per store from current planner slots
  const visitCountMap = useMemo(() => {
    const map = {}
    Object.values(slots).forEach(sid => { if (sid) map[sid] = (map[sid] || 0) + 1 })
    return map
  }, [slots])

  // Working days in this cycle (excluding leave)
  const workingDays = useMemo(
    () => weeks.flat().filter(d => !leaveDates.has(toDS(d))).length,
    [weeks, leaveDates]
  )

  // Total visits scheduled
  const totalVisits = useMemo(
    () => Object.values(visitCountMap).reduce((a, b) => a + b, 0),
    [visitCountMap]
  )

  // Strategy breakdown — visits + targets for rep's stores
  const stratData = useMemo(() => {
    const groups = {}
    repStoreData.forEach(s => {
      const key = (s.strategy_c4 || 'OTHER').toUpperCase()
      if (!groups[key]) groups[key] = { visits: 0, target: 0 }
      groups[key].target += parseFQY(s.call_fqy_target)
    })
    repStoreData.forEach(s => {
      const count = visitCountMap[s.id] || 0
      if (!count) return
      const key = (s.strategy_c4 || 'OTHER').toUpperCase()
      if (!groups[key]) groups[key] = { visits: 0, target: 0 }
      groups[key].visits += count
    })
    return groups
  }, [repStoreData, visitCountMap])

  // Stores on track
  const { onTrack, needsVisit } = useMemo(() => {
    let on = 0, need = 0
    repStoreData.forEach(s => {
      const v = visitCountMap[s.id] || 0
      v >= parseFQY(s.call_fqy_target) ? on++ : need++
    })
    return { onTrack: on, needsVisit: need }
  }, [repStoreData, visitCountMap])

  // Filtered + sorted store list
  const filteredStores = useMemo(() => {
    let list = repStoreData
    if (locFilter !== 'all') {
      list = list.filter(s => {
        const lt = (s.location_type || '').toLowerCase()
        // 'Regional' matches 'Regional' and 'Regional - Day'
        if (locFilter === 'Regional') return lt === 'regional' || lt === 'regional - day'
        return lt === locFilter.toLowerCase()
      })
    }
    return [...list].sort((a, b) => {
      const va = visitCountMap[a.id] || 0, ta = parseFQY(a.call_fqy_target)
      const vb = visitCountMap[b.id] || 0, tb = parseFQY(b.call_fqy_target)
      const aOk = va >= ta, bOk = vb >= tb
      if (aOk !== bOk) return aOk ? 1 : -1
      return (a.store_name || '').localeCompare(b.store_name || '')
    })
  }, [repStoreData, locFilter, visitCountMap])

  const avgPerDay  = workingDays > 0 ? (totalVisits / workingDays).toFixed(1) : '0.0'
  const avgPerWeek = (totalVisits / 12).toFixed(1)

  return (
    <div className="cp-pc-wrap">
      <div className="cp-pc-grid">

        {/* ── LEFT: Cycle Summary ── */}
        <div className="cp-pc-left">

          {/* Total visits */}
          <div className="cp-pc-card">
            <div className="cp-pc-card-title">Perfect Store Visits</div>
            <div className="cp-pc-big-stat">{totalVisits}</div>
            <div className="cp-pc-big-label">Total visits planned — Cycle {cycle}</div>
            <div className="cp-pc-divider" />
            <div className="cp-pc-mini-row">
              <span>Stores visited</span>
              <strong>{repStoreData.filter(s => visitCountMap[s.id] > 0).length}</strong>
            </div>
            <div className="cp-pc-mini-row">
              <span>On track</span>
              <strong className="cp-pc-green">↓ {onTrack}</strong>
            </div>
            <div className="cp-pc-mini-row">
              <span>Needs visits</span>
              <strong className={needsVisit > 0 ? 'cp-pc-red' : 'cp-pc-green'}>
                {needsVisit > 0 ? `↑ ${needsVisit}` : `↓ 0`}
              </strong>
            </div>
          </div>

          {/* Strategy breakdown */}
          <div className="cp-pc-card">
            <div className="cp-pc-card-title">By Strategy</div>
            {['GROW', 'DEVELOP', 'EXPAND'].map(strat => {
              const g = stratData[strat] || { visits: 0, target: 0, stores: 0 }
              const diff = g.visits - g.target
              const onTgt = diff >= 0
              const meta = STRATEGY_META[strat]
              return (
                <div key={strat} className="cp-pc-strat-row">
                  <span className="cp-pc-strat-badge"
                    style={{ background: meta.bg, color: meta.colour, border: `1px solid ${meta.colour}` }}>
                    {meta.label}
                  </span>
                  <span className="cp-pc-strat-vals">
                    <span className="cp-pc-strat-count">{g.visits}</span>
                    <span className="cp-pc-strat-sep">/ {g.target}</span>
                  </span>
                  <span className={`cp-pc-arrow ${onTgt ? 'green' : 'red'}`}>
                    {onTgt ? '↓' : '↑'} {Math.abs(diff)}
                  </span>
                </div>
              )
            })}
            <p className="cp-pc-hint">Visits vs FQY targets for {rep.split(' ')[0]}'s {(REP_STATES[rep] || []).join('/')} stores ({repStoreData.length} total)</p>
          </div>

          {/* Call rate */}
          <div className="cp-pc-card">
            <div className="cp-pc-card-title">Call Rate Summary</div>
            <div className="cp-pc-rate-grid">
              <div className="cp-pc-rate-item">
                <div className="cp-pc-rate-val">{totalVisits}</div>
                <div className="cp-pc-rate-lbl">Total calls</div>
              </div>
              <div className="cp-pc-rate-item">
                <div className="cp-pc-rate-val">{avgPerDay}</div>
                <div className="cp-pc-rate-lbl">Avg per day</div>
              </div>
              <div className="cp-pc-rate-item">
                <div className="cp-pc-rate-val">{avgPerWeek}</div>
                <div className="cp-pc-rate-lbl">Avg per week</div>
              </div>
              <div className="cp-pc-rate-item">
                <div className="cp-pc-rate-val">{workingDays}</div>
                <div className="cp-pc-rate-lbl">Working days</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Store List ── */}
        <div className="cp-pc-right">
          <div className="cp-pc-filter-bar">
            {[['all','All'],['Metro','Metro'],['Regional','Regional'],['Major Regional','Major Regional'],['Remote','Remote']].map(([v, l]) => (
              <button key={v}
                className={`cp-pc-filter-btn ${locFilter === v ? 'active' : ''}`}
                onClick={() => setLocFilter(v)}>{l}</button>
            ))}
            <span className="cp-pc-count">{filteredStores.length} stores</span>
          </div>

          <div className="cp-pc-store-table">
            <div className="cp-pc-table-hd">
              <span style={{ flex: 1 }}>Store</span>
              <span className="cp-pc-col-sm">PS</span>
              <span className="cp-pc-col-sm">Visits</span>
              <span className="cp-pc-col-sm">FQY</span>
              <span className="cp-pc-col-rec">Status</span>
            </div>
            <div className="cp-pc-table-body">
              {filteredStores.length === 0 && (
                <div className="cp-pc-empty">No stores for this filter.</div>
              )}
              {filteredStores.map(s => {
                const visits   = visitCountMap[s.id] || 0
                const target   = parseFQY(s.call_fqy_target)
                const onTgt    = visits >= target
                const priority = psPriority(s.total_ranging)
                const diff     = visits - target
                const rec      = visits === 0 ? 'Add Visit'
                               : diff > 0     ? 'Reduce'
                               : onTgt        ? 'On Track'
                               :                'Add Visit'
                return (
                  <div key={s.id} className={`cp-pc-store-row ${visits === 0 ? 'zero' : onTgt ? 'ok' : 'warn'}`}>
                    <div className="cp-pc-sname-wrap">
                      <span className="cp-pc-sname">{s.store_name || s.id}</span>
                      <span className="cp-pc-sstate">{s.state}</span>
                    </div>
                    <span className="cp-pc-col-sm">
                      <span className={`cp-dot ${priority || 'grey'}`} />
                    </span>
                    <span className="cp-pc-col-sm cp-pc-visits">{visits > 0 ? visits : '—'}</span>
                    <span className="cp-pc-col-sm">
                      <span className={`cp-pc-fqy-badge ${onTgt ? 'green' : 'red'}`}>
                        {onTgt ? '↓' : '↑'} {target}
                      </span>
                    </span>
                    <span className="cp-pc-col-rec">
                      <span className={`cp-pc-rec cp-rec-${rec.toLowerCase().replace(/\s/g,'-')}`}>{rec}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Cycle View Tab ───────────────────────────────────────────────────────────
function fmtGsv(v) {
  if (v == null || v === '') return '–'
  const n = parseFloat(v)
  if (isNaN(n)) return '–'
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function CycleViewTab({ rep, cycle, slots, weeks, leaveDates, loading }) {
  const [expandedId, setExpandedId] = useState(null)

  // Single source of truth: fetch ALL needed fields from cycle=1
  // (strategy, ranging, gaps, GSV, status — everything in one query)
  const [psC1, setPsC1] = useState({})
  const [c1Loading, setC1Loading] = useState(true)

  useEffect(() => {
    setC1Loading(true)
    const cols = '*'
    async function fetchPs() {
      let all = [], from = 0
      while (true) {
        const { data, error } = await supabase.from('perfect_store')
          .select(cols)
          .eq('cycle', cycle)
          .range(from, from + 499)
        if (error || !data || data.length === 0) break
        all = [...all, ...data]
        if (data.length < 500) break
        from += 500
      }
      const map = {}
      all.forEach(r => { map[String(r.store_id)] = r })
      const psKeys = Object.keys(map).slice(0, 3)
      console.log('psC1 built:', all.length, 'rows. Sample keys:', psKeys, 'Sample entry:', map[psKeys[0]])
      setPsC1(map)
      setC1Loading(false)
    }
    fetchPs()
  }, [cycle])

  // Count unique planned stores for summary bar
  const totalPlanned = useMemo(() => {
    const all = new Set()
    weeks.forEach(week => {
      week.forEach(date => {
        const ds = toDS(date)
        Array.from({ length: 8 }, (_, i) => slots[`${ds}_${i}`]).filter(Boolean).forEach(id => all.add(id))
      })
    })
    return all.size
  }, [weeks, slots])

  // Get ordered store IDs for a given day (slot 0-7, skip nulls)
  function getDayStoreIds(dateStr) {
    return Array.from({ length: 8 }, (_, i) => slots[`${dateStr}_${i}`]).filter(Boolean)
  }

  function toggleExpand(uid) {
    setExpandedId(prev => prev === uid ? null : uid)
  }

  if (loading || c1Loading) {
    return <div className="cp-loading"><div className="cp-spinner" /><p>Loading cycle view…</p></div>
  }

  return (
    <div className="cv-wrap">
      {/* Summary bar */}
      <div className="cv-summary-bar">
        <span className="cv-summary-item">
          <strong>{totalPlanned}</strong> unique stores planned — Cycle {cycle}
        </span>
        <span className="cv-summary-item cv-rep-label">Rep: {rep}</span>
        <span className="cv-summary-item cv-ro-badge">Read-only view</span>
      </div>

      {/* Calendar — same week/day structure as Planner */}
      <div className="cp-calendar">
        {weeks.map((week, wi) => {
          return (
            <div key={wi} className="cp-week">
              {/* Week header — matches Planner exactly */}
              <div className="cp-week-hd">
                <span>Week {wi + 1}</span>
                <span className="cp-week-range">{fmtDay(week[0])} – {fmtDay(week[4])}</span>
              </div>

              {/* Day grid — 5 columns */}
              <div className="cp-week-grid">
                {week.map(date => {
                  const ds       = toDS(date)
                  const leaveInfo = leaveDates.get(ds) || null
                  const storeIds = getDayStoreIds(ds)

                  if (leaveInfo) {
                    const isPH = leaveInfo.type === 'Public Holiday'
                    return (
                      <div key={ds} className={`cp-day cp-day-leave${isPH ? ' cp-day-pubhol' : ''}`}>
                        <div className="cp-day-hd">
                          <span className="cp-day-lbl">{fmtDay(date)}</span>
                          <span className={`cp-leave-tag${isPH ? ' cp-leave-tag-ph' : ''}`}>
                            {isPH ? '🏛 Public Holiday' : '🏖 On Leave'}
                          </span>
                        </div>
                        {leaveInfo.name && <div className="cp-leave-name">{leaveInfo.name}</div>}
                      </div>
                    )
                  }

                  return (
                    <div key={ds} className="cp-day">
                      <div className="cp-day-hd">
                        <span className="cp-day-lbl">{fmtDay(date)}</span>
                        <span className="cv-day-count">
                          {storeIds.length > 0 ? `${storeIds.length} store${storeIds.length !== 1 ? 's' : ''}` : ''}
                        </span>
                      </div>

                      <div className="cv-ro-slots">
                        {storeIds.length === 0 && (
                          <p className="cv-empty">No stores</p>
                        )}
                        {storeIds.map((storeId, slotIdx) => {
                          if (slotIdx === 0) console.log('slot storeId:', storeId, 'psC1 hit:', !!psC1[storeId], 'psC1 sample key:', Object.keys(psC1)[0])
                          const s      = psC1[storeId] || {}
                          const name   = s.store_name || STORES.find(st => st.id === storeId)?.name || `Store ${storeId}`
                          const meta   = STRATEGY_META[s.strategy_c4] || {}
                          const colour = meta.colour || '#ccc'
                          const bg     = meta.bg     || '#f5f5f5'
                          const dotCls = psPriority(s.total_ranging)
                          // Use a uid combining storeId + dateStr so the same store on different days expands independently
                          const uid    = `${ds}_${storeId}`
                          const isOpen = expandedId === uid

                          const status    = s.focus_store_status || ''
                          const statusCls = status === 'On Track' ? 'cv-status-green'
                                          : status === 'At Risk'  ? 'cv-status-orange'
                                          : status === 'Behind'   ? 'cv-status-red' : ''
                          const gaps = [
                            { label: 'UHT Core',  val: s.uht_core_gap },
                            { label: 'Non-Core',  val: s.non_core_gap },
                            { label: 'Chilled',   val: s.chilled_gap },
                            { label: 'RTD',       val: s.rtd_gap },
                            { label: 'Yoghurt',   val: s.yoghurt_gap },
                            { label: 'Total Gap', val: s.total_ranging_gap },
                          ]

                          return (
                            <div key={uid}
                              className={`cv-store-card${isOpen ? ' expanded' : ''}`}
                              style={{ borderLeftColor: colour }}
                              onClick={() => toggleExpand(uid)}>

                              {/* Slot number + name row */}
                              <div className="cv-card-top">
                                <span className="cp-slot-n">{slotIdx + 1}</span>
                                <span className="cv-store-name" title={name}>{name}</span>
                                <span className="cv-expand-icon">{isOpen ? '▲' : '▼'}</span>
                              </div>

                              {/* Score + strategy row */}
                              <div className="cv-store-meta">
                                {dotCls && <span className={`cv-dot cv-dot-${dotCls}`} />}
                                <span className="cv-score">
                                  {s.total_ranging ?? '–'}<span className="cv-score-denom">/28</span>
                                </span>
                                {s.strategy_c4 && (
                                  <span className="cv-pill" style={{ background: bg, color: colour }}>
                                    {meta.label || s.strategy_c4}
                                  </span>
                                )}
                                {s.focus_store && <span className="cv-focus">★</span>}
                              </div>

                              {/* Expanded detail panel */}
                              {isOpen && (
                                <div className="cv-detail-panel" onClick={e => e.stopPropagation()}>

                                  <div className="cv-detail-row">
                                    {status && <span className={`cv-status-badge ${statusCls}`}>{status}</span>}
                                    {s.location_type && <span className="cv-loc-tag">{s.location_type}</span>}
                                  </div>

                                  <div className="cv-detail-section">
                                    <div className="cv-detail-label">Calls this cycle</div>
                                    <div className="cv-detail-value">
                                      {s.cycle_1_calls ?? '–'}
                                      <span className="cv-detail-muted"> / target: {s.call_fqy_target || '–'}</span>
                                    </div>
                                  </div>

                                  <div className="cv-detail-section">
                                    <div className="cv-detail-label">GSV Opportunity</div>
                                    <div className="cv-gsv-row">
                                      <div className="cv-gsv-item">
                                        <span className="cv-gsv-lbl">First Order</span>
                                        <span className="cv-gsv-val">{fmtGsv(s.first_order_gsv)}</span>
                                      </div>
                                      <div className="cv-gsv-item">
                                        <span className="cv-gsv-lbl">Total C1</span>
                                        <span className="cv-gsv-val">{fmtGsv(s.total_gsv_opportunity)}</span>
                                      </div>
                                      <div className="cv-gsv-item">
                                        <span className="cv-gsv-lbl">Annual</span>
                                        <span className="cv-gsv-val">{fmtGsv(s.annual_gsv_opportunity)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="cv-detail-section">
                                    <div className="cv-detail-label">Ranging Gaps (SKUs)</div>
                                    <div className="cv-gap-grid">
                                      {gaps.map(g => (
                                        <div key={g.label} className={`cv-gap-item${g.label === 'Total Gap' ? ' cv-gap-total' : ''}`}>
                                          <span className="cv-gap-lbl">{g.label}</span>
                                          <span className="cv-gap-val">{g.val ?? '–'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CyclePlanner() {
  const [cpSection, setCpSection]  = useState('planner')   // 'cycle-view' | 'planner'
  const [activeTab, setActiveTab] = useState('planner')
  const [cycle, setCycle]         = useState(1)
  const [rep, setRep]             = useState('Sam Gowen')

  // Shared data
  const [psScores,      setPsScores]      = useState({})
  const [dayRuns,       setDayRuns]       = useState([])
  const [weekTemplates, setWeekTemplates] = useState([])

  // Rep store data (used by Perfect Cycle tab + PDF export)
  const [repStoreData, setRepStoreData] = useState([])

  // Planner data
  const [leaveDates,   setLeaveDates]   = useState(new Map())
  const [slots,        setSlots]        = useState({})
  const [notes,        setNotes]        = useState({})
  const [homeBase,     setHomeBase]     = useState({ home_address: '', start_point: '', finish_point: '' })
  const [appliedRuns,  setAppliedRuns]  = useState({})  // dateStr → { run_id, run_name, colour, is_regional }
  const [saving,       setSaving]       = useState(false)
  const [hbSaving,     setHbSaving]     = useState(false)
  const [loading,      setLoading]      = useState(true)

  const weeks    = useMemo(() => getCycleDates(cycle), [cycle])
  const allDates = useMemo(() => weeks.flat(), [weeks])

  // Make main-content scrollable while mounted
  useEffect(() => {
    const mc = document.querySelector('.main-content')
    if (mc) mc.style.overflowY = 'auto'
    return () => { if (mc) mc.style.overflowY = '' }
  }, [])

  // Load PS scores once (enriched for Perfect Cycle tab)
  useEffect(() => {
    supabase.from('perfect_store')
      .select('store_id, store_name, state, total_ranging, strategy_c4, call_fqy_target, focus_store, location_type')
      .eq('cycle', 4)
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(r => { map[String(r.store_id)] = r })
        setPsScores(map)
      })
  }, [])

  // Load day runs when rep changes
  useEffect(() => {
    supabase.from('cycle_day_runs').select('*').eq('rep_name', rep).order('run_name')
      .then(({ data }) => setDayRuns(data || []))
  }, [rep])

  // Load week templates when rep changes
  useEffect(() => {
    supabase.from('cycle_week_templates').select('*').eq('rep_name', rep).order('template_name')
      .then(({ data }) => setWeekTemplates(data || []))
  }, [rep])

  // Load leave for rep
  useEffect(() => {
    if (!rep) return
    supabase.from('leave_entries').select('start_date, end_date, leave_type, notes').eq('rep_name', rep)
      .then(({ data }) => {
        const map = new Map()
        data?.forEach(row => {
          const start = new Date(row.start_date + 'T00:00:00')
          const end   = new Date((row.end_date || row.start_date) + 'T00:00:00')
          const name  = (row.notes || '').replace(/\s*\([A-Z]{2,3}\)$/, '').trim()
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1))
            map.set(toDS(d), { type: row.leave_type || 'Annual Leave', name })
        })
        setLeaveDates(map)
      })
  }, [rep])

  // Load this rep's stores from perfect_store (used by Perfect Cycle + PDF export)
  useEffect(() => {
    const repStates = REP_STATES[rep] || []
    if (!repStates.length) { setRepStoreData([]); return }
    supabase.from('perfect_store')
      .select('store_id, store_name, state, total_ranging, strategy_c4, call_fqy_target, location_type')
      .eq('cycle', 4)
      .in('state', repStates)
      .then(({ data }) => setRepStoreData((data || []).map(s => ({ ...s, id: String(s.store_id) }))))
  }, [rep])

  // Load planner data (slots, notes, homeBase, appliedRuns)
  useEffect(() => {
    async function load() {
      if (!rep || !allDates.length) return
      setLoading(true)
      const minDate = toDS(allDates[0])
      const maxDate = toDS(allDates[allDates.length - 1])
      const [slotRes, noteRes, homeRes, appliedRes] = await Promise.all([
        supabase.from('cycle_planner_slots').select('*').eq('rep_name', rep).eq('cycle', cycle).gte('day_date', minDate).lte('day_date', maxDate),
        supabase.from('cycle_planner_notes').select('*').eq('rep_name', rep).eq('cycle', cycle).gte('day_date', minDate).lte('day_date', maxDate),
        supabase.from('rep_home_base').select('*').eq('rep_name', rep).maybeSingle(),
        supabase.from('cycle_planner_applied_runs').select('*').eq('rep_name', rep).eq('cycle', cycle).gte('day_date', minDate).lte('day_date', maxDate),
      ])
      const sm = {}
      slotRes.data?.forEach(s => { sm[`${s.day_date}_${s.slot_num - 1}`] = String(s.store_id) })
      setSlots(sm)
      const nm = {}
      noteRes.data?.forEach(n => { nm[n.day_date] = n.notes })
      setNotes(nm)
      setHomeBase(homeRes.data || { home_address: '', start_point: '', finish_point: '' })
      const am = {}
      appliedRes.data?.forEach(r => { am[r.day_date] = { run_id: r.run_id, run_name: r.run_name, colour: r.colour } })
      setAppliedRuns(am)
      setLoading(false)
    }
    load()
  }, [rep, cycle, allDates])

  // Save individual slot
  const saveSlot = useCallback(async (dateStr, idx, storeId, store) => {
    setSlots(prev => {
      const next = { ...prev }
      if (storeId) next[`${dateStr}_${idx}`] = storeId
      else delete next[`${dateStr}_${idx}`]
      return next
    })
    setSaving(true)
    if (storeId) {
      await supabase.from('cycle_planner_slots').upsert({
        rep_name: rep, cycle, day_date: dateStr,
        slot_num: idx + 1, store_id: storeId,
        store_name: store?.name || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'rep_name,cycle,day_date,slot_num' })
    } else {
      await supabase.from('cycle_planner_slots').delete()
        .eq('rep_name', rep).eq('cycle', cycle).eq('day_date', dateStr).eq('slot_num', idx + 1)
    }
    setSaving(false)
  }, [rep, cycle])

  // Save notes (debounced)
  const noteTimers = useRef({})
  const saveNotes = useCallback((dateStr, value) => {
    setNotes(prev => ({ ...prev, [dateStr]: value }))
    clearTimeout(noteTimers.current[dateStr])
    noteTimers.current[dateStr] = setTimeout(() => {
      supabase.from('cycle_planner_notes').upsert({
        rep_name: rep, cycle, day_date: dateStr, notes: value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'rep_name,cycle,day_date' })
    }, 800)
  }, [rep, cycle])

  // Save home base (debounced)
  const hbTimer = useRef(null)
  function updateHB(field, value) {
    const updated = { ...homeBase, [field]: value }
    setHomeBase(updated)
    clearTimeout(hbTimer.current)
    hbTimer.current = setTimeout(async () => {
      setHbSaving(true)
      await supabase.from('rep_home_base').upsert(
        { rep_name: rep, ...updated, updated_at: new Date().toISOString() },
        { onConflict: 'rep_name' }
      )
      setHbSaving(false)
    }, 800)
  }

  // Apply a day run to a specific date
  const applyRunToDay = useCallback(async (dateStr, run) => {
    if (!run?.store_ids?.length) return
    setSaving(true)

    // Delete existing slots for this day
    await supabase.from('cycle_planner_slots').delete()
      .eq('rep_name', rep).eq('cycle', cycle).eq('day_date', dateStr)

    // Insert new slots
    const inserts = run.store_ids.slice(0, 8).map((sid, idx) => ({
      rep_name: rep, cycle, day_date: dateStr,
      slot_num: idx + 1, store_id: sid,
      store_name: STORES.find(s => s.id === sid)?.name || '',
      updated_at: new Date().toISOString(),
    }))
    await supabase.from('cycle_planner_slots').insert(inserts)

    // Save applied run record
    await supabase.from('cycle_planner_applied_runs').upsert({
      rep_name: rep, cycle, day_date: dateStr,
      run_id: run.id, run_name: run.run_name, colour: run.colour,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'rep_name,cycle,day_date' })

    // Update local state
    setSlots(prev => {
      const next = { ...prev }
      for (let i = 0; i < 8; i++) delete next[`${dateStr}_${i}`]
      run.store_ids.slice(0, 8).forEach((sid, idx) => { next[`${dateStr}_${idx}`] = sid })
      return next
    })
    setAppliedRuns(prev => ({ ...prev, [dateStr]: { run_id: run.id, run_name: run.run_name, colour: run.colour } }))
    setSaving(false)
  }, [rep, cycle])

  // Clear a day run from a date
  const clearDayRun = useCallback(async (dateStr) => {
    if (!window.confirm('Clear all stores for this day?')) return
    setSaving(true)
    await supabase.from('cycle_planner_slots').delete()
      .eq('rep_name', rep).eq('cycle', cycle).eq('day_date', dateStr)
    await supabase.from('cycle_planner_applied_runs').delete()
      .eq('rep_name', rep).eq('cycle', cycle).eq('day_date', dateStr)
    setSlots(prev => {
      const next = { ...prev }
      for (let i = 0; i < 8; i++) delete next[`${dateStr}_${i}`]
      return next
    })
    setAppliedRuns(prev => { const next = { ...prev }; delete next[dateStr]; return next })
    setSaving(false)
  }, [rep, cycle])

  // Apply a week template to a week
  const applyTemplateToWeek = useCallback(async (week, template) => {
    setSaving(true)
    for (let i = 0; i < 5; i++) {
      const runId = template[`${DAY_KEYS[i]}_run_id`]
      if (!runId) continue
      const run = dayRuns.find(r => r.id === runId)
      if (!run) continue
      const ds = toDS(week[i])
      if (leaveDates.has(ds)) continue
      await applyRunToDay(ds, run)
    }
    setSaving(false)
  }, [dayRuns, leaveDates, applyRunToDay])

  // Clear all stores for a week
  const clearWeek = useCallback(async (week) => {
    if (!window.confirm('Clear all stores for this entire week? This cannot be undone.')) return
    setSaving(true)
    const dates = week.map(toDS).filter(ds => !leaveDates.has(ds))
    for (const ds of dates) {
      await supabase.from('cycle_planner_slots').delete()
        .eq('rep_name', rep).eq('cycle', cycle).eq('day_date', ds)
      await supabase.from('cycle_planner_applied_runs').delete()
        .eq('rep_name', rep).eq('cycle', cycle).eq('day_date', ds)
    }
    setSlots(prev => {
      const next = { ...prev }
      dates.forEach(ds => { for (let i = 0; i < 8; i++) delete next[`${ds}_${i}`] })
      return next
    })
    setAppliedRuns(prev => {
      const next = { ...prev }
      dates.forEach(ds => delete next[ds])
      return next
    })
    setSaving(false)
  }, [rep, cycle, leaveDates])

  function getDaySlots(dateStr) {
    return Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i, slots[`${dateStr}_${i}`] || null]))
  }

  function weekHasStores(week) {
    return week.some(d => {
      const ds = toDS(d)
      return !leaveDates.has(ds) && Array.from({ length: 8 }, (_, i) => slots[`${ds}_${i}`]).some(Boolean)
    })
  }

  // ── Export PDF ──────────────────────────────────────────────────────────────
  function exportPDF() {
    const repSlug  = rep.replace(/\s+/g, '')
    const docTitle = `CyclePlan_${repSlug}_Cycle${cycle}`
    const priorityDot = sid => {
      const ps = psScores[sid]; if (!ps) return ''
      const colors = { red: '#CC0000', orange: '#e67e22', green: '#16a085' }
      return `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${colors[psPriority(ps.total_ranging)] || '#ccc'};margin-right:5px;"></span>`
    }
    const weeksHTML = weeks.map((week, wi) => {
      const daysHTML = week.map(date => {
        const ds      = toDS(date)
        const isLeave = leaveDates.has(ds)
        const dayNote = notes[ds] || ''
        if (isLeave) return `<td class="cp-pdf-day"><div class="cp-pdf-day-hd">${fmtDay(date)}</div><div class="cp-pdf-leave">🏖 On Leave</div></td>`
        const ar     = appliedRuns[ds]
        const filled = Array.from({ length: 8 }, (_, i) => slots[`${ds}_${i}`]).filter(Boolean)
        const storesHTML = filled.length
          ? filled.map((sid, idx) => {
              const name = STORES.find(s => s.id === sid)?.name || sid
              return `<div class="cp-pdf-store">${priorityDot(sid)}<span>${idx + 1}. ${name}</span></div>`
            }).join('')
          : `<div class="cp-pdf-empty">No stores planned</div>`
        return `<td class="cp-pdf-day">
          <div class="cp-pdf-day-hd">${fmtDay(date)}</div>
          ${ar ? `<div class="cp-pdf-run" style="border-left:3px solid ${ar.colour};padding-left:5px;margin-bottom:4px;font-size:10px;font-weight:700;color:${ar.colour}">${ar.run_name}</div>` : ''}
          <div class="cp-pdf-stores">${storesHTML}</div>
          ${dayNote ? `<div class="cp-pdf-notes">${dayNote}</div>` : ''}
        </td>`
      }).join('')
      return `<div class="cp-pdf-week"><div class="cp-pdf-week-hd">Week ${wi + 1} · ${fmtDay(week[0])} – ${fmtDay(week[4])}</div><table class="cp-pdf-table"><tbody><tr>${daysHTML}</tr></tbody></table></div>`
    }).join('')

    // ── Perfect Cycle stats for PDF ──────────────────────────────────────────
    const vcMap = {}
    Object.values(slots).forEach(sid => { if (sid) vcMap[sid] = (vcMap[sid] || 0) + 1 })
    const totalVis  = Object.values(vcMap).reduce((a, b) => a + b, 0)
    const wDays     = weeks.flat().filter(d => !leaveDates.has(toDS(d))).length
    const avgDay    = wDays > 0 ? (totalVis / wDays).toFixed(1) : '0.0'
    const avgWeek   = (totalVis / 12).toFixed(1)
    const storesVis = repStoreData.filter(s => vcMap[s.id] > 0).length
    let onTrackCt = 0, needsCt = 0
    repStoreData.forEach(s => { (vcMap[s.id] || 0) >= parseFQY(s.call_fqy_target) ? onTrackCt++ : needsCt++ })
    const stratGroups = {}
    repStoreData.forEach(s => {
      const k = (s.strategy_c4 || 'OTHER').toUpperCase()
      if (!stratGroups[k]) stratGroups[k] = { visits: 0, target: 0 }
      stratGroups[k].target += parseFQY(s.call_fqy_target)
      stratGroups[k].visits += vcMap[s.id] || 0
    })
    const stratHTML = ['GROW','DEVELOP','EXPAND'].map(k => {
      const g = stratGroups[k] || { visits: 0, target: 0 }
      const ok = g.visits >= g.target
      const colors = { GROW: '#16a085', DEVELOP: '#e67e22', EXPAND: '#CC0000' }
      return `<div class="pc-strat-row">
        <span class="pc-strat-badge" style="border-color:${colors[k]};color:${colors[k]}">${k}</span>
        <span class="pc-strat-nums">${g.visits} visits</span>
        <span class="pc-strat-target">/ ${g.target} target</span>
        <span class="pc-strat-arrow" style="color:${ok?'#16a085':'#CC0000'}">${ok?'↓ On track':'↑ Needs more'}</span>
      </div>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title><style>
    *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a}
    .cp-pdf-header{background:#CC0000;color:white;padding:20px 28px}.cp-pdf-header h1{font-size:20px;font-weight:800;margin-bottom:4px}.cp-pdf-header p{font-size:12px;opacity:.85}
    .cp-pdf-hb{padding:14px 28px;background:#f7f7f7;border-bottom:1px solid #e0e0e0;display:flex;gap:32px}
    .cp-pdf-hb-item label{font-size:9px;text-transform:uppercase;color:#888;letter-spacing:.06em;display:block}.cp-pdf-hb-item span{font-size:12px;font-weight:600}
    .pc-summary{padding:16px 28px;background:white;border-bottom:2px solid #e0e0e0;display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .pc-summary-col h3{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:10px;font-weight:700}
    .pc-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .pc-stat-box{background:#f9f9f9;border-radius:6px;padding:8px 10px;text-align:center}
    .pc-stat-box .num{font-size:20px;font-weight:800;color:#1a1a1a;display:block}
    .pc-stat-box .lbl{font-size:9px;text-transform:uppercase;color:#aaa;letter-spacing:.05em}
    .pc-mini-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:11px}
    .pc-mini-row:last-child{border-bottom:none}
    .pc-green{color:#16a085;font-weight:700}.pc-red{color:#CC0000;font-weight:700}
    .pc-strat-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f5f5f5;font-size:11px}
    .pc-strat-row:last-child{border-bottom:none}
    .pc-strat-badge{border:1.5px solid;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700}
    .pc-strat-nums{font-weight:700;min-width:60px}.pc-strat-target{color:#aaa;flex:1}.pc-strat-arrow{font-weight:600;font-size:10px}
    .cp-pdf-body{padding:20px 28px;display:flex;flex-direction:column;gap:18px}
    .cp-pdf-week{page-break-inside:avoid}.cp-pdf-week-hd{background:#CC0000;color:white;padding:6px 12px;font-size:11px;font-weight:700;border-radius:4px 4px 0 0}
    .cp-pdf-table{width:100%;border-collapse:collapse}.cp-pdf-day{width:20%;border:1px solid #e0e0e0;vertical-align:top;padding:8px}
    .cp-pdf-day-hd{font-weight:700;font-size:11px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #eee}
    .cp-pdf-stores{display:flex;flex-direction:column;gap:3px}.cp-pdf-store{display:flex;align-items:center;font-size:10.5px;line-height:1.3}
    .cp-pdf-empty{font-size:10px;color:#ccc;font-style:italic}.cp-pdf-notes{margin-top:6px;padding-top:5px;border-top:1px dashed #ddd;font-size:10px;color:#666;font-style:italic}
    .cp-pdf-leave{font-size:10.5px;color:#999;font-style:italic}
    .cp-pdf-legend{display:flex;gap:20px;padding:10px 28px;font-size:10px;color:#555;border-top:1px solid #eee}
    .cp-pdf-legend span{display:flex;align-items:center;gap:5px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.cp-pdf-week{page-break-inside:avoid}}
    </style></head><body>
    <div class="cp-pdf-header"><h1>${rep} — Cycle ${cycle} Plan</h1><p>${CYCLE_STARTS[cycle]} · 12 weeks · Mon–Fri</p></div>
    <div class="cp-pdf-hb">
      <div class="cp-pdf-hb-item"><label>Home Address</label><span>${homeBase.home_address || '—'}</span></div>
      <div class="cp-pdf-hb-item"><label>Day Start</label><span>${homeBase.start_point || '—'}</span></div>
      <div class="cp-pdf-hb-item"><label>Day Finish</label><span>${homeBase.finish_point || '—'}</span></div>
    </div>
    <div class="pc-summary">
      <div class="pc-summary-col">
        <h3>Perfect Cycle Summary</h3>
        <div class="pc-stat-grid">
          <div class="pc-stat-box"><span class="num">${totalVis}</span><span class="lbl">Total Visits</span></div>
          <div class="pc-stat-box"><span class="num">${storesVis}</span><span class="lbl">Stores Visited</span></div>
          <div class="pc-stat-box"><span class="num">${avgDay}</span><span class="lbl">Avg / Day</span></div>
          <div class="pc-stat-box"><span class="num">${avgWeek}</span><span class="lbl">Avg / Week</span></div>
        </div>
        <div style="margin-top:10px">
          <div class="pc-mini-row"><span>On track</span><span class="pc-green">↓ ${onTrackCt}</span></div>
          <div class="pc-mini-row"><span>Needs more visits</span><span class="${needsCt>0?'pc-red':'pc-green'}">${needsCt>0?'↑':'↓'} ${needsCt}</span></div>
          <div class="pc-mini-row"><span>Working days</span><span><strong>${wDays}</strong></span></div>
        </div>
      </div>
      <div class="pc-summary-col">
        <h3>By Strategy</h3>
        ${stratHTML}
      </div>
    </div>
    <div class="cp-pdf-body">${weeksHTML}</div>
    <div class="cp-pdf-legend">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#CC0000"></span> Needs attention (&lt;12/28)</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#e67e22"></span> Getting close (12–19/28)</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a085"></span> On track (20+/28)</span>
    </div>
    </body></html>`
    const win = window.open('', '_blank')
    win.document.write(html); win.document.close(); win.document.title = docTitle
    setTimeout(() => { win.focus(); win.print() }, 400)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="cp-page">

      {/* Page header */}
      <div className="cp-header">
        <div className="cp-header-row">
          <h1 className="cp-title">Cycle Planner</h1>
          <div className="cp-header-actions">
            {saving && <span className="cp-autosave">● Saving…</span>}
            <button className="cp-export-btn" onClick={exportPDF} disabled={loading}>⬇ Export PDF</button>
          </div>
        </div>
        <div className="cp-selectors">
          <div className="cp-field">
            <label className="cp-field-lbl">Cycle</label>
            <select className="cp-sel" value={cycle} onChange={e => setCycle(+e.target.value)}>
              {[1,2,3].map(c => <option key={c} value={c}>Cycle {c} — {CYCLE_STARTS[c]}</option>)}
            </select>
          </div>
          <div className="cp-field">
            <label className="cp-field-lbl">Rep</label>
            <select className="cp-sel" value={rep} onChange={e => setRep(e.target.value)}>
              {REPS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Outer section sub-nav ── */}
      <div className="cp-tab-bar cp-section-bar">
        {[['cycle-view','Cycle View'],['planner','Planner']].map(([id, label]) => (
          <button key={id} className={`cp-tab ${cpSection === id ? 'active' : ''}`}
            onClick={() => setCpSection(id)}>{label}</button>
        ))}
      </div>

      {/* ── Cycle View ── */}
      {cpSection === 'cycle-view' && (
        <CycleViewTab rep={rep} cycle={cycle} slots={slots} weeks={weeks} leaveDates={leaveDates} loading={loading} />
      )}

      {/* ── Planner section ── */}
      {cpSection === 'planner' && (<>

      {/* Inner tab bar */}
      <div className="cp-tab-bar">
        {[['planner','Cycle Planner'],['builder','Cycle Builder'],['perfect','Perfect Cycle']].map(([id, label]) => (
          <button key={id} className={`cp-tab ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── Planner Tab ── */}
      {activeTab === 'planner' && (
        <>
          {/* Home Base */}
          <div className="cp-homebase">
            <div className="cp-hb-title">
              🏠 Home Base — <strong>{rep}</strong>
              {hbSaving && <span className="cp-autosave">● Saving…</span>}
            </div>
            <div className="cp-hb-grid">
              {[
                ['home_address','Home Address','e.g. 12 Smith St, Adelaide SA 5000'],
                ['start_point','Day Start Point','Where you begin each day'],
                ['finish_point','Day Finish Point','Where you end each day'],
              ].map(([field, lbl, ph]) => (
                <div key={field} className="cp-hb-field">
                  <label className="cp-field-lbl">{lbl}</label>
                  <input className="cp-hb-input" type="text" placeholder={ph}
                    value={homeBase[field] || ''} onChange={e => updateHB(field, e.target.value)} />
                </div>
              ))}
            </div>
            <p className="cp-hb-note">💡 Start and finish points are used for the 🗺 Route button on each day.</p>
          </div>

          {/* Legend */}
          <div className="cp-legend">
            <span><span className="cp-dot red" /> Needs attention (&lt;12/28)</span>
            <span><span className="cp-dot orange" /> Getting close (12–19/28)</span>
            <span><span className="cp-dot green" /> On track (20+/28)</span>
            <span className="cp-legend-note">Score = Perfect Store ranging out of 28 SKUs</span>
          </div>

          {/* Calendar */}
          {loading ? (
            <div className="cp-loading"><div className="cp-spinner" /><p>Loading planner…</p></div>
          ) : (
            <div className="cp-calendar">
              {weeks.map((week, wi) => {
                const hasStores = weekHasStores(week)
                const weekStart = toDS(week[0])
                return (
                  <div key={wi} className="cp-week">
                    <div className="cp-week-hd">
                      <span>Week {wi + 1}</span>
                      <span className="cp-week-range">{fmtDay(week[0])} – {fmtDay(week[4])}</span>

                      {/* Week template picker */}
                      {weekTemplates.length > 0 && (
                        <select className="cp-week-tpl-sel" defaultValue=""
                          key={weekStart}
                          onChange={e => {
                            const tpl = weekTemplates.find(t => String(t.id) === e.target.value)
                            if (tpl) applyTemplateToWeek(week, tpl)
                            e.target.value = ''
                          }}>
                          <option value="">Apply template…</option>
                          {weekTemplates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
                        </select>
                      )}

                      {/* Clear week button */}
                      {hasStores && (
                        <button className="cp-week-clear" onClick={() => clearWeek(week)}>Clear week ✕</button>
                      )}
                    </div>
                    <div className="cp-week-grid">
                      {week.map(date => {
                        const ds = toDS(date)
                        return (
                          <DayCard key={ds} date={date} psScores={psScores}
                            daySlots={getDaySlots(ds)} dayNotes={notes[ds] || ''}
                            leaveInfo={leaveDates.get(ds) || null} homeBase={homeBase}
                            dayRuns={dayRuns}
                            appliedRun={appliedRuns[ds] || null}
                            onSlotChange={saveSlot} onNotesChange={saveNotes}
                            onApplyRun={run => applyRunToDay(ds, run)}
                            onClearRun={() => clearDayRun(ds)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Builder Tab ── */}
      {activeTab === 'builder' && (
        <BuilderTab rep={rep} psScores={psScores}
          dayRuns={dayRuns} weekTemplates={weekTemplates}
          onRunsChange={setDayRuns} onTemplatesChange={setWeekTemplates} />
      )}

      {/* ── Perfect Cycle Tab ── */}
      {activeTab === 'perfect' && (
        <PerfectCycleTab
          rep={rep} cycle={cycle} slots={slots}
          psScores={psScores} weeks={weeks} leaveDates={leaveDates}
          repStoreData={repStoreData}
        />
      )}

      </>)} {/* end cpSection === 'planner' */}
    </div>
  )
}
