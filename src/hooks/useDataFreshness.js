import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function useDataFreshness() {
  const [dates, setDates] = useState({ bnb26: null, bnb13: null, dis: null })

  useEffect(() => {
    async function load() {
      const [r26, r13, rDis] = await Promise.all([
        supabase.from('bnb_26wk').select('uploaded_at').order('uploaded_at', { ascending: false }).limit(1),
        supabase.from('bnb_13wk').select('uploaded_at').order('uploaded_at', { ascending: false }).limit(1),
        supabase.from('store_distribution').select('uploaded_at').order('uploaded_at', { ascending: false }).limit(1),
      ])
      setDates({
        bnb26: fmtDate(r26.data?.[0]?.uploaded_at),
        bnb13: fmtDate(r13.data?.[0]?.uploaded_at),
        dis:   fmtDate(rDis.data?.[0]?.uploaded_at),
      })
    }
    load()
  }, [])

  return dates
}
