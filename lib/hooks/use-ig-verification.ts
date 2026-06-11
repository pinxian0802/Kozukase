'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export type IgVerifyStep =
  | { step: 'idle' }
  | { step: 'entering_username' }
  | { step: 'loading_code' }
  | { step: 'waiting_send'; id: string; code: string; expiresAt: string }
  | { step: 'reviewing'; id: string }
  | { step: 'rejected'; reason: string | null }
  | { step: 'success' }

export function useIgVerification(onVerified?: () => void) {
  const [state, setState] = useState<IgVerifyStep>({ step: 'idle' })
  const [usernameInput, setUsernameInput] = useState('')
  const [inputError, setInputError] = useState('')
  const [countdown, setCountdown] = useState('')
  // 有一筆待審驗證時記住它的 id：按「返回」回到列表後，外層按鈕據此顯示「審核中」並可點回卡片
  const [pendingId, setPendingId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }, [])

  // 按「我已傳送」：凍結過期，開始自動掃
  const confirmSent = useCallback(async (id: string, code: string) => {
    stopPolling()
    try {
      await fetch('/api/instagram/verify/sent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch { /* 忽略，仍進輪詢 */ }
    let attempts = 0
    // 立刻顯示「審核中」（與 Threads 一致）；背景仍繼續自動掃收件匣，掃到即跳成功
    setPendingId(id)
    setState({ step: 'reviewing', id })
    pollingRef.current = setInterval(async () => {
      if (!pollingRef.current) return
      try {
        const res = await fetch(`/api/instagram/verify/status?id=${id}`)
        const data = await res.json()
        if (!pollingRef.current) return
        if (data.verified) {
          stopPolling()
          setPendingId(null)
          setState({ step: 'success' })
          onVerified?.()
        } else {
          attempts++
          if (attempts >= 5) {
            stopPolling()
            await fetch('/api/instagram/verify/escalate', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id }),
            })
            setState({ step: 'reviewing', id })
          }
        }
      } catch { /* 下次再試 */ }
    }, 10000)
  }, [onVerified, stopPolling])

  // 產碼
  const start = useCallback(async () => {
    const username = usernameInput.trim().toLowerCase()
    if (!username) { setInputError('請輸入Instagram帳號'); return }
    setInputError('')
    setPendingId(null)
    setState({ step: 'loading_code' })
    try {
      const res = await fetch('/api/instagram/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ig_username: username }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setState({ step: 'waiting_send', id: data.id, code: data.code, expiresAt: data.expires_at })
    } catch {
      toast.error('產生驗證碼失敗，請重試')
      setState({ step: 'entering_username' })
    }
  }, [usernameInput])

  const cancel = useCallback(async () => {
    stopPolling()
    if (state.step === 'waiting_send' || state.step === 'reviewing') {
      const id = 'id' in state ? state.id : undefined
      if (id) {
        void fetch('/api/instagram/verify/cancel', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
      }
    }
    setPendingId(null)
    setState({ step: 'idle' }); setUsernameInput(''); setInputError('')
  }, [state, stopPolling])

  // 還原進行中的驗證
  useEffect(() => {
    fetch('/api/instagram/verify/pending')
      .then(r => r.json())
      .then((d: { id: string; code: string; expires_at: string | null; status: string; reject_reason: string | null } | null) => {
        if (!d) return
        if (d.status === 'created' && d.expires_at) setState({ step: 'waiting_send', id: d.id, code: d.code, expiresAt: d.expires_at })
        else if (d.status === 'sent') confirmSent(d.id, d.code)
        else if (d.status === 'pending') { setPendingId(d.id); setState({ step: 'reviewing', id: d.id }) }
        else if (d.status === 'rejected') setState({ step: 'rejected', reason: d.reject_reason })
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  // 倒數：只在 waiting_send 跑
  const expiresAt = state.step === 'waiting_send' ? state.expiresAt : null
  useEffect(() => {
    if (!expiresAt) { setCountdown(''); return }
    const ms = new Date(expiresAt).getTime()
    const tick = () => {
      const remaining = Math.max(0, ms - Date.now())
      const m = Math.floor(remaining / 60000)
      const s = Math.floor((remaining % 60000) / 1000)
      setCountdown(`${m}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiresAt])

  // waiting_send 倒數歸零 → 作廢
  useEffect(() => {
    if (countdown !== '0:00') return
    if (state.step !== 'waiting_send') return
    void fetch('/api/instagram/verify/cancel', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: state.id }),
    })
    toast.error('驗證碼已過期，請重新取得')
    setState({ step: 'idle' }); setUsernameInput(''); setInputError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, state.step])

  return { state, setState, usernameInput, setUsernameInput, inputError, setInputError, countdown, pendingId, start, confirmSent, cancel }
}
