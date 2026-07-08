import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import './UploadLogs.css'

const CLIENT_LABELS = { vitasoy: 'Vitasoy', beiersdorf: 'Beiersdorf' }

const FILTERS = [
  { value: 'all',        label: 'All' },
  { value: 'vitasoy',    label: 'Vitasoy' },
  { value: 'beiersdorf', label: 'Beiersdorf' },
]

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const fmtNum = n => (n == null ? '—' : Number(n).toLocaleString())

export default function UploadLogs() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [errMsg,  setErrMsg]  = useState('')
  const [filter,  setFilter]  = useState('all')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('upload_logs')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(100)
      if (error) setErrMsg(error.message)
      else setLogs(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const visible = filter === 'all' ? logs : logs.filter(l => l.client === filter)

  return (
    <div className="logs-page">
      <div className="logs-header">
        <div className="logs-header-top">
          <h1 className="logs-title">Upload Logs</h1>
          <div className="logs-filter">
            {FILTERS.map(f => (
              <button
                key={f.value}
                className={`logs-filter-btn ${filter === f.value ? 'active' : ''}`}
                onClick={() => setFilter(f.value)}
              >{f.label}</button>
            ))}
          </div>
        </div>
        <p className="logs-sub">Last 100 uploads, newest first.</p>
      </div>

      <div className="logs-card">
        {loading && <div className="logs-empty">Loading…</div>}

        {!loading && errMsg && (
          <div className="logs-alert-error"><strong>Error:</strong> {errMsg}</div>
        )}

        {!loading && !errMsg && visible.length === 0 && (
          <div className="logs-empty">No uploads logged yet.</div>
        )}

        {!loading && !errMsg && visible.length > 0 && (
          <div className="logs-table-wrap">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>File</th>
                  <th className="logs-num">Rows</th>
                  <th className="logs-num">Stores</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(log => {
                  const failed = log.status !== 'success'
                  return (
                    <tr key={log.id} className={failed ? 'logs-row-failed' : ''}>
                      <td className="logs-date">{fmtDateTime(log.uploaded_at)}</td>
                      <td>{CLIENT_LABELS[log.client] ?? '—'}</td>
                      <td>{log.upload_type}</td>
                      <td className="logs-file" title={log.file_name}>{log.file_name}</td>
                      <td className="logs-num">{fmtNum(log.row_count)}</td>
                      <td className="logs-num">{fmtNum(log.store_count)}</td>
                      <td className={failed ? 'logs-status-failed' : 'logs-status-ok'}>{log.status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
