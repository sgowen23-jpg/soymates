import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import './DataUpload.css'

const DB_FIELDS = [
  { key: 'store_name',   label: 'Store Name',   required: true },
  { key: 'address',      label: 'Address',       required: false },
  { key: 'suburb',       label: 'Suburb',        required: false },
  { key: 'state',        label: 'State',         required: false },
  { key: 'postcode',     label: 'Postcode',      required: false },
  { key: 'latitude',     label: 'Latitude',      required: false },
  { key: 'longitude',    label: 'Longitude',     required: false },
  { key: 'client',       label: 'Client',        required: false },
  { key: 'rep',          label: 'Rep',           required: false },
  { key: 'store_type',   label: 'Store Type',    required: false },
  { key: 'phone',        label: 'Phone',         required: false },
  { key: 'contact_name', label: 'Contact Name',  required: false },
]

// Try to auto-match Excel column headers to DB fields
function autoMap(headers) {
  const mapping = {}
  const lower = h => h.toLowerCase().replace(/[\s_-]/g, '')
  DB_FIELDS.forEach(({ key }) => {
    const match = headers.find(h => lower(h) === lower(key)) ||
                  headers.find(h => lower(h).includes(lower(key))) ||
                  headers.find(h => lower(key).includes(lower(h)))
    mapping[key] = match || ''
  })
  return mapping
}

const STEPS = ['Upload', 'Map Columns', 'Preview', 'Done']
const CHUNK = 50 // rows per Supabase batch

