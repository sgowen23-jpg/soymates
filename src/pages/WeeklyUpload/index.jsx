import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useClient } from '../../context/ClientContext'
import './WeeklyUpload.css'

const CHUNK = 200

const VALID_STATES = new Set(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'])
const bnbStateFilter = rows => rows.filter(r => VALID_STATES.has(r.state))

// ── Coerce helpers ────────────────────────────────────────────────────────────

const toInt   = v => { if (v == null || v === '') return null; const n = parseInt(v, 10); return isNaN(n) ? null : n }
const toFloat = v => { if (v == null || v === '') return null; const n = parseFloat(v);   return isNaN(n) ? null : n }
const toStr   = v => (v == null || v === '') ? null : String(v).trim()

// Parse DD/MM/YYYY or any date Excel gives us → YYYY-MM-DD string
const toDate  = v => {
  if (v == null || v === '') return null
  // If xlsx gave us a JS Date object (numeric serial), format directly
  if (v instanceof Date) {
    const y = v.getFullYear(), m = String(v.getMonth()+1).padStart(2,'0'), d = String(v.getDate()).padStart(2,'0')
    return `${y}-${m}-${d}`
  }
  const s = String(v).trim()
  if (!s) return null
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  // YYYY-MM-DD passthrough
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

// Reject null / non-numeric strings (footer/total rows guard)
const isNumericStr = v => { if (v == null || v === '') return false; return !isNaN(parseFloat(String(v).trim())) }

// ── Column maps ───────────────────────────────────────────────────────────────

// srcs lists accepted header aliases: old xlsx export first, new CSV export second.
// Matching is trim + lowercase, so headers differing only by case need no alias
// (e.g. 'State' already matches 'STATE'). rep_name is no longer read from the
// file — it is derived from the stores table at upload time (deriveRepName).
// store_region is absent from the new CSV export, so it is optional (null when missing).
// New-export-only columns BANNER, POG, IN UNIVERSE, STORE COUNT are deliberately unmapped.
const BNB_COLS = [
  { srcs: ['State'],                                     dest: 'state',                   parse: toStr,   required: true },
  { srcs: ['Store Region'],                              dest: 'store_region',            parse: toStr                   },
  { srcs: ['Store Name'],                                dest: 'store_name',              parse: toStr,   required: true },
  { srcs: ['Store ID'],                                  dest: 'store_id',                parse: toInt,   required: true },
  { srcs: ['MSO'],                                       dest: 'mso',                     parse: toStr,   required: true },
  { srcs: ['Item Name'],                                 dest: 'item_name',               parse: toStr,   required: true },
  { srcs: ['Item ID'],                                   dest: 'item_id',                 parse: toInt,   required: true },
  { srcs: ['POG Category'],                              dest: 'pog_category',            parse: toStr,   required: true },
  { srcs: ['Count of Ranging', 'COUNT RANGING'],         dest: 'count_of_ranging',        parse: toInt,   required: true },
  { srcs: ['Sum of Ranging', 'SUM RANGING'],             dest: 'sum_of_ranging',          parse: toInt,   required: true },
  { srcs: ['Distribution Percentage', 'DISTRIBUTION %'], dest: 'distribution_percentage', parse: toFloat, required: true },
  { srcs: ['Ranging Gap'],                               dest: 'ranging_gap',             parse: toInt,   required: true },
  { srcs: ['To Target Percentage', 'TO TARGET %'],       dest: 'to_target_percentage',    parse: toFloat, required: true },
  { srcs: ['Buy Rate Latest'],                           dest: 'buy_rate_latest',         parse: toFloat, required: true },
]

const DIST_COLS = [
  { src: 'RepName',             dest: 'rep_name',           parse: toStr   },
  { src: 'Location ID',         dest: 'location_id',        parse: toInt   },
  { src: 'Store Name',          dest: 'store_name',         parse: toStr   },
  { src: 'State',               dest: 'state',              parse: toStr   },
  { src: 'Banner Group',        dest: 'banner_group',       parse: toStr   },
  { src: 'Code',                dest: 'item_code',          parse: toStr   },
  { src: 'Name',                dest: 'item_name',          parse: toStr   },
  { src: 'Latest Distribution', dest: 'latest_distribution',parse: toInt   },
  { src: 'Total Gains (Gross)', dest: 'total_gains_gross',  parse: toFloat },
  { src: 'Total Losses',        dest: 'total_losses',       parse: toFloat },
  { src: 'Total Net Gains',     dest: 'total_net_gains',    parse: toFloat },
  { src: 'Movement Type',       dest: 'movement_type',      parse: toStr   },
]

// ── Column map — Store Contacts ───────────────────────────────────────────────

const CONTACTS_COLS = [
  { src: 'Store ID',            dest: 'store_id',        parse: toInt  },
  { src: 'Store ID (26)',       dest: 'store_id_26',     parse: toInt  },
  { src: 'Location ID (Dist)',  dest: 'location_id_dist',parse: toInt  },
  { src: 'Metcash ID',          dest: 'metcash_id',      parse: toStr  },
  { src: 'Store Name',          dest: 'store_name',      parse: toStr  },
  { src: 'Store Name Clean',    dest: 'store_name_clean',parse: toStr  },
  { src: 'State',               dest: 'state',           parse: toStr  },
  { src: 'Classification',      dest: 'classification',  parse: toStr  },
  { src: 'Banner',              dest: 'banner',          parse: toStr  },
  { src: 'MSO',                 dest: 'mso',             parse: toStr  },
  { src: 'Rep Name',            dest: 'rep_name',        parse: toStr  },
  { src: 'Role',                dest: 'role',            parse: toStr  },
  { src: 'Contact Name',        dest: 'contact_name',    parse: toStr  },
  { src: 'Contact Phone',       dest: 'contact_phone',   parse: toStr  },
  { src: 'Contact Email',       dest: 'contact_email',   parse: toStr  },
  { src: 'Notes',               dest: 'notes',           parse: toStr  },
  { src: 'Match Score',         dest: 'match_score',     parse: toInt  },
]

// ── Column map — Store Visits (TaskStatus export) ─────────────────────────────
// Mirrors import_store_visits.py exactly. Header is on row 1 (row 0 is blank).

const VISITS_COLS = [
  { src: 'Schedule ID',        dest: 'schedule_id',          parse: toInt   },
  { src: 'SchedulePeople ID',  dest: 'schedule_people_id',   parse: toInt   },
  { src: 'Location No',        dest: 'location_no',          parse: toInt   },
  { src: 'Company Name',       dest: 'store_name',           parse: toStr   },
  { src: 'Region',             dest: 'state',                parse: toStr   },
  { src: 'Group Name',         dest: 'group_name',           parse: toStr   },
  { src: 'Rep',                dest: 'rep',                  parse: toStr   },
  { src: 'Cycle',              dest: 'cycle',                parse: toStr   },
  { src: 'Schedule State',     dest: 'schedule_state',       parse: toStr   },
  { src: 'Date Schedule',      dest: 'date_scheduled',       parse: toDate  },
  { src: 'WorkType',           dest: 'work_type',            parse: toStr   },
  { src: 'Schedule Type',      dest: 'schedule_type',        parse: toStr   },
  { src: 'Budgeted Duration',  dest: 'budgeted_duration',    parse: toInt   },
  { src: 'Reported Minutes',   dest: 'actual_duration',      parse: toInt   },
  { src: 'Timer Minutes',      dest: 'timer_minutes',        parse: toInt   },
  { src: 'KMs',                dest: 'kms',                  parse: toFloat },
  { src: 'Forms',              dest: 'forms',                parse: toInt   },
  { src: 'Photos',             dest: 'photos',               parse: toInt   },
  { src: 'Schedule Comment',   dest: 'schedule_comment',     parse: toStr   },
  { src: 'Manager Comment',    dest: 'manager_comment',      parse: toStr   },
]

// ── Parser ────────────────────────────────────────────────────────────────────

function parseSheet(arrayBuffer, sheetTarget, colMap, { singleSheetFallback = false } = {}) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  // A CSV parses as a single sheet (named "Sheet1"), so when enabled a
  // one-sheet workbook is used regardless of name; otherwise match by name.
  const sheetName = (singleSheetFallback && wb.SheetNames.length === 1)
    ? wb.SheetNames[0]
    : wb.SheetNames.find(n => n.trim().toLowerCase() === sheetTarget.toLowerCase())
  if (!sheetName) return { error: `Sheet "${sheetTarget}" not found. Found: ${wb.SheetNames.join(', ')}` }

  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })
  if (!raw.length) return { error: `Sheet "${sheetName}" is empty.` }

  const norm = h => String(h).trim().toLowerCase()
  const lookup = {}
  Object.keys(raw[0]).forEach(h => { lookup[norm(h)] = h })

  // Resolve each column's file header via its alias list ({ srcs: [...] } or legacy { src })
  const keyByDest = {}
  colMap.forEach(col => {
    const srcs = col.srcs ?? [col.src]
    keyByDest[col.dest] = srcs.map(s => lookup[norm(s)]).find(k => k !== undefined)
  })

  const missing = colMap.filter(col => col.required && keyByDest[col.dest] === undefined)
  if (missing.length) {
    const names = missing.map(col => (col.srcs ?? [col.src]).join(' / ')).join(', ')
    return { error: `Missing required headers: ${names}. Nothing was uploaded.` }
  }

  const records = raw.map(row => {
    const rec = {}
    colMap.forEach(col => {
      const key = keyByDest[col.dest]
      rec[col.dest] = key !== undefined ? col.parse(row[key]) : null
    })
    return rec
  })

  return { records, sheetName, totalRows: raw.length }
}

