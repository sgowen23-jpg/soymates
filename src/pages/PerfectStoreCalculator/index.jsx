import { useMemo, useRef, useState } from 'react'
import { FIELDS, EMPTY_INPUTS, sanitise, calculate, formatResults } from './calc'
import './PerfectStoreCalculator.css'

const GROUPS = [
  { title: 'UHT shelf',                  keys: ['totalUht', 'plantUht', 'vitasoyUht'] },
  { title: 'Oat milk (excl. barista)',   keys: ['oatUht', 'vitasoyOat'] },
]
const FIELD_BY_KEY = Object.fromEntries(FIELDS.map(f => [f.key, f]))
const ORDER = FIELDS.map(f => f.key)

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

export default function PerfectStoreCalculator() {
  const [inputs, setInputs] = useState(EMPTY_INPUTS)
  const [copyState, setCopyState] = useState('idle') // idle | copied | failed
  const refs = useRef({})

  const result = useMemo(() => calculate(inputs), [inputs])
  const { errors, kpis } = result
  const hasAny = Object.values(inputs).some(v => v !== '')

  function update(key, raw) {
    setInputs(prev => ({ ...prev, [key]: sanitise(raw) }))
    setCopyState('idle')
  }

  function focusNext(key) {
    const next = ORDER[ORDER.indexOf(key) + 1]
    if (next) refs.current[next]?.focus()
    else refs.current[key]?.blur()
  }

  function reset() {
    setInputs(EMPTY_INPUTS)
    setCopyState('idle')
    refs.current[ORDER[0]]?.focus()
  }

  async function handleCopy() {
    const ok = await copyText(formatResults(result))
    setCopyState(ok ? 'copied' : 'failed')
    if (ok) setTimeout(() => setCopyState('idle'), 2000)
  }

  return (
    <div className="psc-page">
      <div className="psc-wrap">
        <form className="psc-inputs" onSubmit={e => e.preventDefault()} noValidate>
          {GROUPS.map(g => (
            <fieldset key={g.title} className="psc-group">
              <legend className="psc-legend">{g.title}</legend>
              <div className={`psc-grid psc-grid--${g.keys.length}`}>
                {g.keys.map(key => {
                  const f = FIELD_BY_KEY[key]
                  const err = errors[key]
                  return (
                    <label key={key} className={`psc-field${err ? ' has-error' : ''}`}>
                      <span className="psc-label">{f.label}</span>
                      <span className="psc-hint">{f.hint}</span>
                      <input
                        ref={el => { refs.current[key] = el }}
                        className="psc-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        enterKeyHint={key === ORDER[ORDER.length - 1] ? 'done' : 'next'}
                        placeholder="0"
                        value={inputs[key]}
                        aria-invalid={!!err}
                        onChange={e => update(key, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusNext(key) } }}
                        onFocus={e => e.target.select()}
                      />
                      {err && <span className="psc-error" role="alert">{err}</span>}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ))}
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
