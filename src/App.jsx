import { lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ShareView from './pages/ShareView'

const PublicCalculator = lazy(() => import('./pages/PerfectStoreCalculator/PublicCalculator'))

function AppRoutes() {
  const { session } = useAuth()
  if (session === undefined) return null // loading
  return session ? <Dashboard /> : <Login />
}

export default function App() {
  // Public share route — bypass auth entirely
  const path = window.location.pathname
  if (path.startsWith('/share/')) {
    const slug = path.split('/')[2]
    if (slug) return <ShareView slug={slug} />
  }

  // Public Perfect Store Calculator — no login, browser-only
  if (path.replace(/\/+$/, '') === '/calculator') {
    return (
      <Suspense fallback={null}>
        <PublicCalculator />
      </Suspense>
    )
  }

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
