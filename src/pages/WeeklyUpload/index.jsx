import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import './WeeklyUpload.css'

const CHUNK = 200

// ── Column definitions ────────────────────────────────────────────────────────

const BNB_COLS = [
  { src: 'Store ID',               dest: 'store_id',               required: true,  type: 'int' },
  { src: 'Item ID',                dest: 'item_id',                 required: true,  type: 'int' },
  { src: 'Store Name',             dest: 'store_name',              required: false, type: 'str' },
  { src: 'State',                  dest: 'state',                   required: false, type: 'str' },
  { src: 'Store Region',           dest: 'store_region',            required: false, type: 'str' },
  { src: 'MSO',                    dest: 'mso',                     required: false, type: 'str' },
  { src: 'Rep Name',               dest: 'rep_name',                required: false, type: 'str' },
  { src: 'Item Name',              dest: 'item_name',               required: false, type: 'str' },
  { src: 'POG Category',           dest: 'pog_category',            required: false, type: 'str' },
  { src: 'Count of Ranging',       dest: 'count_of_ranging',        required: false, type: 'num' },
  { src: 'Sum of Ranging',         dest: 'sum_of_ranging',          required: false, type: 'num' },
  { src: 'Distribution Percentage',dest: 'distribution_percentage', required: false, type: 'num' },
  { src: 'Ranging Gap',            dest: 'ranging_gap',             required: false, type: 'num' },
  { src: 'To Target Percentage',   dest: 'to_target_percentage',    required: false, type: 'num' },
  { src: 'Buy Rate Latest',        dest: 'buy_rate_latest',         required: false, type: 'num' },
]

// Distribution unpivot metadata columns (row 4 = header in Sheet1)
const DIS_META_COLS = ['State', 'Store Name', 'RepName', 'Location ID']

// ── Helpers ───────────────────────────────────────────────────────────────────

function coerce(val, type) {
  if (val === null || val === undefined || val === '') return null
  if (type === 'int') { const n = parseInt(val, 10); return isNaN(n) ? null : n }
  if (type === 'num') { const n = parseFloat(val);   return isNaN(n) ? null : n }
  return String(val).trim()
}

function findSheetCI(sheetName, workbook) {
  // Case-insensitive sheet finder
  const name = workbook.SheetNames.find(
    n => n.trim().toLowerCase() === sheetName.toLowerCase()
  )
  return name || null
}

// BNB: read "Export" sheet, map columns, return records + error string
function parseBnbFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const exportName = findSheetCI('Export', wb)
  if (!exportName) {
    const found = wb.SheetNames.join(', ')
    return { error: `Sheet "Export" not found. Sheets in file: ${found}` }
  }
  const ws = wb.Sheets[exportName]
  const raw = XLSX.utils.sheet_to_json(ws, { defval: null })
  if (!raw.length) return { error: 'Export sheet is empty.' }

  // Normalise source headers (trim + lowercase for matching)
  const srcHeaders = Object.keys(raw[0])
  const norm = h => h.trim().toLowerCase()

  // Build header map: dest_col → actual_src_header
  const headerMap = {}
  const missing = []
  BNB_COLS.forEach(col => {
    const match = srcHeaders.find(h => norm(h) === norm(col.src))
    if (match) headerMap[col.src] = match
    else if (col.required) missing.push(col.src)
  })
  if (missing.length) return { error: `Required columns missing: ${missing.join(', ')}` }

  const records = raw.map(row => {
    const rec = {}
    BNB_COLS.forEach(col => {
      const srcHeader = headerMap[col.src]
      rec[col.dest] = srcHeader ? coerce(row[srcHeader], col.type) : null
    })
    return rec
  }).filter(r => r.store_id !== null && r.item_id !== null)

  return { records, sheetUsed: exportName, totalRows: raw.length }
}

