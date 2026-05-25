import { createContext, useContext, useState } from 'react'

const ClientContext = createContext(null)

export function ClientProvider({ children }) {
  const [client, setClient] = useState('vitasoy')
  return (
    <ClientContext.Provider value={{ client, setClient }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClient() {
  return useContext(ClientContext)
}
