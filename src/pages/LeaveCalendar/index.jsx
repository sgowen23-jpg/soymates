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

const LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'RDO', 'Training', 'Regional Trip', 'Public Holiday', 'Other']

export const REP_COLORS = {
  'Azra Horell':        '#CC0000',
  'Ashleigh Tasdarian': '#1a2b5e',
  'David Kerr':         '#e67e22',
  'Dipen Surani':       '#8e44ad',
  'Sam Gowen':          '#16a085',
  'Shane Vandewardt':   '#c0392b',
}

function toDateStr(d) {
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
  return parseDateLocal(str).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtShort(str) {
  return parseDateLocal(str).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function daysUntil(monthDay) {
  // monthDay = 'MM-DD'
  const today = new Date()
  const [m, d] = monthDay.split('-').map(Number)
  let next = new Date(today.getFullYear(), m - 1, d)
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.ceil((next - today) / 86400000)
}

export default function LeaveCalendar() {
  const [entries, setEntries]     = useState([])
  const [birthdays, setBirthdays] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(null)
  const [viewDate, setViewDate]   = useState(new Date())

  // collapsible sections
  const [showUpcoming, setShowUpcoming] = useState(true)
  const [showPast, setShowPast]         = useState(false)

  // rep filters
  const [upcomingFilter, setUpcomingFilter] = useState('All')
  const [pastFilter, setPastFilter]         = useState('All')

  const today = toDateStr(new Date())

  // Add leave form
  const [form, setForm] = useState({
    rep_name: REPS[0], start_date: today, end_date: today,
    leave_type: 'Annual Leave', notes: '',
  })

  // Add birthday form
  const [bdForm, setBdForm]   = useState({ rep_name: REPS[0], birthday: '' })
  const [bdSaving, setBdSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: leaveData }, { data: bdData }] = await Promise.all([
      supabase.from('leave_entries').select('*').order('start_date', { ascending: true }),
      supabase.from('birthdays').select('*').order('rep_name'),
    ])
    setEntries(leaveData || [])
    setBirthdays(bdData || [])
    setLoading(false)
  }

  async function handleAddLeave(e) {
    e.preventDefault()
    if (form.end_date < form.start_date) { setError('End date cannot be before start date'); return }
    setSaving(true); setError(null); setSuccess(null)
    const { error } = await supabase.from('leave_entries').insert([form])
    if (error) setError(error.message)
    else { setSuccess(`Leave added for ${form.rep_name}`); fetchAll(); setTimeout(() => setSuccess(null), 3000) }
    setSaving(false)
  }

  async function handleAddBirthday(e) {
    e.preventDefault()
    setBdSaving(true); setError(null)
    const { error } = await supabase.from('birthdays')
      .upsert([bdForm], { onConflict: 'rep_name' })
    if (error) setError(error.message)
    else { setSuccess(`Birthday saved for ${bdForm.rep_name}`); fetchAll(); setTimeout(() => setSuccess(null), 3000) }
    setBdSaving(false)
  }

  async function handleDeleteLeave(id, repName) {
    if (!confirm(`Delete leave entry for ${repName}?`)) return
    await supabase.from('leave_entries').delete().eq('id', id)
    fetchAll()
  }

  async function handleDeleteBirthday(id) {
    await supabase.from('birthdays').delete().eq('id', id)
    fetchAll()
  }

  // ── Calendar helpers ────────────────────────────────────────────────────────
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay    = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startPad    = (firstDay.getDay() + 6) % 7  // Mon-start

  function isWeekend(day) {
    const dow = new Date(year, month, day).getDay()
    return dow === 0 || dow === 6
  }

  function getLeaveForDay(day) {
    const ds = toDateStr(new Date(year, month, day))
    if (isWeekend(day)) return []
    return entries.filter(e => e.start_date <= ds && e.end_date >= ds)
  }

  function getBirthdayForDay(day) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return birthdays.filter(b => b.birthday && b.birthday.slice(5) === `${mm}-${dd}`)
  }

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)) }

  const monthLabel = viewDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  // ── Upcoming birthdays (next 60 days) ──────────────────────────────────────
  const upcomingBirthdays = birthdays
    .map(b => {
      if (!b.birthday) return null
      const monthDay = b.birthday.slice(5) // MM-DD
      const days = daysUntil(monthDay)
      return { ...b, days, monthDay }
    })
    .filter(Boolean)
    .filter(b => b.days <= 30)
    .sort((a, b) => a.days - b.days)

  // ── Leave lists ────────────────────────────────────────────────────────────
  const upcoming = entries.filter(e => e.end_date >= today)
  const past     = entries.filter(e => e.end_date < today).slice().reverse()

  const filteredUpcoming = upcomingFilter === 'All' ? upcoming : upcoming.filter(e => e.rep_name === upcomingFilter)
  const filteredPast     = pastFilter === 'All'     ? past     : past.filter(e => e.rep_name === pastFilter)

  return (
    <div className="leave-page">

      {/* ── Add Leave ── */}
      <div className="leave-card">
        <h2 className="leave-card-title">Add Leave</h2>
        <form className="leave-form" onSubmit={handleAddLeave}>
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
            <button type="submit" className="leave-add-btn" disabled={saving}>{saving ? 'Saving…' : '+ Add'}</button>
          </div>
          {error   && <p className="leave-msg error">{error}</p>}
          {success && <p className="leave-msg success">{success}</p>}
        </form>
      </div>

      {/* ── Calendar ── */}
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
          <span className="cal-legend-item">
            <span className="cal-legend-dot" style={{ background: '#f59e0b' }} />
            Birthday
          </span>
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
            const dayLeave = getLeaveForDay(day)
            const dayBirthdays = getBirthdayForDay(day)
            return (
              <div key={day} className={`cal-day${isToday ? ' today' : ''}`}>
                <span className="cal-day-num">{day}</span>
                <div className="cal-day-entries">
                  {dayBirthdays.map(b => (
                    <span key={b.id} className="cal-entry-chip birthday-chip">
                      🎂 {b.rep_name.split(' ')[0]}
                      <span className="chip-tooltip">
                        <strong>🎂 {b.rep_name}</strong>
                        <span>Birthday!</span>
                      </span>
                    </span>
                  ))}
                  {dayLeave.map(e => (
                    <span key={e.id} className="cal-entry-chip" style={{ background: REP_COLORS[e.rep_name] }}>
                      {e.rep_name.split(' ')[0]}
                      <span className="chip-tooltip">
                        <strong>{e.rep_name}</strong>
                        <span>{e.leave_type}{e.notes ? ` — ${e.notes}` : ''}</span>
                        <span>{fmtShort(e.start_date)}{e.start_date !== e.end_date ? ` → ${fmtShort(e.end_date)}` : ''}</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Upcoming Birthdays (next 30 days) ── */}
      {upcomingBirthdays.length > 0 && (
        <div className="leave-card">
          <h2 className="leave-card-title">🎂 Upcoming Birthdays</h2>
          <div className="leave-list">
            {upcomingBirthdays.map(b => (
              <div key={b.id} className="leave-row">
                <span className="leave-row-dot" style={{ background: REP_COLORS[b.rep_name] }} />
                <div className="leave-row-info">
                  <span className="leave-row-name">{b.rep_name}</span>
                  <span className="leave-row-type">
                    {b.days === 0 ? '🎉 Today!' : b.days === 1 ? 'Tomorrow!' : `in ${b.days} days`}
                  </span>
                </div>
                <div className="leave-row-dates">
                  🎂 {parseDateLocal(b.birthday).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming Leave (collapsible + filter) ── */}
      <div className="leave-card">
        <div className="section-header" onClick={() => setShowUpcoming(v => !v)}>
          <h2 className="leave-card-title" style={{ margin: 0 }}>
            Upcoming Leave
            <span className="section-count">{upcoming.length}</span>
          </h2>
          <div className="section-header-right">
            {showUpcoming && (
              <select
                className="rep-filter-select"
                value={upcomingFilter}
                onChange={e => { e.stopPropagation(); setUpcomingFilter(e.target.value) }}
                onClick={e => e.stopPropagation()}
              >
                <option value="All">All Reps</option>
                {REPS.map(r => <option key={r}>{r}</option>)}
              </select>
            )}
            <span className="section-chevron">{showUpcoming ? '▲' : '▼'}</span>
          </div>
        </div>

        {showUpcoming && (
          loading ? <p className="leave-empty">Loading…</p>
          : filteredUpcoming.length === 0 ? <p className="leave-empty" style={{marginTop:12}}>No upcoming leave.</p>
          : (
            <div className="leave-list" style={{marginTop:12}}>
              {filteredUpcoming.map(e => (
                <div key={e.id} className="leave-row">
                  <span className="leave-row-dot" style={{ background: REP_COLORS[e.rep_name] }} />
                  <div className="leave-row-info">
                    <span className="leave-row-name">{e.rep_name}</span>
                    <span className="leave-row-type">{e.leave_type}{e.notes ? ` — ${e.notes}` : ''}</span>
                  </div>
                  <div className="leave-row-dates">
                    {e.start_date === e.end_date ? fmt(e.start_date) : `${fmtShort(e.start_date)} → ${fmtShort(e.end_date)}`}
                  </div>
                  <button className="leave-delete" onClick={() => handleDeleteLeave(e.id, e.rep_name)}>✕</button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Past Leave (collapsible + filter) ── */}
      {past.length > 0 && (
        <div className="leave-card">
          <div className="section-header" onClick={() => setShowPast(v => !v)}>
            <h2 className="leave-card-title" style={{ margin: 0, color: '#999' }}>
              Past Leave
              <span className="section-count">{past.length}</span>
            </h2>
            <div className="section-header-right">
              {showPast && (
                <select
                  className="rep-filter-select"
                  value={pastFilter}
                  onChange={e => { e.stopPropagation(); setPastFilter(e.target.value) }}
                  onClick={e => e.stopPropagation()}
                >
                  <option value="All">All Reps</option>
                  {REPS.map(r => <option key={r}>{r}</option>)}
                </select>
              )}
              <span className="section-chevron">{showPast ? '▲' : '▼'}</span>
            </div>
          </div>

          {showPast && (
            <div className="leave-list past" style={{marginTop:12}}>
              {filteredPast.map(e => (
                <div key={e.id} className="leave-row past">
                  <span className="leave-row-dot" style={{ background: REP_COLORS[e.rep_name], opacity: 0.4 }} />
                  <div className="leave-row-info">
                    <span className="leave-row-name">{e.rep_name}</span>
                    <span className="leave-row-type">{e.leave_type}{e.notes ? ` — ${e.notes}` : ''}</span>
                  </div>
                  <div className="leave-row-dates">{fmtShort(e.start_date)} → {fmtShort(e.end_date)}</div>
                  <button className="leave-delete" onClick={() => handleDeleteLeave(e.id, e.rep_name)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
