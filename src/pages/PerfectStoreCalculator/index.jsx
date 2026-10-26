import { useMemo, useRef, useState } from 'react'
import {
  FIELDS, EMPTY_INPUTS, sanitise, sanitiseShelves, parseShelves,
  shelvesToFacings, facingsToShelves, calculate, formatResults,
} from './calc'
import './PerfectStoreCalculator.css'

// Tab order: shelves then facings for each row
const ORDER = FIELDS.flatMap(f => [`s_${f.key}`, `f_${f.key}`])

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older Android WebViews / non-secure contexts
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

function roundShelves(n) {
  return Math.round(n * 10) / 10
}

export default function PerfectStoreCalculator() {
  // Facings drive every calculation; shelves is the companion box.
  // Shelves use the phone keypad (inputMode tel) because it has a + key on Samsung.
  const [facings, setFacings] = useState(EMPTY_INPUTS)
  const [shelves, setShelves] = useState(EMPTY_INPUTS)
  const [copyState, setCopyState] = useState('idle') // idle | copied | failed
  const refs = useRef({})

  const result = useMemo(() => calculate(facings), [facings])
  const { errors, kpis } = result
  const hasAny = Object.values(facings).some(v => v !== '') || Object.values(shelves).some(v => v !== '')

  function onShelves(key, raw) {
    const s = sanitiseShelves(raw)
    setShelves(prev => ({ ...prev, [key]: s }))
    setFacings(prev => ({ ...prev, [key]: shelvesToFacings(s) }))
    setCopyState('idle')
  }

  function onFacings(key, raw) {
    const f = sanitise(raw)
    setFacings(prev => ({ ...prev, [key]: f }))
    setShelves(prev => ({ ...prev, [key]: facingsToShelves(f) }))
    setCopyState('idle')
  }

  function focusNext(id) {
    const next = ORDER[ORDER.indexOf(id) + 1]
    if (next) refs.current[next]?.focus()
    else refs.current[id]?.blur()
  }

  function reset() {
    setFacings(EMPTY_INPUTS)
    setShelves(EMPTY_INPUTS)
    setCopyState('idle')
    refs.current[ORDER[0]]?.focus()
  }

  async function handleCopy() {
    const ok = await copyText(formatResults(result))
    setCopyState(ok ? 'copied' : 'failed')
    if (ok) setTimeout(() => setCopyState('idle'), 2000)
  }

  function inputProps(id) {
    return {
      ref: el => { refs.current[id] = el },
      type: 'text',
      autoComplete: 'off',
      enterKeyHint: id === ORDER[ORDER.length - 1] ? 'done' : 'next',
      onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); focusNext(id) } },
      onFocus: e => e.target.select(),
    }
  }

  return (
    <div className="psc-page">
      <div className="psc-wrap">
        <form className="psc-table" onSubmit={e => e.preventDefault()} noValidate>
          <div className="psc-row psc-row--head" aria-hidden="true">
            <span />
            <span className="psc-col">Shelves</span>
            <span />
            <span className="psc-col">Facings</span>
          </div>

          {FIELDS.map(f => {
            const err = errors[f.key]
            const s = shelves[f.key]
            const sum = s.includes('+') ? parseShelves(s) : null
            return (
              <div key={f.key} className={`psc-row${err ? ' has-error' : ''}${f.key === 'totalUht' ? ' psc-row--total' : ''}`}>
                <div className="psc-name">
                  <span className="psc-label">{f.label}</span>
                  <span className="psc-hint">{f.hint}</span>
                </div>
                <input
                  {...inputProps(`s_${f.key}`)}
                  className="psc-input psc-input--shelves"
                  inputMode="tel"
                  placeholder="0"
                  aria-label={`${f.label} shelves`}
                  value={s}
                  onChange={e => onShelves(f.key, e.target.value)}
                />
                <span className="psc-eq" aria-hidden="true">=</span>
                <input
                  {...inputProps(`f_${f.key}`)}
                  className="psc-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  aria-label={`${f.label} facings`}
                  aria-invalid={!!err}
                  value={facings[f.key]}
                  onChange={e => onFacings(f.key, e.target.value)}
                />
                {sum != null && <span className="psc-sum">= {roundShelves(sum)} shelves</span>}
                {err && <span className="psc-error" role="alert">{err}</span>}
              </div>
            )
          })}

          <p className="psc-note">1 shelf = 9 facings. Use + to add bays, e.g. 7+6+8</p>
        </form>

        <section className="psc-results" aria-live="polite">
          {kpis.map(k => (
            <div key={k.id} className={`psc-kpi psc-kpi--${k.status}`}>
              <div className="psc-kpi-main">
                <span className="psc-kpi-name">{k.name}</span>
                <span className="psc-kpi-target">Target &gt;{k.target}%</span>
              </div>
              <div className="psc-kpi-side">
                {(k.status === 'pass' || k.status === 'fail') ? (
                  <>
                    <span className="psc-kpi-value">{k.display}</span>
                    <span className={`psc-pill psc-pill--${k.status}`}>{k.status.toUpperCase()}</span>
                  </>
                ) : (
                  <span className="psc-pill psc-pill--muted">
                    {k.status === 'invalid' ? 'Check inputs' : 'Incomplete'}
                  </span>
                )}
              </div>
              {k.needed > 0 && (
                <div className="psc-kpi-needed">
                  +{k.needed} Vitasoy facing{k.needed === 1 ? '' : 's'} needed to pass
                </div>
              )}
            </div>
          ))}
        </section>

        <div className="psc-actions">
          <button type="button" className="btn btn--ghost psc-btn" onClick={reset} disabled={!hasAny}>
            Reset
          </button>
          <button type="button" className="btn btn--primary psc-btn" onClick={handleCopy} disabled={!hasAny}>
            {copyState === 'copied' ? 'Copied ✓' : copyState === 'failed' ? 'Copy failed' : 'Copy Results'}
          </button>
        </div>
      </div>
    </div>
  )
}