// Distribution: read "Sheet1", treat row index 3 (0-based) as header (row 4 in Excel)
// Unpivot product columns → one record per store × product
function parseDistributionFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })

  // Find Sheet1 (case-insensitive)
  const sheet1Name = findSheetCI('Sheet1', wb)
  if (!sheet1Name) {
    const found = wb.SheetNames.join(', ')
    return { error: `Sheet "Sheet1" not found. Sheets in file: ${found}` }
  }

  const ws = wb.Sheets[sheet1Name]
  // Read with header:1 to get raw arrays, then we pick row 3 (0-based) as header
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  if (raw.length < 5) return { error: 'Sheet1 has fewer than 5 rows — cannot find header at row 4.' }

  const headerRow = raw[3]  // Row 4 (0-indexed: 3)
  const dataRows  = raw.slice(4)

  // Identify meta column indices and product column indices
  const normMeta = DIS_META_COLS.map(m => m.trim().toLowerCase())
  const metaIdx  = {}
  const prodCols = [] // { name, colIdx }

  // Columns to skip (not products)
  const SKIP_COLS = new Set(['grand total'])

  headerRow.forEach((h, i) => {
    if (h === null || h === undefined) return
    const hn = String(h).trim()
    const normH = hn.toLowerCase()
    if (normMeta.includes(normH)) {
      // Map "Location ID" → store_id; "RepName" → rep_name; others as-is
      metaIdx[normH] = i
    } else if (hn.length > 0 && !SKIP_COLS.has(normH)) {
      prodCols.push({ name: hn, colIdx: i })
    }
  })

  // Required meta: Location ID
  const locIdx = metaIdx['location id']
  if (locIdx === undefined) {
    return { error: 'Column "Location ID" not found in row 4 of Sheet1.' }
  }
  if (!prodCols.length) {
    return { error: 'No product columns found in row 4 of Sheet1 (after meta columns).' }
  }

  // Unpivot: one record per store × product
  const records = []
  let skippedNoId = 0

  dataRows.forEach(row => {
    const rawLocId = row[locIdx]
    const storeId = rawLocId !== null && rawLocId !== undefined
      ? parseInt(String(rawLocId).trim(), 10)
      : null
    if (!storeId || isNaN(storeId)) { skippedNoId++; return }

    const storeName = metaIdx['store name'] !== undefined ? (row[metaIdx['store name']] ?? null) : null
    const state     = metaIdx['state']      !== undefined ? (row[metaIdx['state']]      ?? null) : null
    const repName   = metaIdx['repname']    !== undefined ? (row[metaIdx['repname']]    ?? null) : null

    prodCols.forEach(({ name, colIdx }) => {
      const raw = row[colIdx]
      const dist = (raw !== null && raw !== undefined) ? parseFloat(raw) : null
      records.push({
        store_id:     storeId,
        store_name:   storeName ? String(storeName).trim() : null,
        state:        state     ? String(state).trim()     : null,
        rep_name:     repName   ? String(repName).trim()   : null,
        item_name:    name,
        distribution: isNaN(dist) ? null : dist,
      })
    })
  })

  return {
    records,
    sheetUsed: sheet1Name,
    totalRows: dataRows.length,
    productCols: prodCols.length,
    skippedNoId,
  }
}

// Upload records in batches, upsert on conflict
async function uploadBatches(table, records, conflictCols, onProgress) {
  let done = 0
  const total = records.length
  const errors = []

  for (let i = 0; i < total; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK)
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: conflictCols })
    if (error) errors.push(error.message)
    done = Math.min(i + CHUNK, total)
    onProgress(Math.round((done / total) * 100))
  }
  return errors
}

// ── Sub-uploader component ────────────────────────────────────────────────────

