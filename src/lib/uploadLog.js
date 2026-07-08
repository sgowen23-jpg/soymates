import { supabase } from './supabase'

// Best-effort insert into upload_logs. A failed log write must never break
// the upload itself, so all errors are swallowed with a console.warn.
export async function logUpload({ client = null, uploadType, fileName, rowCount = 0, storeCount = null, status, notes = null }) {
  try {
    const { error } = await supabase.from('upload_logs').insert({
      client,
      upload_type: uploadType,
      file_name: fileName,
      row_count: rowCount,
      store_count: storeCount,
      status: String(status).slice(0, 200),
      notes,
    })
    if (error) console.warn('upload_logs insert failed:', error.message)
  } catch (err) {
    console.warn('upload_logs insert failed:', err)
  }
}

// Each uploader identifies stores by one of these fields.
const STORE_KEY_FIELDS = ['store_id', 'location_id', 'location_no']

export function countDistinctStores(records) {
  if (!records?.length) return null
  const field = STORE_KEY_FIELDS.find(f => f in records[0])
  if (!field) return null
  const ids = new Set()
  records.forEach(r => { if (r[field] != null) ids.add(r[field]) })
  return ids.size
}
