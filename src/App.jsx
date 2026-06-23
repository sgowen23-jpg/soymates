import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ShareView from './pages/ShareView'

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

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
