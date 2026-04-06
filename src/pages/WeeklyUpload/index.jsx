import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import './WeeklyUpload.css'

const CHUNK = 200

// ── Coerce helpers ────────────────────────────────────────────────────────────

const toInt   = v => { if (v == null || v === '') return null; const n = parseInt(v, 10); return isNaN(n) ? null : n }
const toFloat = v => { if (v == null || v === '') return null; const n = parseFloat(v);   return isNaN(n) ? null : n }
const toStr   = v => (v == null || v === '') ? null : String(v).trim()

// ── Column maps ───────────────────────────────────────────────────────────────

const BNB_COLS = [
  { src: 'State',                   dest: 'state',                   parse: toStr   },
  { src: 'Store Region',            dest: 'store_region',            parse: toStr   },
  { src: 'Store Name',              dest: 'store_name',              parse: toStr   },
  { src: 'Store ID',                dest: 'store_id',                parse: toInt   },
  { src: 'MSO',                     dest: 'mso',                     parse: toStr   },
  { src: 'Item Name',               dest: 'item_name',               parse: toStr   },
  { src: 'Item ID',                 dest: 'item_id',                 parse: toInt   },
  { src: 'POG Category',            dest: 'pog_category',            parse: toStr   },
  { src: 'Rep Name',                dest: 'rep_name',                parse: toStr   },
  { src: 'Count of Ranging',        dest: 'count_of_ranging',        parse: toInt   },
  { src: 'Sum of Ranging',          dest: 'sum_of_ranging',          parse: toInt   },
  { src: 'Distribution Percentage', dest: 'distribution_percentage', parse: toFloat },
  { src: 'Ranging Gap',             dest: 'ranging_gap',             parse: toInt   },
  { src: 'To Target Percentage',    dest: 'to_target_percentage',    parse: toFloat },
  { src: 'Buy Rate Latest',         dest: 'buy_rate_latest',         parse: toFloat },
]

const DIST_COLS = [
  { src: 'RepName',            dest: 'rep_name',          parse: toStr   },
  { src: 'Location ID',        dest: 'location_id',       parse: toInt   },
  { src: 'Store Name',         dest: 'store_name',        parse: toStr   },
  { src: 'State',              dest: 'state',             parse: toStr   },
  { src: 'Banner Group',       dest: 'banner_group',      parse: toStr   },
  { src: 'Code',               dest: 'item_code',         parse: toStr   },
  { src: 'Name',               dest: 'item_name',         parse: toStr   },
  { src: 'Latest Distribution',dest: 'latest_distribution',parse: toInt  },
  { src: 'Total Gains (Gross)',dest: 'total_gains_gross', parse: toFloat },
  { src: 'Total Losses',       dest: 'total_losses',      parse: toFloat },
  { src: 'Total Net Gains',    dest: 'total_net_gains',   parse: toFloat },
  { src: 'Movement Type',      dest: 'movement_type',     parse: toStr   },
]

// ── Parser ────────────────────────────────────────────────────────────────────

function parseSheet(arrayBuffer, colMap) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === 'export')
  if (!sheetName) return { error: `Sheet "Export" not found. Found: ${wb.SheetNames.join(', ')}` }

  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })
  if (!raw.length) return { error: 'Export sheet is empty.' }

  const norm = h => String(h).trim().toLowerCase()
  const lookup = {}
  Object.keys(raw[0]).forEach(h => { lookup[norm(h)] = h })

  const records = raw.map(row => {
    const rec = {}
    colMap.forEach(col => {
      const key = lookup[norm(col.src)]
      rec[col.dest] = key !== undefined ? col.parse(row[key]) : null
    })
    return rec
  })

  return { records, totalRows: raw.length }
}

// ── Uploader component ────────────────────────────────────────────────────────

function Uploader({ label, colMap, table, deleteQuery }) {
  const [phase,     setPhase]     = useState('idle') // idle | parsed | uploading | done | error
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
      const res = parseSheet(evt.target.result, colMap)
      if (res.error) { setErrMsg(res.error); setPhase('error'); return }
      if (!res.records.length) { setErrMsg('No rows found in Export sheet.'); setPhase('error'); return }
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

    // Delete existing rows
    const { error: delErr } = await deleteQuery()
    if (delErr) {
      setErrMsg(`Delete failed: ${delErr.message}`)
      setPhase('error')
      return
    }

    // Insert in chunks
    const { records } = parseInfo
    const total = records.length
    const errors = []

    for (let i = 0; i < total; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK)
      const { error } = await supabase.from(table).insert(chunk)
      if (error) errors.push(error.message)
      setProgress(Math.round((Math.min(i + CHUNK, total) / total) * 100))
    }

    setResult({ count: total, errors })
    setPhase('done')
  }

  return (
    <div className="wu-card">
      <div className="wu-card-label">{label}</div>
      <div className="wu-card-hint">Sheet: <code>Export</code> → <code>{table}</code></div>

      {phase === 'idle' && (
        <div
          className="wu-drop"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current.click()}
        >
          <span className="wu-drop-icon">📂</span>
          <span className="wu-drop-text">Drop .xlsx or click to browse</span>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}

      {phase === 'error' && (
        <div className="wu-alert wu-alert-error">
          <strong>Error:</strong> {errMsg}
          <button className="wu-link" onClick={reset}>Try again</button>
        </div>
      )}

      {phase === 'parsed' && parseInfo && (
        <div className="wu-parsed">
          <div className="wu-parsed-info">
            <span className="wu-file-name">{fileName}</span>
            <span className="wu-row-count">{parseInfo.records.length.toLocaleString()} rows</span>
          </div>
          <div className="wu-actions">
            <button className="wu-btn-sec" onClick={reset}>Cancel</button>
            <button className="wu-btn-pri" onClick={handleUpload}>
              Upload {parseInfo.records.length.toLocaleString()} rows
            </button>
          </div>
        </div>
      )}

      {phase === 'uploading' && (
        <div className="wu-uploading">
          <div className="wu-prog-wrap">
            <div className="wu-prog-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="wu-prog-label">Uploading… {progress}%</div>
        </div>
      )}

      {phase === 'done' && result && (
        <div className={`wu-alert ${result.errors.length ? 'wu-alert-error' : 'wu-alert-success'}`}>
          {result.errors.length ? (
            <>
              <strong>❌ Failed:</strong> {result.errors[0]}
              <button className="wu-link" onClick={reset}>Try again</button>
            </>
          ) : (
            <>
              <strong>✅ Done!</strong> {result.count.toLocaleString()} rows inserted.
              <button className="wu-link" onClick={reset}>Upload new file</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WeeklyUpload() {
  return (
    <div className="wu-page">
      <div className="wu-header">
        <h1 className="wu-title">Weekly Data Upload</h1>
        <p className="wu-sub">Upload all three files each week.</p>
      </div>

      <div className="wu-grid">
        <Uploader
          label="26 Week Buy Not Buy"
          colMap={BNB_COLS}
          table="bnb_26wk"
          deleteQuery={() => supabase.from('bnb_26wk').delete().gte('id', 0)}
        />
        <Uploader
          label="13 Week Buy Not Buy"
          colMap={BNB_COLS}
          table="bnb_13wk"
          deleteQuery={() => supabase.from('bnb_13wk').delete().gte('id', 0)}
        />
        <Uploader
          label="Distribution"
          colMap={DIST_COLS}
          table="store_distribution"
          deleteQuery={() => supabase.from('store_distribution').delete().gte('id', 0)}
        />
      </div>
    </div>
  )
}
