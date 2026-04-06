import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import './DataUpload.css'

const CHUNK = 200
const SHEET = 'Master Store Key'

const toInt   = v => { if (v == null || v === '') return null; const n = parseInt(v, 10); return isNaN(n) ? null : n }
const toFloat = v => { if (v == null || v === '') return null; const n = parseFloat(v);   return isNaN(n) ? null : n }
const toStr   = v => (v == null || v === '') ? null : String(v).trim()

const COL_MAP = [
  { src: 'Store ID',           dest: 'store_id',        parse: toInt   },
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

function parseFile(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === SHEET.toLowerCase())
  if (!sheetName) return { error: `Sheet "${SHEET}" not found. Found: ${wb.SheetNames.join(', ')}` }

  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })
  if (!raw.length) return { error: `Sheet "${SHEET}" is empty.` }

  const norm = h => String(h).trim().toLowerCase()
  const lookup = {}
  Object.keys(raw[0]).forEach(h => { lookup[norm(h)] = h })

  let skipped = 0
  const records = []
  raw.forEach(row => {
    const rec = {}
    COL_MAP.forEach(col => {
      const key = lookup[norm(col.src)]
      rec[col.dest] = key !== undefined ? col.parse(row[key]) : null
    })
    if (!rec.store_id) { skipped++; return }
    records.push(rec)
  })

  return { records, skipped, totalRows: raw.length }
}

export default function DataUpload() {
  const [phase,     setPhase]     = useState('idle')
  const [fileName,  setFileName]  = useState('')
  const [parseInfo, setParseInfo] = useState(null)
  const [progress,  setProgress]  = useState(0)
  const [result,    setResult]    = useState(null)
  const [errMsg,    setErrMsg]    = useState('')
  const fileRef = useRef()

  function reset() {
    setPhase('idle'); setFileName(''); setParseInfo(null)
    setProgress(0); setResult(null); setErrMsg('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = evt => {
      const res = parseFile(evt.target.result)
      if (res.error) { setErrMsg(res.error); setPhase('error'); return }
      if (!res.records.length) { setErrMsg('No valid rows found (all rows missing Store ID).'); setPhase('error'); return }
      setParseInfo(res)
      setPhase('parsed')
    }
    reader.readAsArrayBuffer(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile({ target: { files: [file] } })
  }

  async function handleUpload() {
    setPhase('uploading')
    setProgress(0)
    const { records } = parseInfo
    const total = records.length
    const errors = []

    for (let i = 0; i < total; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK)
      const { error } = await supabase.from('stores').upsert(chunk, { onConflict: 'store_id' })
      if (error) errors.push(error.message)
      setProgress(Math.round((Math.min(i + CHUNK, total) / total) * 100))
    }

    setResult({ count: total, errors })
    setPhase('done')
  }

  const preview3 = parseInfo?.records?.slice(0, 3).map(r => r.store_name).filter(Boolean)

  return (
    <div className="du-page">
      <div className="du-header">
        <h1 className="du-title">Store Key Upload</h1>
        <p className="du-sub">One-time upload. Only redo if stores change.</p>
      </div>

      <div className="du-card">

        {phase === 'idle' && (
          <div
            className="du-drop"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current.click()}
          >
            <div className="du-drop-icon">📂</div>
            <div className="du-drop-main">Drop .xlsx here or click to browse</div>
            <div className="du-drop-hint">Sheet: <code>Master Store Key</code></div>
            <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFile} />
          </div>
        )}

        {phase === 'error' && (
          <div className="du-alert du-alert-error">
            <strong>Parse error:</strong> {errMsg}
            <button className="du-link" onClick={reset}>Try again</button>
          </div>
        )}

        {phase === 'parsed' && parseInfo && (
          <>
            <div className="du-alert du-alert-info">
              <div><strong>File:</strong> {fileName}</div>
              <div><strong>{parseInfo.records.length.toLocaleString()}</strong> rows ready to upload</div>
              {parseInfo.skipped > 0 && (
                <div className="du-warn">⚠ {parseInfo.skipped} rows skipped (no Store ID)</div>
              )}
              {preview3?.length > 0 && (
                <div className="du-preview-names">First {preview3.length}: {preview3.join(' · ')}</div>
              )}
            </div>
            <div className="du-actions">
              <button className="du-btn-sec" onClick={reset}>Cancel</button>
              <button className="du-btn-pri" onClick={handleUpload}>
                Upload {parseInfo.records.length.toLocaleString()} stores
              </button>
            </div>
          </>
        )}

        {phase === 'uploading' && (
          <div className="du-uploading">
            <div className="du-prog-wrap">
              <div className="du-prog-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="du-prog-label">Uploading… {progress}%</div>
          </div>
        )}

        {phase === 'done' && result && (
          <div className={`du-alert ${result.errors.length ? 'du-alert-error' : 'du-alert-success'}`}>
            {result.errors.length ? (
              <>
                <strong>❌ Upload failed:</strong> {result.errors[0]}
                <button className="du-link" onClick={reset}>Try again</button>
              </>
            ) : (
              <>
                <strong>✅ Done!</strong> {result.count.toLocaleString()} stores uploaded.
                <button className="du-link" onClick={reset}>Upload another file</button>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
