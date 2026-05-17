'use client'

import { createContext, useContext, useEffect } from 'react'
import type { ServerSession } from '@/lib/supabase/get-session'
import { trpc } from '@/lib/trpc/client'

const SessionContext = createContext<ServerSession>(null)

const HEARTBEAT_INTERVAL = 5 * 60 * 1000

export function SessionProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: ServerSession
}) {
  const updateLastSeen = trpc.auth.updateLastSeen.useMutation()

  useEffect(() => {
    if (!value) return
    const id = setInterval(() => {
      updateLastSeen.mutate()
    }, HEARTBEAT_INTERVAL)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.user?.id])

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
