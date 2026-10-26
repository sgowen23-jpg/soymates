// Public, no-login wrapper for the Perfect Store Calculator (served at /calculator).
// Runs entirely in the browser: no Supabase, no auth.
import PerfectStoreCalculator from './index'
import './PublicCalculator.css'

export default function PublicCalculator() {
  return (
    <div className="pubcalc-shell">
      <header className="pubcalc-bar">
        <img src="/team-vb-logo.svg" alt="" width="30" height="30" className="pubcalc-logo" />
        <span className="pubcalc-title">Perfect Store Calculator</span>
      </header>
      <main className="pubcalc-main">
        <PerfectStoreCalculator />
      </main>
    </div>
  )
}