export default function DataUpload() {
  const [step, setStep]         = useState(0)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders]   = useState([])
  const [rows, setRows]         = useState([])     // raw Excel rows (array of objects)
  const [mapping, setMapping]   = useState({})
  const [progress, setProgress] = useState(0)
  const [status, setStatus]     = useState(null)   // { type: 'success'|'error', msg }
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  // ── Step 1: parse file ──────────────────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = evt => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!data.length) return
      const hdrs = Object.keys(data[0])
      setHeaders(hdrs)
      setRows(data)
      setMapping(autoMap(hdrs))
      setStep(1)
    }
    reader.readAsBinaryString(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      const dt = new DataTransfer()
      dt.items.add(file)
      fileRef.current.files = dt.files
      handleFile({ target: { files: [file] } })
    }
  }

  // ── Step 2: mapping ─────────────────────────────────────────────────────────
  function updateMapping(field, col) {
    setMapping(m => ({ ...m, [field]: col }))
  }

  // ── Step 3: preview — build mapped rows ─────────────────────────────────────
  function buildMappedRows() {
    return rows.map(row => {
      const out = {}
      DB_FIELDS.forEach(({ key }) => {
        if (mapping[key]) out[key] = row[mapping[key]] ?? ''
      })
      // coerce lat/lng to numbers
      if (out.latitude)  out.latitude  = parseFloat(out.latitude)  || null
      if (out.longitude) out.longitude = parseFloat(out.longitude) || null
      return out
    })
  }

  // ── Step 4: upload ──────────────────────────────────────────────────────────
  async function handleUpload() {
    setUploading(true)
    setProgress(0)
    setStatus(null)
    const mapped = buildMappedRows()
    const total  = mapped.length
    let done = 0
    let errors = []

    for (let i = 0; i < total; i += CHUNK) {
      const chunk = mapped.slice(i, i + CHUNK)
      const { error } = await supabase.from('stores').upsert(chunk, { onConflict: 'store_name' })
      if (error) errors.push(error.message)
      done = Math.min(i + CHUNK, total)
      setProgress(Math.round((done / total) * 100))
    }

    setUploading(false)
    if (errors.length) {
      setStatus({ type: 'error', msg: `${errors.length} batch(es) failed: ${errors[0]}` })
    } else {
      setStatus({ type: 'success', msg: `${total} store${total !== 1 ? 's' : ''} uploaded successfully!` })
    }
    setStep(3)
  }

  function reset() {
    setStep(0); setFileName(''); setHeaders([]); setRows([])
    setMapping({}); setProgress(0); setStatus(null); setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const previewRows = buildMappedRows().slice(0, 8)
  const mappedFields = DB_FIELDS.filter(f => mapping[f.key])

  return (
    <div className="upload-page">
      {/* Step progress bar */}
      <div className="upload-steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`upload-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
            <div className="upload-step-dot">{i < step ? '✓' : i + 1}</div>
            <span>{s}</span>
          </div>
        ))}
      </div>

      {/* ── Step 0: Upload ── */}
      {step === 0 && (
        <div className="upload-card">
          <h2 className="upload-card-title">Upload Store Data</h2>
          <p className="upload-card-sub">Upload an Excel file (.xlsx) to import stores into Supabase.</p>

          <div
            className="drop-zone"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current.click()}
          >
            <div className="drop-icon">📂</div>
            <p className="drop-main">Drag & drop your .xlsx file here</p>
            <p className="drop-sub">or click to browse</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>

          <div className="upload-sql-hint">
            <strong>First time?</strong> Run this SQL in Supabase to create the stores table:
            <pre>{`create table stores (
  id            bigserial primary key,
  store_name    text unique not null,
  address       text,
  suburb        text,
  state         text,
  postcode      text,
  latitude      double precision,
  longitude     double precision,
  client        text,
  rep           text,
  store_type    text,
  phone         text,
  contact_name  text,
  created_at    timestamptz default now()
);`}</pre>
          </div>
        </div>
      )}

      {/* ── Step 1: Map Columns ── */}
      {step === 1 && (
        <div className="upload-card">
          <h2 className="upload-card-title">Map Columns</h2>
          <p className="upload-card-sub">
            <strong>{fileName}</strong> — {rows.length} rows found. Match your Excel columns to the store fields below.
          </p>

          <div className="mapping-table-wrap">
            <table className="mapping-table">
              <thead>
                <tr>
                  <th>Store Field</th>
                  <th>Excel Column</th>
                  <th>Sample Value</th>
                </tr>
              </thead>
              <tbody>
                {DB_FIELDS.map(({ key, label, required }) => (
                  <tr key={key}>
                    <td>
                      {label}
                      {required && <span className="required-badge">required</span>}
                    </td>
                    <td>
                      <select
                        className="map-select"
                        value={mapping[key] || ''}
                        onChange={e => updateMapping(key, e.target.value)}
                      >
                        <option value="">— skip —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </td>
                    <td className="sample-val">
                      {mapping[key] && rows[0] ? String(rows[0][mapping[key]] ?? '—') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="upload-actions">
            <button className="btn-secondary" onClick={reset}>Back</button>
            <button
              className="btn-primary"
              disabled={!mapping.store_name}
              onClick={() => setStep(2)}
            >
              Preview Data →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ── */}
      {step === 2 && (
        <div className="upload-card wide">
          <h2 className="upload-card-title">Preview</h2>
          <p className="upload-card-sub">
            Showing first {previewRows.length} of {rows.length} rows. Confirm to upload all rows to Supabase.
          </p>

          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  {mappedFields.map(f => <th key={f.key}>{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {mappedFields.map(f => (
                      <td key={f.key}>{String(row[f.key] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="upload-actions">
            <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? `Uploading… ${progress}%` : `Upload ${rows.length} Stores`}
            </button>
          </div>

          {uploading && (
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
              <span className="progress-label">{progress}%</span>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Done ── */}
      {step === 3 && status && (
        <div className="upload-card center">
          <div className={`done-icon ${status.type}`}>
            {status.type === 'success' ? '✅' : '❌'}
          </div>
          <h2 className="upload-card-title">{status.type === 'success' ? 'Upload Complete!' : 'Upload Failed'}</h2>
          <p className="upload-card-sub">{status.msg}</p>

          {status.type === 'success' && (
            <div className="progress-wrap done">
              <div className="progress-bar" style={{ width: '100%' }} />
            </div>
          )}

          <div className="upload-actions center">
            <button className="btn-primary" onClick={reset}>Upload Another File</button>
          </div>
        </div>
      )}
    </div>
  )
}