function Uploader({ title, description, icon, table, conflictCols, parseFile, sheetSpec, accept = '.xlsx' }) {
  const [phase,     setPhase]     = useState('idle')   // idle | parsed | uploading | done | error
  const [fileName,  setFileName]  = useState('')
  const [parseInfo, setParseInfo] = useState(null)     // { records, sheetUsed, totalRows, ... }
  const [progress,  setProgress]  = useState(0)
  const [result,    setResult]    = useState(null)     // { inserted, errors }
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
    setErrMsg('')
    const reader = new FileReader()
    reader.onload = evt => {
      const result = parseFile(evt.target.result)
      if (result.error) {
        setErrMsg(result.error)
        setPhase('error')
        return
      }
      if (!result.records?.length) {
        setErrMsg('No valid records found after parsing.')
        setPhase('error')
        return
      }
      setParseInfo(result)
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
    const errors = await uploadBatches(
      table,
      parseInfo.records,
      conflictCols,
      pct => setProgress(pct)
    )
    setResult({ inserted: parseInfo.records.length, errors })
    setPhase('done')
  }

  // Preview: first 5 records as formatted JSON lines
  const preview = parseInfo?.records?.slice(0, 5)

  return (
    <div className="wu-card">
      <div className="wu-card-header">
        <span className="wu-icon">{icon}</span>
        <div>
          <h3 className="wu-card-title">{title}</h3>
          <p className="wu-card-desc">{description}</p>
        </div>
      </div>

      <div className="wu-sheet-spec">
        <span className="wu-spec-label">Expected sheet:</span>
        <code className="wu-spec-code">{sheetSpec}</code>
      </div>

      {/* Idle: drop zone */}
      {phase === 'idle' && (
        <div
          className="wu-drop"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current.click()}
        >
          <span className="wu-drop-icon">📂</span>
          <span className="wu-drop-text">Drop .xlsx or click to browse</span>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={handleFile}
          />
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="wu-alert wu-alert-error">
          <strong>❌ Parse error</strong><br />{errMsg}
          <button className="wu-link-btn" onClick={reset}>Try again</button>
        </div>
      )}

      {/* Parsed: show summary + preview */}
      {phase === 'parsed' && parseInfo && (
        <>
          <div className="wu-alert wu-alert-info">
            <strong>✅ File parsed:</strong> {fileName}<br />
            Sheet used: <code>{parseInfo.sheetUsed}</code><br />
            Source rows: {parseInfo.totalRows?.toLocaleString()}<br />
            Records to upload: <strong>{parseInfo.records.length.toLocaleString()}</strong>
            {parseInfo.productCols != null && <><br />Product columns unpivoted: {parseInfo.productCols}</>}
            {parseInfo.skippedNoId > 0 && <><br /><span className="wu-warn">⚠ {parseInfo.skippedNoId} rows skipped (no Store ID)</span></>}
          </div>

          <div className="wu-preview-wrap">
            <div className="wu-preview-title">Preview (first 5 records)</div>
            <div className="wu-preview-scroll">
              <table className="wu-preview-table">
                <thead>
                  <tr>
                    {Object.keys(preview[0]).map(k => <th key={k}>{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => (
                        <td key={j}>{v === null ? <span className="wu-null">null</span> : String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="wu-actions">
            <button className="wu-btn-secondary" onClick={reset}>Cancel</button>
            <button className="wu-btn-primary" onClick={handleUpload}>
              Upload {parseInfo.records.length.toLocaleString()} records → {table}
            </button>
          </div>
        </>
      )}

      {/* Uploading */}
      {phase === 'uploading' && (
        <div className="wu-uploading">
          <div className="wu-progress-wrap">
            <div className="wu-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <span className="wu-progress-label">Uploading… {progress}%</span>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && result && (
        <>
          {result.errors.length === 0 ? (
            <div className="wu-alert wu-alert-success">
              <strong>✅ Upload complete</strong><br />
              {result.inserted.toLocaleString()} records upserted into <code>{table}</code>
            </div>
          ) : (
            <div className="wu-alert wu-alert-error">
              <strong>⚠ Completed with errors</strong><br />
              {result.inserted.toLocaleString()} records attempted.<br />
              {result.errors.length} batch(es) failed: {result.errors[0]}
            </div>
          )}
          <div className="wu-actions">
            <button className="wu-btn-primary" onClick={reset}>Upload Another File</button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SQL_SETUP = `-- Run this once in Supabase SQL Editor to create the required tables

create table if not exists bnb_13wk (
  id                      bigserial primary key,
  store_id                integer not null,
  item_id                 integer not null,
  store_name              text,
  state                   text,
  store_region            text,
  mso                     text,
  rep_name                text,
  item_name               text,
  pog_category            text,
  count_of_ranging        numeric,
  sum_of_ranging          numeric,
  distribution_percentage numeric,
  ranging_gap             numeric,
  to_target_percentage    numeric,
  buy_rate_latest         numeric,
  uploaded_at             timestamptz default now(),
  unique (store_id, item_id)
);

create table if not exists bnb_26wk (
  id                      bigserial primary key,
  store_id                integer not null,
  item_id                 integer not null,
  store_name              text,
  state                   text,
  store_region            text,
  mso                     text,
  rep_name                text,
  item_name               text,
  pog_category            text,
  count_of_ranging        numeric,
  sum_of_ranging          numeric,
  distribution_percentage numeric,
  ranging_gap             numeric,
  to_target_percentage    numeric,
  buy_rate_latest         numeric,
  uploaded_at             timestamptz default now(),
  unique (store_id, item_id)
);

create table if not exists store_distribution (
  id           bigserial primary key,
  store_id     integer not null,
  store_name   text,
  state        text,
  rep_name     text,
  item_name    text not null,
  distribution numeric,
  uploaded_at  timestamptz default now(),
  unique (store_id, item_name)
);

-- Enable RLS (required for Supabase PostgREST)
alter table bnb_13wk         enable row level security;
alter table bnb_26wk         enable row level security;
alter table store_distribution enable row level security;

-- Allow authenticated users to read and write
create policy "auth read bnb_13wk"         on bnb_13wk         for all to authenticated using (true) with check (true);
create policy "auth read bnb_26wk"         on bnb_26wk         for all to authenticated using (true) with check (true);
create policy "auth read store_distribution" on store_distribution for all to authenticated using (true) with check (true);`

function SqlSetup() {
  const [open, setOpen] = useState(false)
  return (
    <div className="wu-sql-block">
      <button className="wu-sql-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▲' : '▼'} First time? Run this SQL in Supabase to create the tables
      </button>
      {open && (
        <pre className="wu-sql-pre">{SQL_SETUP}</pre>
      )}
    </div>
  )
}

export default function WeeklyUpload() {
  return (
    <div className="wu-page">
      <div className="wu-page-header">
        <h1 className="wu-page-title">Weekly Data Upload</h1>
        <p className="wu-page-sub">
          Upload your weekly source files. Each uploader handles one file type independently.
          Matching uses <strong>Store ID + Item ID</strong> only — no name matching.
        </p>
      </div>

      <SqlSetup />

      <div className="wu-uploaders">

        {/* ── 13wk BNB ── */}
        <Uploader
          title="13 Week Buy Not Buy"
          description="Upload the weekly 13wk BNB report. Uses the Export sheet. Matched by Store ID + Item ID."
          icon="📊"
          table="bnb_13wk"
          conflictCols="store_id,item_id"
          parseFile={parseBnbFile}
          sheetSpec='Export (row 1 = headers)'
        />

        {/* ── 26wk BNB ── */}
        <Uploader
          title="26 Week Buy Not Buy"
          description="Upload the weekly 26wk BNB report. Uses the Export sheet. Matched by Store ID + Item ID."
          icon="📈"
          table="bnb_26wk"
          conflictCols="store_id,item_id"
          parseFile={parseBnbFile}
          sheetSpec='Export (row 1 = headers)'
        />

        {/* ── Distribution ── */}
        <Uploader
          title="Distribution"
          description="Upload the weekly Distribution report. Uses Sheet1 with row 4 as headers. Product columns are unpivoted into store × product records. Location ID is treated as Store ID."
          icon="🏪"
          table="store_distribution"
          conflictCols="store_id,item_name"
          parseFile={parseDistributionFile}
          sheetSpec='Sheet1 (row 4 = headers, columns: State, Store Name, RepName, Location ID, then product columns)'
        />

      </div>
    </div>
  )
}
