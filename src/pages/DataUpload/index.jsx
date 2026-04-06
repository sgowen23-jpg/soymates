import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import './DataUpload.css'

const CHUNK = 200
const SHEET_NAME = 'Master Store Key'
const STEPS = ['Upload', 'Preview', 'Done']

// ── Coerce helpers ────────────────────────────────────────────────────────────

const toInt   = v => { if (v == null || v === '') return null; const n = parseInt(v, 10);  return isNaN(n) ? null : n }
const toFloat = v => { if (v == null || v === '') return null; const n = parseFloat(v);    return isNaN(n) ? null : n }
const toStr   = v => (v == null || v === '') ? null : String(v).trim()

// ── Column map (src = exact Excel header, dest = DB column) ──────────────────

const COL_MAP = [
  { src: 'Store ID',           dest: 'store_id',        parse: toInt,   required: true },
  { src: 'Store ID (26)',      dest: 'store_id_26',      parse: toInt   },
  { src: 'Location ID (Dist)', dest: 'location_id_dist', parse: toInt   },
  { src: 'Store Name',         dest: 'store_name',       parse: toStr   },
  { src: 'State',              dest: 'state',            parse: toStr   },
  { src: 'Store Region',       dest: 'store_region',     parse: toStr   },
  { src: 'MSO',                dest: 'mso',              parse: toStr   },
  { src: 'Rep Name',           dest: 'rep_name',         parse: toStr   },
  { src: 'Group Name',         dest: 'group_name',       parse: toStr   },
  { src: 'Address',            dest: 'address',          parse: toStr   },
  { src: 'Suburb',             dest: 'suburb',           parse: toStr   },
  { src: 'Postcode',           dest: 'postcode',         parse: toStr   },
  { src: 'Classification',     dest: 'classification',   parse: toStr   },
  { src: 'Latitude',           dest: 'latitude',         parse: toFloat },
  { src: 'Longitude',          dest: 'longitude',        parse: toFloat },
]

// ── Parser ────────────────────────────────────────────────────────────────────

