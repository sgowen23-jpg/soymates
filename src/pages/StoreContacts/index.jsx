import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import './StoreContacts.css'

const BANNERS = ['All', 'IGA', 'Foodland', 'Drakes', 'FoodWorks', 'Supa IGA', 'IGA Local Grocer', 'Fresh & Save', 'Friendly Grocer']
const ROLES   = ['All', 'Store Manager', 'Owner', 'Grocery Manager', 'Dairy Freezer Manager', 'Key Contact', 'Buyer Ordering', 'Dairy/Freezer Manager', 'Assistant Manager']
const STATES  = ['All', 'SA', 'NSW', 'QLD', 'VIC', 'WA']
const REPS    = ['All', 'Azra Horell', 'Ashleigh Tasdarian', 'David Kerr', 'Dipen Surani', 'Sam Gowen', 'Shane Vandewardt']

const EXT_META = {
  pdf:  { icon: '📄', color: '#c0392b' },
  xlsx: { icon: '📊', color: '#27ae60' },
  pptx: { icon: '📑', color: '#2980b9' },
  jpg:  { icon: '🖼️', color: '#e67e22' },
  jpeg: { icon: '🖼️', color: '#e67e22' },
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getExt(name) {
  return (name || '').split('.').pop().toLowerCase()
}

export default function StoreContacts() {
  const { session } = useAuth()
  const [userProfile, setUserProfile] = useState(null)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('rep_profiles')
      .select('rep_name, state, is_admin')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => setUserProfile(data))
  }, [session])

  const repName = userProfile?.rep_name ?? null
  const isAdmin = userProfile?.is_admin ?? false

  const [tab, setTab] = useState('contacts')

  // ─── Contacts state ───────────────────────────────────────────────────────────
  const [contacts, setContacts]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [universe, setUniverse]       = useState('territory')
  const [repFilter, setRepFilter]     = useState('All')
  const [banner, setBanner]           = useState('All')
  const [role, setRole]               = useState('All')
  const [stateFilter, setStateFilter] = useState('All')
  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState(new Set())

  // ─── Email Builder state ──────────────────────────────────────────────────────
  const [subject, setSubject]                   = useState('')
  const [message, setMessage]                   = useState('')
  const [attachments, setAttachments]           = useState([])
  const [checkedAttachments, setCheckedAttachments] = useState(new Set())
  const [attachLoading, setAttachLoading]       = useState(false)
  const [uploading, setUploading]               = useState(false)
  const [uploadError, setUploadError]           = useState(null)
  const [bccCopied, setBccCopied]               = useState(false)

  // ─── Fetch contacts ───────────────────────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('store_contacts').select('*')

    if (universe === 'territory' && !isAdmin && repName) {
      q = q.eq('rep_name', repName)
    }
    if (isAdmin && repFilter !== 'All') q = q.eq('rep_name', repFilter)
    if (banner !== 'All')      q = q.eq('banner', banner)
    if (role !== 'All')        q = q.eq('role', role)
    if (stateFilter !== 'All') q = q.eq('state', stateFilter)

    const { data } = await q.order('store_name')
    setContacts(data || [])
    setLoading(false)
  }, [universe, repFilter, banner, role, stateFilter, repName, isAdmin])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  // ─── Fetch attachments ────────────────────────────────────────────────────────
  const fetchAttachments = useCallback(async () => {
    setAttachLoading(true)
    const { data } = await supabase.storage
      .from('email-attachments')
      .list('', { sortBy: { column: 'name', order: 'asc' } })
    setAttachments(data || [])
    setAttachLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'email') fetchAttachments()
  }, [tab, fetchAttachments])

  // ─── Client-side search ───────────────────────────────────────────────────────
  const filtered = contacts.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (c.store_name   || '').toLowerCase().includes(q) ||
      (c.contact_name || '').toLowerCase().includes(q)
    )
  })

  // ─── Selection helpers ────────────────────────────────────────────────────────
  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const allSelected = filtered.every(c => selected.has(c.id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) {
        filtered.forEach(c => next.delete(c.id))
      } else {
        filtered.forEach(c => next.add(c.id))
      }
      return next
    })
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id))
  const selectedContacts   = contacts.filter(c => selected.has(c.id))
  const selectedEmails     = selectedContacts.filter(c => c.contact_email).map(c => c.contact_email)

  // ─── Attachment helpers ───────────────────────────────────────────────────────
  function toggleAttachment(name) {
    setCheckedAttachments(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const ext = getExt(file.name)
    if (!['pdf', 'xlsx', 'pptx', 'jpg', 'jpeg'].includes(ext)) {
      setUploadError('Unsupported file type. Allowed: pdf, xlsx, pptx, jpg, jpeg.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File exceeds 20 MB limit.')
      return
    }
    setUploading(true)
    setUploadError(null)
    const { error } = await supabase.storage
      .from('email-attachments')
      .upload(file.name, file, { upsert: true })
    if (error) setUploadError(error.message)
    else await fetchAttachments()
    setUploading(false)
    e.target.value = ''
  }

  async function handleDeleteAttachment(name) {
    await supabase.storage.from('email-attachments').remove([name])
    setCheckedAttachments(prev => { const next = new Set(prev); next.delete(name); return next })
    fetchAttachments()
  }

  // ─── Open in Outlook ──────────────────────────────────────────────────────────
  async function handleOpenOutlook() {
    // Download all checked attachments
    const toDownload = attachments.filter(a => checkedAttachments.has(a.name))
    for (const file of toDownload) {
      const { data } = await supabase.storage.from('email-attachments').download(file.name)
      if (data) {
        const url = URL.createObjectURL(data)
        const a   = document.createElement('a')
        a.href     = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
      }
    }

    const bcc        = selectedEmails.join(',')
    const subjectEnc = encodeURIComponent(subject)
    const bodyEnc    = encodeURIComponent(message)
    const isMobile   = window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent)

    if (isMobile) {
      // Mobile: mailto: opens the Outlook app directly
      window.location.href = `mailto:?bcc=${bcc}&subject=${subjectEnc}&body=${bodyEnc}`
    } else {
      // Desktop: Outlook Web deeplink (bcc= unsupported, copy to clipboard)
      try { await navigator.clipboard.writeText(selectedEmails.join('; ')) } catch { /* unavailable */ }
      window.open(
        `https://outlook.office.com/mail/deeplink/compose?subject=${subjectEnc}&body=${bodyEnc}`,
        '_blank'
      )
      setBccCopied(true)
      setTimeout(() => setBccCopied(false), 10000)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="sc-page">
      {/* Tab bar */}
      <div className="sc-tabs">
        <button
          className={`sc-tab ${tab === 'contacts' ? 'active' : ''}`}
          onClick={() => setTab('contacts')}
        >
          Contacts
        </button>
        <button
          className={`sc-tab ${tab === 'email' ? 'active' : ''}`}
          onClick={() => setTab('email')}
        >
          Email Builder
          {selected.size > 0 && (
            <span className="sc-tab-badge">{selected.size}</span>
          )}
        </button>
      </div>

      {/* ── Contacts view ────────────────────────────────────────────────────── */}
      {tab === 'contacts' && (
        <div className="sc-contacts">
          <div className="sc-filters">
            {/* Universe toggle */}
            <div className="sc-universe-toggle">
              <button
                className={`sc-utbtn ${universe === 'territory' ? 'active' : ''}`}
                onClick={() => setUniverse('territory')}
              >
                In territory
              </button>
              <button
                className={`sc-utbtn ${universe === 'all' ? 'active' : ''}`}
                onClick={() => setUniverse('all')}
              >
                Whole universe
              </button>
            </div>

            {/* Rep dropdown — admin only */}
            {isAdmin && (
              <select className="sc-select" value={repFilter} onChange={e => setRepFilter(e.target.value)}>
                {REPS.map(r => <option key={r}>{r}</option>)}
              </select>
            )}

            <select className="sc-select" value={banner} onChange={e => setBanner(e.target.value)}>
              {BANNERS.map(b => <option key={b}>{b}</option>)}
            </select>

            <select className="sc-select" value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>

            <select className="sc-select" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>

            <input
              className="sc-search"
              type="text"
              placeholder="Search store or contact…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Selection bar */}
          <div className="sc-selection-bar">
            <label className="sc-select-all-label">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
              />
              Select all visible ({filtered.length})
            </label>
            {selected.size > 0 && (
              <>
                <span className="sc-selected-count">{selected.size} selected</span>
                <button className="sc-add-email-btn" onClick={() => setTab('email')}>
                  Add to email →
                </button>
              </>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="sc-status">Loading contacts…</div>
          ) : filtered.length === 0 ? (
            <div className="sc-status sc-empty">No contacts found.</div>
          ) : (
            <div className="sc-table-wrap">
              <table className="sc-table">
                <thead>
                  <tr>
                    <th className="sc-th-check"></th>
                    <th>Store Name</th>
                    <th>Banner</th>
                    <th>Contact Name</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr
                      key={c.id}
                      className={`sc-row ${selected.has(c.id) ? 'sc-row-selected' : ''}`}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                        />
                      </td>
                      <td className="sc-td-store">{c.store_name || '—'}</td>
                      <td>{c.banner || '—'}</td>
                      <td>{c.contact_name || '—'}</td>
                      <td>
                        {c.role
                          ? <span className="sc-role-chip">{c.role}</span>
                          : '—'}
                      </td>
                      <td>
                        {c.contact_phone
                          ? <a href={`tel:${c.contact_phone}`} className="sc-link">{c.contact_phone}</a>
                          : '—'}
                      </td>
                      <td>
                        {c.contact_email
                          ? <a href={`mailto:${c.contact_email}`} className="sc-link">{c.contact_email}</a>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Email Builder view ───────────────────────────────────────────────── */}
      {tab === 'email' && (
        <div className="sc-email-builder">
          <div className="sc-eb-card">
            {/* To field */}
            <div className="sc-eb-field">
              <label className="sc-eb-label">To (sent as BCC)</label>
              <div className="sc-eb-to-box">
                {selectedEmails.length > 0 ? (
                  <span>
                    <strong>{selectedEmails.length}</strong> contact{selectedEmails.length !== 1 ? 's' : ''} ·{' '}
                    <span className="sc-eb-emails">{selectedEmails.join(', ')}</span>
                  </span>
                ) : (
                  <span className="sc-eb-no-contacts">
                    No contacts selected — go to the Contacts tab and check some rows
                  </span>
                )}
              </div>
            </div>

            {/* Subject */}
            <div className="sc-eb-field">
              <label className="sc-eb-label">Subject</label>
              <input
                className="sc-eb-input"
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>

            {/* Message */}
            <div className="sc-eb-field">
              <label className="sc-eb-label">
                Message
                <span className="sc-eb-hint"> — [First Name] personalises on send</span>
              </label>
              <textarea
                className="sc-eb-textarea"
                rows={9}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={'Hi [First Name],\n\nYour message here…'}
              />
            </div>

            {/* Attachments */}
            <div className="sc-eb-field">
              <div className="sc-eb-attach-header">
                <label className="sc-eb-label">Attachments</label>
                {isAdmin && (
                  <label className={`sc-upload-btn ${uploading ? 'uploading' : ''}`}>
                    {uploading ? 'Uploading…' : '+ Upload file'}
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.pptx,.jpg,.jpeg"
                      onChange={handleUpload}
                      disabled={uploading}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>

              {uploadError && (
                <div className="sc-error">{uploadError}</div>
              )}

              {attachLoading ? (
                <div className="sc-status">Loading attachments…</div>
              ) : attachments.length === 0 ? (
                <div className="sc-status sc-empty">No attachments uploaded yet.</div>
              ) : (
                <div className="sc-attach-list">
                  {attachments.map(a => {
                    const ext  = getExt(a.name)
                    const meta = EXT_META[ext] || { icon: '📎', color: '#666' }
                    return (
                      <div
                        key={a.name}
                        className={`sc-attach-row ${checkedAttachments.has(a.name) ? 'checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checkedAttachments.has(a.name)}
                          onChange={() => toggleAttachment(a.name)}
                        />
                        <span className="sc-attach-icon" style={{ color: meta.color }}>
                          {meta.icon}
                        </span>
                        <span className="sc-attach-name">{a.name}</span>
                        <span className="sc-attach-size">{formatBytes(a.metadata?.size)}</span>
                        {isAdmin && (
                          <button
                            className="sc-attach-delete"
                            onClick={() => handleDeleteAttachment(a.name)}
                            title="Delete file"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* BCC clipboard notice */}
            {bccCopied && (
              <div className="sc-bcc-notice">
                ✅ <strong>{selectedEmails.length} BCC addresses copied to clipboard</strong> — click the <strong>Bcc</strong> field in Outlook and press <kbd>Ctrl+V</kbd> to paste
              </div>
            )}

            {/* Open in Outlook */}
            <button
              className="sc-outlook-btn"
              onClick={handleOpenOutlook}
              disabled={selectedEmails.length === 0}
            >
              Open in Outlook Web ({selectedEmails.length} contact{selectedEmails.length !== 1 ? 's' : ''}, {checkedAttachments.size} attachment{checkedAttachments.size !== 1 ? 's' : ''})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
