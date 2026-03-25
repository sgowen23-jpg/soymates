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

// Cycle start Mondays
const CYCLE_STARTS = {
  1: '2026-03-30',
  2: '2026-06-22',
  3: '2026-09-14',
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri']

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
  const [q, setQ] = useState('')
  const wrapRef = useRef(null)
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
          (s.state || '').toLowerCase().includes(lq) ||
          (s.chain || '').toLowerCase().includes(lq)
        )
      : STORES
    return list.slice(0, 60)
  }, [q])

  const ps = value ? psScores[value] : null
  const priority = ps ? psPriority(ps.total_ranging) : null

  function openPicker() {
    setOpen(true)
    setQ('')
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  function pick(store) {
    onChange(store?.id || null, store)
    setOpen(false)
    setQ('')
  }

  return (
    <div className="cp-ss-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`cp-ss-btn ${priority || ''}`}
        onClick={open ? () => setOpen(false) : openPicker}
      >
        {priority && <span className={`cp-dot ${priority}`} />}
        <span className="cp-ss-name">
          {selected ? selected.name : <span className="cp-ss-ph">+ Add store</span>}
        </span>
        {ps && <span className="cp-ss-score">{ps.total_ranging ?? '?'}/28</span>}
        {value && (
          <span className="cp-ss-x" onClick={e => { e.stopPropagation(); pick(null) }}>✕</span>
        )}
      </button>

      {open && (
        <div className="cp-ss-drop">
          <input
            ref={inputRef}
            className="cp-ss-search"
            placeholder="Search by name, suburb, state…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onClick={e => e.stopPropagation()}
          />
          <div className="cp-ss-list">
            {filtered.length === 0 && <div className="cp-ss-empty">No stores found</div>}
            {filtered.map(s => {
              const sps = psScores[s.id]
              const spri = sps ? psPriority(sps.total_ranging) : null
              return (
                <div
                  key={s.id}
                  className={`cp-ss-opt ${s.id === value ? 'active' : ''}`}
                  onClick={() => pick(s)}
                >
                  {spri && <span className={`cp-dot ${spri}`} />}
                  <span className="cp-ss-opt-name">{s.name}</span>
                  <span className="cp-ss-opt-sub">{s.suburb || s.state}</span>
                  {sps && (
                    <span className={`cp-ss-opt-score ${spri || ''}`}>
                      {sps.total_ranging ?? '?'}/28
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Day Card ─────────────────────────────────────────────────────────────────
function DayCard({ date, psScores, daySlots, dayNotes, isLeave, homeBase, onSlotChange, onNotesChange }) {
  const ds = toDS(date)

  function handleRoute() {
    const storeIds = Array.from({ length: 8 }, (_, i) => daySlots[i]).filter(Boolean)
    if (!storeIds.length) { alert('No stores added for this day yet.'); return }

    const storeObjs = storeIds.map(id => STORES.find(s => s.id === id)).filter(Boolean)
    const waypoints = storeObjs.map(s => encodeURIComponent(s.address || `${s.name}, ${s.state}`))

    const origin = encodeURIComponent(homeBase?.start_point || homeBase?.home_address || '')
    const dest   = encodeURIComponent(homeBase?.finish_point || homeBase?.home_address || '')

    let url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving'
    if (origin) url += `&origin=${origin}`

    if (waypoints.length === 1) {
      url += `&destination=${dest || waypoints[0]}`
    } else {
      url += `&destination=${dest || waypoints[waypoints.length - 1]}`
      const wps = dest ? waypoints : waypoints.slice(0, -1)
      if (wps.length) url += `&waypoints=${wps.join('|')}`
    }

    window.open(url, '_blank')
  }

  if (isLeave) {
    return (
      <div className="cp-day cp-day-leave">
        <div className="cp-day-hd">
          <span className="cp-day-lbl">{fmtDay(date)}</span>
          <span className="cp-leave-tag">🏖 On Leave</span>
        </div>
      </div>
    )
  }

  return (
    <div className="cp-day">
      <div className="cp-day-hd">
        <span className="cp-day-lbl">{fmtDay(date)}</span>
        <button className="cp-route-btn" onClick={handleRoute} type="button">🗺 Route</button>
      </div>

      <div className="cp-slots">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="cp-slot">
            <span className="cp-slot-n">{i + 1}</span>
            <StoreSelect
              psScores={psScores}
              value={daySlots[i] || null}
              onChange={(id, store) => onSlotChange(ds, i, id, store)}
            />
          </div>
        ))}
      </div>

      <textarea
        className="cp-notes"
        placeholder="Notes for the day…"
        value={dayNotes || ''}
        onChange={e => onNotesChange(ds, e.target.value)}
        rows={2}
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CyclePlanner() {
  const [cycle, setCycle]       = useState(2)
  const [rep, setRep]           = useState('Sam Gowen')
  const [psScores, setPsScores] = useState({})
  const [leaveDates, setLeaveDates] = useState(new Set())
  const [slots, setSlots]       = useState({})   // key: "YYYY-MM-DD_i" → store_id
  const [notes, setNotes]       = useState({})   // key: "YYYY-MM-DD" → text
  const [homeBase, setHomeBase] = useState({ home_address: '', start_point: '', finish_point: '' })
  const [saving, setSaving]     = useState(false)
  const [hbSaving, setHbSaving] = useState(false)
  const [loading, setLoading]   = useState(true)

  const weeks    = useMemo(() => getCycleDates(cycle), [cycle])
  const allDates = useMemo(() => weeks.flat(), [weeks])

  // Make main-content scrollable while mounted
  useEffect(() => {
    const mc = document.querySelector('.main-content')
    if (mc) mc.style.overflowY = 'auto'
    return () => { if (mc) mc.style.overflowY = '' }
  }, [])

  // Load PS scores (cycle 4 = latest) — once
  useEffect(() => {
    supabase
      .from('perfect_store')
      .select('store_id, total_ranging, strategy_c4')
      .eq('cycle', 4)
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(r => { map[String(r.store_id)] = r })
        setPsScores(map)
      })
  }, [])

  // Load leave for rep
  useEffect(() => {
    if (!rep) return
    supabase
      .from('leave_entries')
      .select('start_date, end_date')
      .eq('rep_name', rep)
      .then(({ data }) => {
        const set = new Set()
        data?.forEach(row => {
          const start = new Date(row.start_date + 'T00:00:00')
          const end   = new Date((row.end_date || row.start_date) + 'T00:00:00')
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            set.add(toDS(d))
          }
        })
        setLeaveDates(set)
      })
  }, [rep])

  // Load planner data
  useEffect(() => {
    async function load() {
      if (!rep || !allDates.length) return
      setLoading(true)
      const minDate = toDS(allDates[0])
      const maxDate = toDS(allDates[allDates.length - 1])

      const [slotRes, noteRes, homeRes] = await Promise.all([
        supabase.from('cycle_planner_slots')
          .select('*').eq('rep_name', rep).eq('cycle', cycle)
          .gte('day_date', minDate).lte('day_date', maxDate),
        supabase.from('cycle_planner_notes')
          .select('*').eq('rep_name', rep).eq('cycle', cycle)
          .gte('day_date', minDate).lte('day_date', maxDate),
        supabase.from('rep_home_base')
          .select('*').eq('rep_name', rep).maybeSingle(),
      ])

      const sm = {}
      slotRes.data?.forEach(s => { sm[`${s.day_date}_${s.slot_num - 1}`] = String(s.store_id) })
      setSlots(sm)

      const nm = {}
      noteRes.data?.forEach(n => { nm[n.day_date] = n.notes })
      setNotes(nm)

      setHomeBase(homeRes.data || { home_address: '', start_point: '', finish_point: '' })
      setLoading(false)
    }
    load()
  }, [rep, cycle, allDates])

  // Save slot
  const saveSlot = useCallback(async (dateStr, idx, storeId, store) => {
    const key = `${dateStr}_${idx}`
    setSlots(prev => {
      const next = { ...prev }
      if (storeId) next[key] = storeId
      else delete next[key]
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
      await supabase.from('cycle_planner_slots')
        .delete()
        .eq('rep_name', rep).eq('cycle', cycle)
        .eq('day_date', dateStr).eq('slot_num', idx + 1)
    }
    setSaving(false)
  }, [rep, cycle])

  // Save notes (debounced 800ms)
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

  // Save home base (debounced 800ms)
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

  function getDaySlots(dateStr) {
    return Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [i, slots[`${dateStr}_${i}`] || null])
    )
  }

  // Count filled slots for a week
  function weekFilled(week) {
    return week.reduce((acc, d) => {
      const ds = toDS(d)
      if (leaveDates.has(ds)) return acc
      for (let i = 0; i < 8; i++) if (slots[`${ds}_${i}`]) acc++
      return acc
    }, 0)
  }

  return (
    <div className="cp-page">

      {/* ── Page Header ── */}
      <div className="cp-header">
        <div className="cp-header-row">
          <h1 className="cp-title">Cycle Planner</h1>
          {saving && <span className="cp-autosave">● Saving…</span>}
        </div>
        <div className="cp-selectors">
          <div className="cp-field">
            <label className="cp-field-lbl">Cycle</label>
            <select className="cp-sel" value={cycle} onChange={e => setCycle(+e.target.value)}>
              {[1, 2, 3].map(c => (
                <option key={c} value={c}>
                  Cycle {c} — {CYCLE_STARTS[c]}
                </option>
              ))}
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

      {/* ── Home Base ── */}
      <div className="cp-homebase">
        <div className="cp-hb-title">
          🏠 Home Base — <strong>{rep}</strong>
          {hbSaving && <span className="cp-autosave">● Saving…</span>}
        </div>
        <div className="cp-hb-grid">
          {[
            ['home_address', 'Home Address',     'e.g. 12 Smith St, Adelaide SA 5000'],
            ['start_point',  'Day Start Point',  'Where you begin each day'],
            ['finish_point', 'Day Finish Point', 'Where you end each day'],
          ].map(([field, lbl, ph]) => (
            <div key={field} className="cp-hb-field">
              <label className="cp-field-lbl">{lbl}</label>
              <input
                className="cp-hb-input"
                type="text"
                placeholder={ph}
                value={homeBase[field] || ''}
                onChange={e => updateHB(field, e.target.value)}
              />
            </div>
          ))}
        </div>
        <p className="cp-hb-note">
          💡 Start and finish points are used for the 🗺 Route button on each day — opens Google Maps with your stores in order.
        </p>
      </div>

      {/* ── Legend ── */}
      <div className="cp-legend">
        <span><span className="cp-dot red" /> Needs attention (&lt;12/28)</span>
        <span><span className="cp-dot orange" /> Getting close (12–19/28)</span>
        <span><span className="cp-dot green" /> On track (20+/28)</span>
        <span className="cp-legend-note">Score = Perfect Store ranging out of 28 SKUs</span>
      </div>

      {/* ── Calendar ── */}
      {loading ? (
        <div className="cp-loading"><div className="cp-spinner" /><p>Loading planner…</p></div>
      ) : (
        <div className="cp-calendar">
          {weeks.map((week, wi) => {
            const filled = weekFilled(week)
            return (
              <div key={wi} className="cp-week">
                <div className="cp-week-hd">
                  <span>Week {wi + 1}</span>
                  <span className="cp-week-range">
                    {fmtDay(week[0])} – {fmtDay(week[4])}
                  </span>
                  {filled > 0 && (
                    <span className="cp-week-filled">{filled} store{filled !== 1 ? 's' : ''} planned</span>
                  )}
                </div>
                <div className="cp-week-grid">
                  {week.map(date => {
                    const ds = toDS(date)
                    return (
                      <DayCard
                        key={ds}
                        date={date}
                        psScores={psScores}
                        daySlots={getDaySlots(ds)}
                        dayNotes={notes[ds] || ''}
                        isLeave={leaveDates.has(ds)}
                        homeBase={homeBase}
                        onSlotChange={saveSlot}
                        onNotesChange={saveNotes}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
