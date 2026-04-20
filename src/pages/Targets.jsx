import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { CURRENT_CYCLE } from '../constants'
import './Targets.css'

const REPS = ['Sam Gowen', 'Ashleigh Tasdarian', 'David Kerr', 'Dipen Surani', 'Shane Vandewardt']

const CATEGORIES = [
  { key: 'BEVERAGES - MILK & CREAM LONG LIFE', label: 'UHT' },
  { key: 'DAIRY - SPECIALTY & FLAVOURED MILK',  label: 'Chilled' },
  { key: 'DAIRY - YOGHURTS & DESSERTS',          label: 'Yoghurt' },
]

const CYCLE_START = '2026-03-20'

function gainColor(actual, target) {
  if (actual >= target) return '#16a085'
  if (actual >= target * 0.8) return '#e67e22'
  return '#CC0000'
}

export default function Targets() {
  const [rep, setRep]         = useState('Sam Gowen')
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState(null)
  const [targets, setTargets] = useState({})  // { pog_category: { gains_target, target_dist_pct } }
  const [bnb, setBnb]         = useState({})  // { pog_category: { avgDist, sumGap } }
  const [dis, setDis]         = useState({})  // { pog_category: gainsActual }

  useEffect(() => { load(rep) }, [rep])

  async function load(selectedRep) {
    setLoading(true)
    setErr(null)

    try {
      // A) Targets from cycle_targets
      const { data: tgtRows, error: tgtErr } = await supabase
        .from('cycle_targets')
        .select('pog_category, gains_target, target_dist_pct')
        .eq('cycle', CURRENT_CYCLE)
        .eq('rep_name', selectedRep)
      if (tgtErr) throw tgtErr

      const tgtMap = {}
      tgtRows?.forEach(r => {
        tgtMap[r.pog_category] = {
          gains_target:    r.gains_target,
          target_dist_pct: Number(r.target_dist_pct),
        }
      })
      setTargets(tgtMap)

      // B) BNB actuals — latest uploaded_at batch only
      const { data: latestRow, error: latestErr } = await supabase
        .from('bnb_26wk')
        .select('uploaded_at')
        .eq('rep_name', selectedRep)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .single()
      if (latestErr && latestErr.code !== 'PGRST116') throw latestErr

      const bnbMap = {}
      const itemCatMap = new Map()  // item_id (number) → pog_category

      if (latestRow) {
        const { data: bnbRows, error: bnbErr } = await supabase
          .from('bnb_26wk')
          .select('pog_category, distribution_percentage, ranging_gap, item_id')
          .eq('rep_name', selectedRep)
          .eq('uploaded_at', latestRow.uploaded_at)
        if (bnbErr) throw bnbErr

        // Build item → category lookup for DIS join
        bnbRows?.forEach(r => {
          if (r.item_id != null) itemCatMap.set(Number(r.item_id), r.pog_category)
        })

        // Aggregate by pog_category: avg distribution_percentage, sum ranging_gap
        const catGroups = {}
        bnbRows?.forEach(r => {
          if (!r.pog_category) return
          if (!catGroups[r.pog_category]) catGroups[r.pog_category] = { vals: [], gapSum: 0 }
          if (r.distribution_percentage != null) catGroups[r.pog_category].vals.push(Number(r.distribution_percentage))
          catGroups[r.pog_category].gapSum += Number(r.ranging_gap ?? 0)
        })
        Object.entries(catGroups).forEach(([cat, g]) => {
          const avg = g.vals.length ? g.vals.reduce((a, b) => a + b, 0) / g.vals.length : null
          bnbMap[cat] = { avgDist: avg, sumGap: g.gapSum }
        })
      }
      setBnb(bnbMap)

      // C) DIS actuals — gains from store_distribution since cycle start
      const { data: disRows, error: disErr } = await supabase
        .from('store_distribution')
        .select('id, item_code, movement_type')
        .eq('rep_name', selectedRep)
        .gte('uploaded_at', CYCLE_START)
        .in('movement_type', ['Gain', 'New Gain'])
      if (disErr) throw disErr

      // Deduplicate by id, join to bnb item→category map
      const seen = new Set()
      const gainsByCat = {}
      disRows?.forEach(r => {
        if (seen.has(r.id)) return
        seen.add(r.id)
        const cat = itemCatMap.get(Number(r.item_code))
        if (!cat) return
        gainsByCat[cat] = (gainsByCat[cat] || 0) + 1
      })
      setDis(gainsByCat)

    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }

  function exportExcel() {
    const today   = new Date().toISOString().slice(0, 10)
    const repSlug = rep.replace(/\s+/g, '_')
    const rows = CATEGORIES.map(({ key, label }) => {
      const tgt    = targets[key] || {}
      const b      = bnb[key]    || {}
      const actual = dis[key]    ?? 0
      return {
        'Rep':            rep,
        'Cycle':          CURRENT_CYCLE,
        'Category':       label,
        'Target Dist %':  tgt.target_dist_pct != null ? Math.round(tgt.target_dist_pct * 100) : '',
        'Current Dist %': b.avgDist != null ? Math.round(b.avgDist) : '',
        'Ranging Gaps':   b.sumGap ?? '',
        'Gains Target':   tgt.gains_target ?? '',
        'Gains Actual':   actual,
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Targets')
    XLSX.writeFile(wb, `Targets_${repSlug}_Cycle${CURRENT_CYCLE}_${today}.xlsx`)
  }

  return (
    <div className="tgt-page">

      <div className="tgt-header">
        <h1 className="tgt-title">Cycle {CURRENT_CYCLE} Targets</h1>
        <div className="tgt-header-right">
          <select
            className="tgt-rep-select"
            value={rep}
            onChange={e => setRep(e.target.value)}
          >
            {REPS.map(r => <option key={r}>{r}</option>)}
          </select>
          <button className="tgt-export-btn" onClick={exportExcel} disabled={loading}>
            ↓ Export Excel
          </button>
        </div>
      </div>

      {loading && (
        <div className="tgt-loading">
          <div className="tgt-spinner" />
          <span>Loading…</span>
        </div>
      )}

      {err && <div className="tgt-error">Error: {err}</div>}

      {!loading && !err && (
        <div className="tgt-cards">
          {CATEGORIES.map(({ key, label }) => {
            const tgt    = targets[key] || {}
            const b      = bnb[key]    || {}
            const actual = dis[key]    ?? 0

            const gainsTarget   = tgt.gains_target ?? 0
            const targetDistPct = Math.round((tgt.target_dist_pct ?? 0) * 100)
            const currentDistPct = b.avgDist != null ? Math.round(b.avgDist) : null
            const distGap        = currentDistPct != null ? targetDistPct - currentDistPct : null
            const fillPct        = gainsTarget > 0 ? Math.min(100, Math.round((actual / gainsTarget) * 100)) : 0
            const barColor       = gainColor(actual, gainsTarget)

            return (
              <div key={key} className="tgt-card">
                <div className="tgt-card-title">{label}</div>

                <div className="tgt-section-label">BNB Distribution</div>

                <div className="tgt-stat-row">
                  <span className="tgt-stat-key">Current dist %</span>
                  <span className="tgt-stat-val">
                    {currentDistPct != null ? `${currentDistPct}%` : '—'}
                  </span>
                </div>
                <div className="tgt-stat-row">
                  <span className="tgt-stat-key">Target dist %</span>
                  <span className="tgt-stat-val">{targetDistPct}%</span>
                </div>
                <div className="tgt-stat-row">
                  <span className="tgt-stat-key">Gap to target</span>
                  <span className={`tgt-stat-val ${distGap == null ? '' : distGap > 0 ? 'tgt-amber' : 'tgt-green'}`}>
                    {distGap == null
                      ? '—'
                      : distGap > 0
                        ? `+${distGap}% needed`
                        : 'On target'}
                  </span>
                </div>
                <div className="tgt-stat-row">
                  <span className="tgt-stat-key">Ranging gaps remaining</span>
                  <span className="tgt-stat-val">
                    {b.sumGap != null ? b.sumGap.toLocaleString() : '—'}
                  </span>
                </div>

                <div className="tgt-divider" />

                <div className="tgt-section-label">DIS Gains This Cycle</div>

                <div className="tgt-gains-row">
                  <span className="tgt-gains-actual" style={{ color: barColor }}>{actual}</span>
                  <span className="tgt-gains-denom"> / {gainsTarget}</span>
                </div>
                <div className="tgt-bar-track">
                  <div className="tgt-bar-fill" style={{ width: `${fillPct}%`, background: barColor }} />
                </div>
                <div className="tgt-bar-pct" style={{ color: barColor }}>{fillPct}% of target</div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
