// Supabase caps each request at 1,000 rows. These helpers page through
// results so large tables (e.g. the ~2,200-store Metcash universe) load fully.

// buildQuery: () => a fresh supabase query (without .range)
export async function fetchAllRows(buildQuery, pageSize = 1000) {
  let all = [], from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

// Runs fetchAllRows over `ids` in chunks so `.in(column, ids)` never builds a
// URL too long for the API. buildQuery: (idChunk) => supabase query
export async function fetchAllRowsIn(ids, buildQuery, chunkSize = 300) {
  let all = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    all = all.concat(await fetchAllRows(() => buildQuery(chunk)))
  }
  return all
}
