import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { logUpload, countDistinctStores } from '../../lib/uploadLog'
import './DataUpload.css'

const CHUNK = 200

// ── helpers ───────────────────────────────────────────────────────────────────
const toInt   = v => { if (v == null || v === '') return null; const n = parseInt(v, 10); return isNaN(n) ? null : n }
const toFloat = v => { if (v == null || v === '') return null; const n = parseFloat(v);   return isNaN(n) ? null : n }
const toStr   = v => (v == null || v === '') ? null : String(v).trim()

// ── Store Key parser ──────────────────────────────────────────────────────────
const STORE_SHEET = 'Master Store Key'

const STORE_COL_MAP = [
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

function parseStoreFile(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === STORE_SHEET.toLowerCase())
  if (!sheetName) return { error: `Sheet "${STORE_SHEET}" not found. Found: ${wb.SheetNames.join(', ')}` }

  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })
  if (!raw.length) return { error: `Sheet "${STORE_SHEET}" is empty.` }

  const norm = h => String(h).trim().toLowerCase()
  const lookup = {}
  Object.keys(raw[0]).forEach(h => { lookup[norm(h)] = h })

  let skipped = 0
  const records = []
  raw.forEach(row => {
    const rec = {}
    STORE_COL_MAP.forEach(col => {
      const key = lookup[norm(col.src)]
      rec[col.dest] = key !== undefined ? col.parse(row[key]) : null
    })
    if (!rec.store_id) { skipped++; return }
    records.push(rec)
  })

  return { records, skipped, totalRows: raw.length }
}

// ── Perfect Store — Team Target parser ───────────────────────────────────────
const PS_SHEET = 'FY27 CYCLE 1 Team Target'

// [colIndex, destField, parseFn] — column M (index 12) skipped: generated column in Supabase
const PS_COL_MAP = [
  [0,  'state',            toStr  ],
  [1,  'location',         toStr  ],
  [2,  'store_id',         toStr  ],
  [3,  'store_name',       toStr  ],
  [4,  'classification',   toStr  ],
  [5,  'focus_store',      toStr  ],
  [6,  'distribution_pct', toFloat],
  [7,  'uht_core_gaps',    toInt  ],
  [8,  'uht_noncore_gaps', toInt  ],
  [9,  'chilled_opp',      toInt  ],
  [10, 'rtd_opp',          toInt  ],
  [11, 'yoghurt_opp',      toInt  ],
  [13, 'uht_sos',          toStr  ],
  [14, 'tup_previous',     toStr  ],
  [15, 'call_freq_target', toInt  ],
]

function parsePsTeamTarget(wb) {
  const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === PS_SHEET.toLowerCase())
  if (!sheetName) return { error: `Sheet "${PS_SHEET}" not found. Found: ${wb.SheetNames.join(', ')}` }

  // header:1 returns raw arrays; rows[0]=sheet row 1 (title), rows[1]=sheet row 2 (headers), rows[2+]=data
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null })
  const dataRows = rows.slice(2)
  if (!dataRows.length) return { error: `Sheet "${PS_SHEET}" has no data rows.` }

  let skipped = 0
  const records = []
  dataRows.forEach(row => {
    const storeIdRaw = row[2]
    if (storeIdRaw == null || storeIdRaw === '') { skipped++; return }
    const rec = {}
    PS_COL_MAP.forEach(([idx, dest, parse]) => {
      rec[dest] = parse(row[idx])
    })
    records.push(rec)
  })

  return { records, skipped, totalRows: dataRows.length }
}

// ── Perfect Store — Master sheet commercial parser ────────────────────────────
// Sheet: "FY27 Perfect Store " (trailing space — match by trim)
// Layout: rows 1-2 blank, row 3 header, data from row 4 → slice(3) zero-based
// Reads only columns 0-13 to avoid 16k phantom columns declared by Excel
const PS_MASTER_SHEET = 'FY27 Perfect Store'   // matched after trim()

const PS_MASTER_COL_MAP = [
  [1,  'cluster',               toStr  ],
  [6,  'mso',                   toStr  ],
  [7,  'banner',                toStr  ],
  [9,  'metcash_ranking',       toInt  ],
  [10, 'vitasoy_ranking',       toInt  ],
  [11, 'vitasoy_assumed_sales', toFloat],
  [12, 'gsv_potential',         toFloat],
  [13, 'catalogue_format',      toStr  ],
]