// TaskStatus exports have a blank row 0; real header is row 1.
// Parse the first sheet regardless of its name.
function parseVisitsSheet(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { error: 'No sheets found in workbook.' }

  // Read with header:1 offset — skip first row (blank), use second row as headers
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, range: 1 })
  if (!raw.length) return { error: 'No data rows found (sheet may be empty).' }

  const norm = h => String(h).trim().toLowerCase()
  const lookup = {}
  Object.keys(raw[0]).forEach(h => { lookup[norm(h)] = h })

  const rejected = []
  const records = []

  raw.forEach((row, i) => {
    const rawId  = lookup[norm('Schedule ID')]  !== undefined ? row[lookup[norm('Schedule ID')]]  : null
    const rawLoc = lookup[norm('Location No')]  !== undefined ? row[lookup[norm('Location No')]]  : null
    if (!isNumericStr(rawId) || !isNumericStr(rawLoc)) {
      rejected.push(i)
      return
    }
    const rec = {}
    VISITS_COLS.forEach(col => {
      const key = lookup[norm(col.src)]
      rec[col.dest] = key !== undefined ? col.parse(row[key]) : null
    })
    records.push(rec)
  })

  return { records, sheetName, totalRows: raw.length, rejected: rejected.length }
}

// ── Uploader component ────────────────────────────────────────────────────────

