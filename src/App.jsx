import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function AppRoutes() {
  const { session } = useAuth()

  if (session === undefined) {
    return null // still loading session
  }

  return session ? <Dashboard /> : <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
