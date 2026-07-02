'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export type ThreadsVerifyStep =
  | { step: 'idle' }
  | { step: 'entering_username' }
  | { step: 'loading_code' }
  | { step: 'waiting_send'; id: string; code: string; expiresAt: string }
  | { step: 'reviewing'; id: string }
  | { step: 'rejected'; reason: string | null }

// 與 IG 同一套行為:回到頁面一律停在社群列表,用列表那一列的按鈕反映進度。
export function useThreadsVerification() {
  const [state, setState] = useState<ThreadsVerifyStep>({ step: 'idle' })
  const [usernameInput, setUsernameInput] = useState('')
  const [inputError, setInputError] = useState('')
  const [countdown, setCountdown] = useState('')
  const [sendExpired, setSendExpired] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pendingSend, setPendingSend] = useState<{ id: string; code: string; expiresAt: string } | null>(null)
  const [pendingSendExpired, setPendingSendExpired] = useState(false)

  const confirmSent = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/threads/verify/sent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? `送出失敗（${res.status}）`)
        return
      }
    } catch {
      toast.error('送出失敗，請檢查網路後重試')
      return
    }
    setPendingSend(null)
    setPendingId(id)
    setState({ step: 'reviewing', id })
  }, [])

  const start = useCallback(async () => {
    const username = usernameInput.trim().toLowerCase()
    if (!username) { setInputError('請輸入Threads帳號'); return }
    setInputError('')
    setPendingId(null)
    setPendingSend(null)
    setState({ step: 'loading_code' })
    try {
      const res = await fetch('/api/threads/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threads_username: username }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setState({ step: 'waiting_send', id: data.id, code: data.code, expiresAt: data.expires_at })
    } catch {
      toast.error('產生驗證碼失敗，請重試')
      setState({ step: 'entering_username' })
    }
  }, [usernameInput])

  const openSend = useCallback(() => {
    if (!pendingSend) return
    setState({ step: 'waiting_send', id: pendingSend.id, code: pendingSend.code, expiresAt: pendingSend.expiresAt })
  }, [pendingSend])

  const cancel = useCallback(async () => {
    if (state.step === 'waiting_send' || state.step === 'reviewing') {
      const id = 'id' in state ? state.id : undefined
      if (id) {
        void fetch('/api/threads/verify/cancel', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
      }
    }
    setPendingId(null)
    setPendingSend(null)
    setState({ step: 'idle' }); setUsernameInput(''); setInputError('')
  }, [state])

  // 還原進行中的驗證(回到頁面一律停在列表)
  useEffect(() => {
    fetch('/api/threads/verify/pending')
      .then(r => r.json())
      .then((d: { id: string; code: string; threads_username: string | null; expires_at: string | null; status: string; reject_reason: string | null } | null) => {
        if (!d) return
        if (d.status === 'created' && d.expires_at) {
          setPendingSend({ id: d.id, code: d.code, expiresAt: d.expires_at })
          if (d.threads_username) setUsernameInput(d.threads_username)
        }
        else if (d.status === 'pending') {
          setPendingId(d.id)
          if (d.threads_username) setUsernameInput(d.threads_username)
        }
        // rejected：回到列表(原因靠通知),不再強制顯示退回卡片
      })
      .catch(() => {})
  }, [])

  // pendingSend 是否過期(在 effect 內算)。到期時翻成「驗證碼已過期」。
  useEffect(() => {
    if (!pendingSend) { setPendingSendExpired(false); return }
    const ms = new Date(pendingSend.expiresAt).getTime() - Date.now()
    if (ms <= 0) { setPendingSendExpired(true); return }
    setPendingSendExpired(false)
    const t = setTimeout(() => setPendingSendExpired(true), ms + 200)
    return () => clearTimeout(t)
  }, [pendingSend])

  // 倒數:只在 waiting_send 跑;歸零後 sendExpired 轉 true,畫面改顯示「驗證碼已過期」
  const expiresAt = state.step === 'waiting_send' ? state.expiresAt : null
  useEffect(() => {
    if (!expiresAt) { setCountdown(''); setSendExpired(false); return }
    const ms = new Date(expiresAt).getTime()
    const tick = () => {
      const remaining = Math.max(0, ms - Date.now())
      const m = Math.floor(remaining / 60000)
      const s = Math.floor((remaining % 60000) / 1000)
      setCountdown(`${m}:${String(s).padStart(2, '0')}`)
      setSendExpired(remaining <= 0)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiresAt])

  return {
    state, setState, usernameInput, setUsernameInput, inputError, setInputError,
    countdown, sendExpired, pendingId, pendingSend, pendingSendExpired, openSend, start, confirmSent, cancel,
  }
}