function Uploader({ label, description, sheetName = 'Export', colMap, table, deleteQuery, onSuccess, client, rowFilter, customParser, upsertMode, upsertKey, acceptCsv, deriveRepName }) {
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
      const res = customParser
        ? customParser(evt.target.result)
        : parseSheet(evt.target.result, sheetName, colMap, { singleSheetFallback: acceptCsv })
      if (res.error) { setErrMsg(res.error); setPhase('error'); return }
      if (!res.records.length) { setErrMsg('No valid rows found after parsing.'); setPhase('error'); return }
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

    // rep_name is not trusted from the file — derive it from the stores table.
    // Fetched before the delete so a failed lookup never wipes existing data.
    let repByStoreId = null
    if (deriveRepName) {
      repByStoreId = new Map()
      let from = 0
      while (true) {
        const { data, error: repErr } = await supabase
          .from('stores')
          .select('store_id, rep_name')
          .range(from, from + 999)
        if (repErr) {
          setErrMsg(`Could not load rep names from stores: ${repErr.message}`)
          setPhase('error')
          return
        }
        if (!data || data.length === 0) break
        data.forEach(s => repByStoreId.set(String(s.store_id), s.rep_name ?? null))
        if (data.length < 1000) break
        from += 1000
      }
    }

    if (!upsertMode) {
      const { error: delErr } = await deleteQuery()
      if (delErr) {
        setErrMsg(`Delete failed: ${delErr.message}`)
        setPhase('error')
        return
      }
    }

    let records = rowFilter ? rowFilter(parseInfo.records) : parseInfo.records
    if (repByStoreId) {
      records = records.map(r => ({
        ...r,
        rep_name: repByStoreId.get(String(r.store_id)) ?? null,
      }))
    }
    const total = records.length
    const errors = []
    const uploadedAt = new Date().toISOString()

    for (let i = 0; i < total; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK)
      const stamped = upsertMode
        ? chunk.map(r => ({ ...r, uploaded_at: uploadedAt }))
        : chunk.map(r => ({ ...r, client, uploaded_at: uploadedAt }))
      const { error } = upsertMode
        ? await supabase.from(table).upsert(stamped, { onConflict: upsertKey })
        : await supabase.from(table).insert(stamped)
      if (error) errors.push(error.message)
      setProgress(Math.round((Math.min(i + CHUNK, total) / total) * 100))
    }

    setResult({ count: total, errors, rejected: parseInfo.rejected })
    setPhase('done')
    if (!errors.length && onSuccess) await onSuccess()
  }

  const preview3 = parseInfo?.records?.slice(0, 3).map(r => r.store_name).filter(Boolean)

  return (
    <div className="wu-card">
      <div className="wu-card-label">{label}</div>
      <div className="wu-card-meta">Sheet: <code>{sheetName}</code> → <code>{table}</code></div>
      {description && <div className="wu-card-desc">{description}</div>}

      {phase === 'idle' && (
        <div
          className="wu-drop"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current.click()}
        >
          <span className="wu-drop-icon">📂</span>
          <span className="wu-drop-text">Drop {acceptCsv ? '.xlsx or .csv' : '.xlsx'} or click to browse</span>
          <input ref={fileRef} type="file" accept={acceptCsv ? '.xlsx,.csv' : '.xlsx'} style={{ display: 'none' }} onChange={handleFile} />
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
            <div className="wu-file-name">{fileName}</div>
            <div className="wu-card-meta">Sheet detected: <code>{parseInfo.sheetName}</code></div>
            <div className="wu-row-count">{parseInfo.records.length.toLocaleString()} rows</div>
            {preview3?.length > 0 && (
              <div className="wu-preview-names">First {preview3.length}: {preview3.join(' · ')}</div>
            )}
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
              <strong>✅ Done!</strong> {result.count.toLocaleString()} rows {upsertMode ? 'upserted' : 'inserted'}{result.rejected > 0 ? ` · ${result.rejected} rejected (corrupt/footer rows)` : ''}.
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
  const { client, setClient } = useClient()

  return (
    <div className="wu-page">
      <div className="wu-header">
        <div className="wu-header-top">
          <h1 className="wu-title">Weekly Data Upload</h1>
          <div className="toolbar-client-switcher" data-client={client}>
            <button
              className={`toolbar-client-btn ${client === 'vitasoy' ? 'active' : ''}`}
              onClick={() => setClient('vitasoy')}
            >Vitasoy</button>
            <button
              className={`toolbar-client-btn ${client === 'beiersdorf' ? 'active' : ''}`}
              onClick={() => setClient('beiersdorf')}
            >Beiersdorf</button>
          </div>
        </div>
        <p className="wu-sub">Upload all files each week.</p>
      </div>

      <div className="wu-grid">
        <Uploader
          label="26 Week Buy Not Buy"
          colMap={BNB_COLS}
          table="bnb_26wk"
          client={client}
          acceptCsv
          deriveRepName
          rowFilter={bnbStateFilter}
          deleteQuery={() => supabase.from('bnb_26wk').delete().eq('client', client)}
          onSuccess={async () => {
            await supabase.rpc('sync_perfect_store_v2')
            await supabase.rpc('sync_perfect_store_ranging')
          }}
        />
        <Uploader
          label="13 Week Buy Not Buy"
          colMap={BNB_COLS}
          table="bnb_13wk"
          client={client}
          acceptCsv
          deriveRepName
          rowFilter={bnbStateFilter}
          deleteQuery={() => supabase.from('bnb_13wk').delete().eq('client', client)}
        />
        <Uploader
          label="Distribution"
          colMap={DIST_COLS}
          table="store_distribution"
          client={client}
          deleteQuery={() => supabase.from('store_distribution').delete().eq('client', client)}
        />
        <Uploader
          label="Store Visits (TaskStatus)"
          description="Upload the weekly TaskStatus export. Upserts on schedule_id — safe to re-upload the same file."
          customParser={parseVisitsSheet}
          table="store_visits"
          upsertMode
          upsertKey="schedule_id"
          deleteQuery={() => Promise.resolve({ error: null })}
        />
        <Uploader
          label="Store Contacts"
          description="Upload the In Territory sheet from StoreContacts master file."
          sheetName="In Territory"
          colMap={CONTACTS_COLS}
          table="store_contacts"
          deleteQuery={() => supabase.from('store_contacts').delete().gte('id', 0)}
        />
      </div>
    </div>
  )
}
