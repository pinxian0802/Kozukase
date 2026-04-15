'use client'

import { createContext, useContext } from 'react'
import type { ServerSession } from '@/lib/supabase/get-session'

const SessionContext = createContext<ServerSession>(null)

export function SessionProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: ServerSession
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/**
 * 在 Client Component 裡讀取 session。
 * session 由伺服器在 root layout 讀取後，透過 Context 傳下來，
 * 不需要打任何 API。
 */
export function useSession() {
  return useContext(SessionContext)
}
