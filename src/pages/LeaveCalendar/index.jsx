import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import './LeaveCalendar.css'

export const REPS = [
  'Azra Horell',
  'Ashleigh Tasdarian',
  'David Kerr',
  'Dipen Surani',
  'Sam Gowen',
  'Shane Vandewardt',
]

const LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'RDO', 'Training', 'Regional Trip', 'Other']

const REP_COLORS = {
  'Azra Horell':        '#CC0000',
  'Ashleigh Tasdarian': '#1a2b5e',
  'David Kerr':         '#e67e22',
  'Dipen Surani':       '#8e44ad',
  'Sam Gowen':          '#16a085',
  'Shane Vandewardt':   '#c0392b',
}

function toDateStr(d) {
  // yyyy-mm-dd
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateLocal(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmt(str) {
  const d = parseDateLocal(str)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LeaveCalendar() {
  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)
  const [viewDate, setViewDate] = useState(new Date())

  // Form state
  const today = toDateStr(new Date())
  const [form, setForm] = useState({
    rep_name:   REPS[0],
    start_date: today,
    end_date:   today,
    leave_type: 'Annual Leave',
    notes:      '',
  })

  useEffect(() => { fetchEntries() }, [])

  async function fetchEntries() {
    setLoading(true)
    const { data, error } = await supabase
      .from('leave_entries')
      .select('*')
      .order('start_date', { ascending: true })
    if (error) setError(error.message)
    else setEntries(data || [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (form.end_date < form.start_date) {
      setError('End date cannot be before start date')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    const { error } = await supabase.from('leave_entries').insert([form])
    if (error) setError(error.message)
    else {
      setSuccess(`Leave added for ${form.rep_name}`)
      fetchEntries()
      setTimeout(() => setSuccess(null), 3000)
    }
    setSaving(false)
  }

  async function handleDelete(id, repName) {
    if (!confirm(`Delete leave entry for ${repName}?`)) return
    await supabase.from('leave_entries').delete().eq('id', id)
    fetchEntries()
  }

  // ── Calendar helpers ─────────────────────────────────────────────────────
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // 0=Sun pad to Mon-start
  const startPad = (firstDay.getDay() + 6) % 7

  function isWeekend(day) {
    const dow = new Date(year, month, day).getDay() // 0=Sun, 6=Sat
    return dow === 0 || dow === 6
  }

  function getEntriesForDay(day) {
    const ds = toDateStr(new Date(year, month, day))
    if (isWeekend(day)) return [] // never show chips on weekends
    return entries.filter(e => e.start_date <= ds && e.end_date >= ds)
  }

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)) }

  const monthLabel = viewDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  // Upcoming leave (from today)
  const upcoming = entries.filter(e => e.end_date >= today)
  const past     = entries.filter(e => e.end_date < today)

  return (
    <div className="leave-page">

      {/* ── Add Leave Form ── */}
      <div className="leave-card">
        <h2 className="leave-card-title">Add Leave</h2>
        <form className="leave-form" onSubmit={handleAdd}>
          <div className="leave-form-row">
            <div className="leave-field">
              <label>Rep</label>
              <select value={form.rep_name} onChange={e => setForm(f => ({ ...f, rep_name: e.target.value }))}>
                {REPS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="leave-field">
              <label>Type</label>
              <select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}>
                {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="leave-field">
              <label>From</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
            </div>
            <div className="leave-field">
              <label>To</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} required />
            </div>
            <div className="leave-field grow">
              <label>Notes (optional)</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. covering stores" />
            </div>
            <button type="submit" className="leave-add-btn" disabled={saving}>
              {saving ? 'Saving…' : '+ Add'}
            </button>
          </div>
          {error   && <p className="leave-msg error">{error}</p>}
          {success && <p className="leave-msg success">{success}</p>}
        </form>

      </div>

      {/* ── Calendar View ── */}
      <div className="leave-card">
        <div className="cal-header">
          <button className="cal-nav" onClick={prevMonth}>‹</button>
          <h2 className="leave-card-title" style={{ margin: 0 }}>{monthLabel}</h2>
          <button className="cal-nav" onClick={nextMonth}>›</button>
        </div>

        <div className="cal-legend">
          {REPS.map(r => (
            <span key={r} className="cal-legend-item">
              <span className="cal-legend-dot" style={{ background: REP_COLORS[r] }} />
              {r.split(' ')[0]}
            </span>
          ))}
        </div>

        <div className="cal-grid">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} className="cal-day-head">{d}</div>
          ))}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="cal-day empty" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const ds = toDateStr(new Date(year, month, day))
            const isToday = ds === today
            const dayEntries = getEntriesForDay(day)
            return (
              <div key={day} className={`cal-day${isToday ? ' today' : ''}`}>
                <span className="cal-day-num">{day}</span>
                <div className="cal-day-entries">
                  {dayEntries.map(e => (
                    <span
                      key={e.id}
                      className="cal-entry-chip"
                      style={{ background: REP_COLORS[e.rep_name] }}
                    >
                      {e.rep_name.split(' ')[0]}
                      <span className="chip-tooltip">
                        <strong>{e.rep_name}</strong>
                        <span>{e.leave_type}{e.notes ? ` — ${e.notes}` : ''}</span>
                        <span>{fmt(e.start_date)}{e.start_date !== e.end_date ? ` → ${fmt(e.end_date)}` : ''}</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Upcoming Leave List ── */}
      <div className="leave-card">
        <h2 className="leave-card-title">Upcoming Leave</h2>
        {loading ? (
          <p className="leave-empty">Loading…</p>
        ) : upcoming.length === 0 ? (
          <p className="leave-empty">No upcoming leave logged.</p>
        ) : (
          <div className="leave-list">
            {upcoming.map(e => (
              <div key={e.id} className="leave-row">
                <span className="leave-row-dot" style={{ background: REP_COLORS[e.rep_name] }} />
                <div className="leave-row-info">
                  <span className="leave-row-name">{e.rep_name}</span>
                  <span className="leave-row-type">{e.leave_type}</span>
                  {e.notes && <span className="leave-row-notes">{e.notes}</span>}
                </div>
                <div className="leave-row-dates">
                  {e.start_date === e.end_date
                    ? fmt(e.start_date)
                    : `${fmt(e.start_date)} → ${fmt(e.end_date)}`}
                </div>
                <button className="leave-delete" onClick={() => handleDelete(e.id, e.rep_name)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Past Leave ── */}
      {past.length > 0 && (
        <div className="leave-card">
          <h2 className="leave-card-title" style={{ color: '#999' }}>Past Leave</h2>
          <div className="leave-list past">
            {past.slice().reverse().map(e => (
              <div key={e.id} className="leave-row past">
                <span className="leave-row-dot" style={{ background: REP_COLORS[e.rep_name], opacity: 0.4 }} />
                <div className="leave-row-info">
                  <span className="leave-row-name">{e.rep_name}</span>
                  <span className="leave-row-type">{e.leave_type}</span>
                </div>
                <div className="leave-row-dates">{fmt(e.start_date)} → {fmt(e.end_date)}</div>
                <button className="leave-delete" onClick={() => handleDelete(e.id, e.rep_name)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