function parseFile(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })

  const sheetName = wb.SheetNames.find(
    n => n.trim().toLowerCase() === SHEET_NAME.toLowerCase()
  )
  if (!sheetName) {
    return { error: `Sheet "${SHEET_NAME}" not found. Sheets in file: ${wb.SheetNames.join(', ')}` }
  }

  const ws  = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(ws, { defval: null })
  if (!raw.length) return { error: `Sheet "${SHEET_NAME}" is empty.` }

  // Build case-insensitive header lookup
  const norm = h => String(h).trim().toLowerCase()
  const headerLookup = {}
  Object.keys(raw[0]).forEach(h => { headerLookup[norm(h)] = h })

  let skipped = 0
  const records = []

  raw.forEach(row => {
    const rec = {}
    COL_MAP.forEach(col => {
      const actualKey = headerLookup[norm(col.src)]
      rec[col.dest] = actualKey !== undefined ? col.parse(row[actualKey]) : null
    })
    if (rec.store_id === null) { skipped++; return }
    records.push(rec)
  })

  return { records, skipped, totalRows: raw.length }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DataUpload() {
  const [step,      setStep]      = useState(0)
  const [fileName,  setFileName]  = useState('')
  const [parseInfo, setParseInfo] = useState(null)   // { records, skipped, totalRows }
  const [uploading, setUploading] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [status,    setStatus]    = useState(null)   // { type: 'success'|'error', msg }
  const fileRef = useRef()

  function reset() {
    setStep(0); setFileName(''); setParseInfo(null)
    setUploading(false); setProgress(0); setStatus(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = evt => {
      const result = parseFile(evt.target.result)
      if (result.error) {
        setStatus({ type: 'error', msg: result.error })
        setStep(2)
        return
      }
      setParseInfo(result)
      setStep(1)
    }
    reader.readAsArrayBuffer(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile({ target: { files: [file] } })
  }

  async function handleUpload() {
    setUploading(true)
    setProgress(0)

    // DELETE all existing rows
    const { error: delErr } = await supabase
      .from('stores')
      .delete()
      .not('store_id', 'is', null)

    if (delErr) {
      setUploading(false)
      setStatus({ type: 'error', msg: `Delete failed: ${delErr.message}` })
      setStep(2)
      return
    }

    // INSERT in chunks
    const { records } = parseInfo
    const total  = records.length
    const errors = []

    for (let i = 0; i < total; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK)
      const { error } = await supabase.from('stores').insert(chunk)
      if (error) errors.push(error.message)
      setProgress(Math.round((Math.min(i + CHUNK, total) / total) * 100))
    }

    setUploading(false)
    if (errors.length) {
      setStatus({ type: 'error', msg: `${errors.length} batch(es) failed: ${errors[0]}` })
    } else {
      setStatus({ type: 'success', msg: `${total} store${total !== 1 ? 's' : ''} uploaded successfully.` })
    }
    setStep(2)
  }

  const preview3 = parseInfo?.records?.slice(0, 3).map(r => r.store_name).filter(Boolean)

  return (
    <div className="upload-page">

      {/* Step progress */}
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
          <h2 className="upload-card-title">Upload Master Store Key</h2>
          <p className="upload-card-sub">
            Upload the Master Store Key .xlsx file. All existing stores will be replaced with the new data.
          </p>

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
              accept=".xlsx"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>

          <div className="upload-sql-hint">
            <strong>Expected sheet:</strong> <code>Master Store Key</code> — headers in row 1.<br />
            Required column: <code>Store ID</code>. Rows missing Store ID are skipped and counted.
          </div>
        </div>
      )}

      {/* ── Step 1: Preview ── */}
      {step === 1 && parseInfo && (
        <div className="upload-card">
          <h2 className="upload-card-title">Preview</h2>
          <p className="upload-card-sub"><strong>{fileName}</strong></p>

          <div className="upload-sql-hint" style={{ marginBottom: 16 }}>
            <div><strong>Rows detected:</strong> {parseInfo.records.length.toLocaleString()}</div>
            {parseInfo.skipped > 0 && (
              <div style={{ color: '#b45309', marginTop: 6 }}>
                ⚠ {parseInfo.skipped} row{parseInfo.skipped !== 1 ? 's' : ''} skipped (missing Store ID)
              </div>
            )}
            {preview3?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong>First {preview3.length} stores:</strong>
                <ol style={{ margin: '4px 0 0 18px', padding: 0, fontSize: 12, color: '#444' }}>
                  {preview3.map((name, i) => <li key={i}>{name}</li>)}
                </ol>
              </div>
            )}
          </div>

          <div style={{ background: '#fff5f5', border: '1px solid #ffcccc', borderRadius: 8, padding: '11px 14px', fontSize: 13, color: '#CC0000', marginBottom: 20 }}>
            ⚠ This will <strong>delete all existing stores</strong> and replace them with{' '}
            <strong>{parseInfo.records.length.toLocaleString()}</strong> new records.
          </div>

          {uploading && (
            <div className="progress-wrap" style={{ marginBottom: 16 }}>
              <div className="progress-bar" style={{ width: `${progress}%` }} />
              <span className="progress-label">{progress}%</span>
            </div>
          )}

          <div className="upload-actions">
            <button className="btn-secondary" onClick={reset} disabled={uploading}>Cancel</button>
            <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? `Uploading… ${progress}%` : `Upload ${parseInfo.records.length.toLocaleString()} Stores`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Done ── */}
      {step === 2 && status && (
        <div className="upload-card center">
          <div className="done-icon">
            {status.type === 'success' ? '✅' : '❌'}
          </div>
          <h2 className="upload-card-title">
            {status.type === 'success' ? 'Upload Complete!' : 'Upload Failed'}
          </h2>
          <p className="upload-card-sub">{status.msg}</p>

          {status.type === 'success' && (
            <div className="progress-wrap done">
              <div className="progress-bar" style={{ width: '100%' }} />
            </div>
          )}

          <div className="upload-actions center" style={{ marginTop: 20 }}>
            <button className="btn-primary" onClick={reset}>Upload Another File</button>
          </div>
        </div>
      )}

    </div>
  )
}