function parsePsMasterSheet(wb) {
  const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === PS_MASTER_SHEET.toLowerCase())
  if (!sheetName) {
    return { masterRecords: [], masterSkipped: 0, masterTotalRows: 0,
             masterError: `Sheet "${PS_MASTER_SHEET}" not found in this file.` }
  }

  // Bound to columns 0-13 before parsing to avoid iterating 16k phantom columns
  const ws = wb.Sheets[sheetName]
  const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1:N1')
  ref.e.c = Math.min(ref.e.c, 13)
  const bounded = { ...ws, '!ref': XLSX.utils.encode_range(ref) }

  const rows = XLSX.utils.sheet_to_json(bounded, { header: 1, defval: null })
  // rows[0-1] blank, rows[2] header, data from rows[3]
  const dataRows = rows.slice(3)
  if (!dataRows.length) {
    return { masterRecords: [], masterSkipped: 0, masterTotalRows: 0,
             masterError: `Sheet "${PS_MASTER_SHEET}" has no data rows.` }
  }

  let skipped = 0
  const records = []
  dataRows.forEach(row => {
    const storeIdRaw = row[4]
    if (storeIdRaw == null || storeIdRaw === '') { skipped++; return }
    const store_id = String(storeIdRaw).trim()
    if (!store_id) { skipped++; return }
    const rec = { store_id }
    PS_MASTER_COL_MAP.forEach(([idx, dest, parse]) => {
      rec[dest] = parse(row[idx])
    })
    records.push(rec)
  })

  return { masterRecords: records, masterSkipped: skipped, masterTotalRows: dataRows.length }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DataUpload() {
  const [activeTab, setActiveTab] = useState('store-key')
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

  function switchTab(tab) {
    setActiveTab(tab)
    reset()
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = evt => {
      if (activeTab === 'store-key') {
        const res = parseStoreFile(evt.target.result)
        if (res.error) { setErrMsg(res.error); setPhase('error'); return }
        if (!res.records.length) { setErrMsg('No valid rows found (all rows missing Store ID).'); setPhase('error'); return }
        setParseInfo(res)
      } else {
        const wb  = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' })
        const tt  = parsePsTeamTarget(wb)
        if (tt.error) { setErrMsg(tt.error); setPhase('error'); return }
        if (!tt.records.length) { setErrMsg('No valid rows found (all rows missing Store ID).'); setPhase('error'); return }
        const master = parsePsMasterSheet(wb)
        setParseInfo({ ...tt, ...master })
      }
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
    const { records, masterRecords } = parseInfo
    const total  = records.length
    const errors = []
    const table  = activeTab === 'store-key' ? 'stores' : 'perfect_store_v2'

    // ── Step 1: Team Target / Store Key upsert ────────────────────────────────
    for (let i = 0; i < total; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK)
      const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'store_id' })
      if (error) errors.push(error.message)
      setProgress(Math.round((Math.min(i + CHUNK, total) / total) * (masterRecords?.length ? 60 : 100)))
    }

    // ── Step 2: Master commercial upsert (Perfect Store only) ─────────────────
    let masterMatched = 0
    if (activeTab === 'perfect-store' && masterRecords?.length && !errors.length) {
      // Fetch existing store_ids to prevent ghost rows for unmatched ids
      const { data: existing } = await supabase.from('perfect_store_v2').select('store_id')
      const existingIds = new Set((existing || []).map(r => String(r.store_id)))
      const filtered = masterRecords.filter(r => existingIds.has(String(r.store_id)))
      masterMatched = filtered.length

      for (let i = 0; i < filtered.length; i += CHUNK) {
        const chunk = filtered.slice(i, i + CHUNK)
        const { error } = await supabase.from('perfect_store_v2').upsert(chunk, { onConflict: 'store_id' })
        if (error) errors.push(`Master: ${error.message}`)
        setProgress(60 + Math.round((Math.min(i + CHUNK, filtered.length) / filtered.length) * 40))
      }
    }

    setResult({ count: total, errors, masterMatched, masterTotal: masterRecords?.length ?? 0 })
    setPhase('done')
    logUpload({
      uploadType: activeTab === 'store-key' ? 'Store Key' : 'Perfect Store Pipeline',
      fileName,
      rowCount: total,
      storeCount: countDistinctStores(records),
      status: errors.length ? `failed: ${errors[0]}` : 'success',
    })
  }

  const isPs = activeTab === 'perfect-store'
  const preview3 = parseInfo?.records?.slice(0, 3).map(r => r.store_name).filter(Boolean)

  return (
    <div className="du-page">
      <div className="du-header">
        <h1 className="du-title">{isPs ? 'Perfect Store Pipeline Upload' : 'Store Key Upload'}</h1>
        <p className="du-sub">
          {isPs ? 'Upserts into perfect_store_v2. Admin only.' : 'One-time upload. Only redo if stores change.'}
        </p>
      </div>

      <div className="du-tabs">
        <button
          className={`du-tab${activeTab === 'store-key' ? ' du-tab-active' : ''}`}
          onClick={() => switchTab('store-key')}
        >
          Store Key
        </button>
        <button
          className={`du-tab${activeTab === 'perfect-store' ? ' du-tab-active' : ''}`}
          onClick={() => switchTab('perfect-store')}
        >
          Perfect Store Pipeline
        </button>
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
            <div className="du-drop-hint">
              Sheet: <code>{isPs ? PS_SHEET : STORE_SHEET}</code>
            </div>
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
              <div><strong>{parseInfo.records.length.toLocaleString()}</strong> rows ready to upload (Team Target)</div>
              {parseInfo.skipped > 0 && (
                <div className="du-warn">⚠ {parseInfo.skipped} rows skipped (no Store ID)</div>
              )}
              {isPs && parseInfo.masterRecords?.length > 0 && (
                <div>+ <strong>{parseInfo.masterRecords.length.toLocaleString()}</strong> commercial records from Master sheet</div>
              )}
              {isPs && parseInfo.masterError && (
                <div className="du-warn">⚠ Master sheet: {parseInfo.masterError}</div>
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
                <strong>✅ Done!</strong>{' '}
                {result.count.toLocaleString()} {isPs ? 'stores uploaded to Perfect Store Pipeline' : 'stores uploaded'}.
                {isPs && result.masterTotal > 0 && (
                  <span> · {result.masterMatched.toLocaleString()}/{result.masterTotal.toLocaleString()} commercial records matched and saved.</span>
                )}
                <button className="du-link" onClick={reset}>Upload another file</button>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
