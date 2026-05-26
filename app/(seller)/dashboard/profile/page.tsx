'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Save, Loader2, Link2, Link2Off } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { FilterTabsList } from '@/components/shared/filter-tabs-list'
import { FormFieldError } from '@/components/shared/form-field-error'
import { MultiSelect } from '@/components/ui/multi-select'
import { AvatarUpload } from '@/components/shared/avatar-upload'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'
import { scrollToFirstError } from '@/lib/utils/scroll-to-error'
import Image from 'next/image'

export default function SellerProfilePage() {
  const session = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [bio, setBio] = useState('')
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [regionError, setRegionError] = useState('')
  const [avatarImage, setAvatarImage] = useState<{ url: string; r2Key: string } | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // IG DM 驗證狀態機
  type IgVerifyState =
    | { step: 'idle' }
    | { step: 'entering_username' }
    | { step: 'loading_code' }
    | { step: 'waiting_send'; id: string; code: string; expiresAt: string }
    | { step: 'polling'; id: string; code: string; expiresAt: string }
    | { step: 'failed' }
    | { step: 'success' }

  const [igVerify, setIgVerify] = useState<IgVerifyState>({ step: 'idle' })
  const [igUsernameInput, setIgUsernameInput] = useState('')
  const [igInputError, setIgInputError] = useState('')
  const [igCountdown, setIgCountdown] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const adminHandle = process.env.NEXT_PUBLIC_INSTAGRAM_ADMIN_HANDLE ?? ''

  // Threads 人工審核驗證狀態機
  type ThreadsVerifyState =
    | { step: 'idle' }
    | { step: 'entering_username' }
    | { step: 'loading_code' }
    | { step: 'waiting_send'; id: string; code: string }
    | { step: 'reviewing'; id: string }
    | { step: 'rejected'; reason: string | null }

  const [thVerify, setThVerify] = useState<ThreadsVerifyState>({ step: 'idle' })
  const [thUsernameInput, setThUsernameInput] = useState('')
  const [thInputError, setThInputError] = useState('')
  const threadsAdminHandle =
    process.env.NEXT_PUBLIC_THREADS_ADMIN_HANDLE ?? process.env.NEXT_PUBLIC_INSTAGRAM_ADMIN_HANDLE ?? ''

  const { data: seller, isLoading: isSellerLoading, refetch: refetchSeller } = trpc.seller.getSelf.useQuery(undefined, {
    refetchOnWindowFocus: false,
  })
  const { data: regions } = trpc.seller.getRegions.useQuery()
  const { data: sellerRegions, isLoading: isRegionsLoading } = trpc.seller.getSellerRegions.useQuery(undefined, {
    refetchOnWindowFocus: false,
  })

  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  useEffect(() => {
    const initialName = (session?.profile?.sellers as Record<string, unknown> | null)?.name
    if (typeof initialName === 'string') setName(initialName)
  }, [session])

  useEffect(() => {
    if (initialized) return
    if (seller) {
      setBio((seller.bio as string | null) ?? '')
      const existingAvatarUrl = (seller as Record<string, unknown>).avatar_url as string | null
      if (existingAvatarUrl) {
        setAvatarImage({ url: existingAvatarUrl, r2Key: '' })
      }
    }
    if (seller !== undefined && sellerRegions) {
      setSelectedRegions(sellerRegions.map((r: { region_id: string }) => r.region_id))
      setInitialized(true)
    }
  }, [seller, sellerRegions, initialized])

  // 處理 Threads OAuth callback 的 URL 參數
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected === 'threads') {
      toast.success('Threads 已成功驗證')
      refetchSeller()
    } else if (error === 'cancelled') {
      toast.info('已取消驗證')
    } else if (error === 'invalid_state') {
      toast.error('驗證失敗，請重試')
    } else if (error === 'token_exchange') {
      toast.error('驗證失敗，請重試')
    } else if (error === 'fetch_failed') {
      toast.warning('已驗證，但無法取得帳號資料，請稍後重試')
      refetchSeller()
    }

    if (connected || error) {
      router.replace('/dashboard/profile', { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleIgVerifyStart = async () => {
    const username = igUsernameInput.trim().toLowerCase()
    if (!username) {
      setIgInputError('請輸入Instagram帳號')
      return
    }
    setIgInputError('')
    setIgVerify({ step: 'loading_code' })
    try {
      const res = await fetch('/api/instagram/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ig_username: username }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      startPolling(data.id, data.code, data.expires_at)
    } catch {
      toast.error('產生驗證碼失敗，請重試')
      setIgVerify({ step: 'entering_username' })
    }
  }

  const startPolling = (id: string, code: string, expiresAt: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setIgVerify({ step: 'waiting_send', id, code, expiresAt })
  }

  const beginPolling = (id: string, code: string, expiresAt: string) => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    let attempts = 0
    setIgVerify({ step: 'polling', id, code, expiresAt })
    pollingRef.current = setInterval(async () => {
      if (!pollingRef.current) return
      try {
        const res = await fetch(`/api/instagram/verify/status?id=${id}`)
        const data = await res.json()
        if (!pollingRef.current) return
        if (data.verified) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setIgVerify({ step: 'success' })
          void refetchSeller()
        } else if (data.expired) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          toast.error('驗證碼已過期，請重新取得')
          setIgVerify({ step: 'idle' })
        } else {
          attempts++
          if (attempts >= 5) {
            clearInterval(pollingRef.current!)
            pollingRef.current = null
            void fetch('/api/instagram/verify/cancel', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id }),
            })
            setIgVerify({ step: 'failed' })
          }
        }
      } catch { /* 靜默，下次 interval 再試 */ }
    }, 10000)
  }

  const cancelIgVerify = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    if (igVerify.step === 'polling' || igVerify.step === 'waiting_send') {
      void fetch('/api/instagram/verify/cancel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: igVerify.id }),
      })
    }
    setIgVerify({ step: 'idle' })
    setIgUsernameInput('')
    setIgInputError('')
  }

  const handleThVerifyStart = async () => {
    const username = thUsernameInput.trim().toLowerCase()
    if (!username) {
      setThInputError('請輸入Threads帳號')
      return
    }
    setThInputError('')
    setThVerify({ step: 'loading_code' })
    try {
      const res = await fetch('/api/threads/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threads_username: username }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setThVerify({ step: 'waiting_send', id: data.id, code: data.code })
    } catch {
      toast.error('產生驗證碼失敗，請重試')
      setThVerify({ step: 'entering_username' })
    }
  }

  const cancelThVerify = () => {
    if (thVerify.step === 'waiting_send' || thVerify.step === 'reviewing') {
      const id = 'id' in thVerify ? thVerify.id : undefined
      if (id) {
        void fetch('/api/threads/verify/cancel', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
      }
    }
    setThVerify({ step: 'idle' })
    setThUsernameInput('')
    setThInputError('')
  }

  // 回到頁面時從 DB 恢復進行中的驗證
  useEffect(() => {
    fetch('/api/instagram/verify/pending')
      .then(r => r.json())
      .then((data: { id: string; code: string; expires_at: string } | null) => {
        if (data) startPolling(data.id, data.code, data.expires_at)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 回到頁面時從 DB 恢復進行中/被退回的 Threads 申請
  useEffect(() => {
    fetch('/api/threads/verify/pending')
      .then(r => r.json())
      .then((data: { id: string; status: string; reject_reason: string | null } | null) => {
        if (!data) return
        if (data.status === 'pending') setThVerify({ step: 'reviewing', id: data.id })
        else if (data.status === 'rejected') setThVerify({ step: 'rejected', reason: data.reject_reason })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [])

  const expiresAt = (igVerify.step === 'polling' || igVerify.step === 'waiting_send') ? igVerify.expiresAt : null
  useEffect(() => {
    if (!expiresAt) { setIgCountdown(''); return }
    const expiresAtMs = new Date(expiresAt).getTime()
    const tick = () => {
      const remaining = Math.max(0, expiresAtMs - Date.now())
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      setIgCountdown(`${mins}:${String(secs).padStart(2, '0')}`)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (igCountdown !== '0:00') return
    if (igVerify.step !== 'waiting_send' && igVerify.step !== 'polling') return
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    if ('id' in igVerify) {
      void fetch('/api/instagram/verify/cancel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: igVerify.id }),
      })
    }
    toast.error('驗證碼已過期，請重新取得')
    setIgVerify({ step: 'idle' })
    setIgUsernameInput('')
    setIgInputError('')
  }, [igCountdown, igVerify.step])

  const updateSeller = trpc.seller.update.useMutation({
    onSuccess: () => {
      toast.success('已更新')
      void refetchSeller()
      router.refresh()
    },
  })

  const disconnectSocial = trpc.seller.disconnectSocial.useMutation({
    onSuccess: (_data, variables) => {
      const label = variables.platform === 'instagram' ? 'Instagram' : 'Threads'
      toast.success(`${label} 已取消驗證`)
      if (variables.platform === 'instagram') setIgVerify({ step: 'idle' })
      if (variables.platform === 'threads') setThVerify({ step: 'idle' })
      refetchSeller()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    let hasError = false
    if (!trimmedName) {
      setNameError('賣家名稱為必填')
      hasError = true
    } else {
      setNameError('')
    }
    if (selectedRegions.length === 0) {
      setRegionError('請至少選擇一個代購地區')
      hasError = true
    } else {
      setRegionError('')
    }
    if (hasError) {
      scrollToFirstError()
      return
    }

    setIsSubmitting(true)
    let finalAvatarUrl: string | null | undefined = avatarImage?.url ?? null
    let uploadedR2Key: string | null = null

    try {
      if (pendingFile) {
        const [uploaded] = await uploadImageFiles('avatar', [pendingFile], getPresignedUrl.mutateAsync)
        finalAvatarUrl = uploaded.url
        uploadedR2Key = uploaded.r2Key
        setAvatarImage(uploaded)
        setPendingFile(null)
      }

      await updateSeller.mutateAsync(
        {
          name: trimmedName,
          bio: bio.trim() || undefined,
          region_ids: selectedRegions,
          avatar_url: finalAvatarUrl,
        },
      )
    } catch (err) {
      if (uploadedR2Key) {
        await deleteObjects.mutateAsync({ r2Keys: [uploadedR2Key] }).catch(() => {})
      }
      toast.error(err instanceof Error ? err.message : '操作失敗')
    } finally {
      setIsSubmitting(false)
    }
  }

  const igConnectedAt = seller?.ig_connected_at as string | null | undefined
  const threadsConnectedAt = seller?.threads_connected_at as string | null | undefined
  const igHandle = seller?.ig_handle as string | null | undefined
  const threadsHandle = seller?.threads_handle as string | null | undefined
  const igFollowers = seller?.ig_follower_count as number | null | undefined
  const threadsFollowers = seller?.threads_follower_count as number | null | undefined

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Tabs defaultValue="seller-info">
        <FilterTabsList items={[
          { value: 'seller-info', label: '賣家資料' },
          { value: 'social', label: '社群帳號' },
        ]} />

        <TabsContent value="seller-info" className="mt-4">
          <Card className="ring-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle>賣家資料</CardTitle>
            </CardHeader>
            <CardContent>
              {(isSellerLoading || isRegionsLoading) ? (
                <div className="space-y-5">
                  {/* 頭貼 */}
                  <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
                    <Skeleton className="mt-2 h-4 w-10" />
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-24 w-24 rounded-full" />
                      <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-16" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </div>

                  {/* 賣家名稱 */}
                  <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
                    <Skeleton className="mt-2 h-4 w-20" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>

                  {/* 代購地區 */}
                  <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
                    <Skeleton className="mt-2 h-4 w-20" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>

                  {/* 簡介 */}
                  <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
                    <Skeleton className="mt-2 h-4 w-10" />
                    <Skeleton className="h-44 w-full rounded-md" />
                  </div>

                  {/* 儲存按鈕 */}
                  <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
                    <div />
                    <Skeleton className="h-9 w-28 justify-self-end rounded-md" />
                  </div>
                </div>
              ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
                  <Label className="pt-2">頭貼</Label>
                  <AvatarUpload
                    value={avatarImage}
                    onChange={setAvatarImage}
                    pendingFile={pendingFile}
                    onPendingFileChange={setPendingFile}
                  />
                </div>

                <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
                  <Label htmlFor="name" className="pt-2">賣家名稱 <span className="text-destructive">*</span></Label>
                  <div>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        if (nameError) setNameError('')
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                      maxLength={50}
                      aria-invalid={!!nameError}
                    />
                    <FormFieldError message={nameError} />
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
                  <Label className="pt-2">代購地區 <span className="text-destructive">*</span></Label>
                  <div>
                    <MultiSelect
                      value={selectedRegions}
                      onValueChange={(v) => {
                        setSelectedRegions(v)
                        if (regionError) setRegionError('')
                      }}
                      options={(regions ?? []).map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))}
                      placeholder="選擇代購地區"
                      searchPlaceholder="搜尋地區..."
                      emptyText="找不到相符的地區"
                      invalid={!!regionError}
                    />
                    <FormFieldError message={regionError} />
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
                  <Label htmlFor="bio" className="pt-2">簡介</Label>
                  <div>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="介紹你的代購服務、專長地區或購物風格…"
                      maxLength={300}
                      rows={8}
                      className="resize-none"
                    />
                    <p className="mt-1 text-xs text-muted-foreground text-right">{bio.length}/300</p>
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
                  <div />
                  <button type="submit" className={buttonVariants({ className: 'w-fit justify-self-end' })} disabled={isSubmitting || updateSeller.isPending || getPresignedUrl.isPending}>
                    {updateSeller.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                    儲存變更
                  </button>
                </div>
              </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="mt-4">
          <Card className="ring-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle>社群帳號</CardTitle>
            </CardHeader>

            {thVerify.step !== 'idle' ? (

              /* ── Threads 驗證流程 ── */
              <CardContent className="p-0">
                <div className="flex items-center justify-center" style={{ height: 360 }}>
                  <div className="w-full max-w-[300px] px-5">

                    {thVerify.step === 'entering_username' && (
                      <div className="flex flex-col gap-7">
                        <div className="flex flex-col items-center gap-3.5 text-center">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden">
                            <Image src="/images/threads.png" alt="Threads" width={56} height={56} />
                          </div>
                          <div>
                            <p className="font-semibold text-[15px] text-text-strong">驗證 Threads</p>
                            <p className="text-[13px] text-text-muted mt-1 leading-relaxed">輸入你的帳號名稱</p>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <input
                            className="w-full h-11 px-3.5 rounded-xl border border-border-soft bg-white text-[14px] text-text-strong placeholder:text-text-faint focus:outline-none focus:border-text-strong focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] transition-[border-color,box-shadow]"
                            placeholder="帳號名稱"
                            value={thUsernameInput}
                            onChange={e => { setThUsernameInput(e.target.value); setThInputError('') }}
                            onKeyDown={e => { if (e.key === 'Enter') void handleThVerifyStart() }}
                            autoFocus
                          />
                          <FormFieldError message={thInputError} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => void handleThVerifyStart()}
                            className="h-11 w-full rounded-xl border border-brand-500 bg-surface-card text-brand-700 text-[14px] font-semibold hover:bg-brand-500 hover:text-cta-foreground active:translate-y-px transition-[background,color,transform]"
                          >
                            取得驗證碼
                          </button>
                          <button onClick={cancelThVerify} className="h-10 w-full rounded-xl text-[13px] text-text-muted hover:text-text-strong transition-colors">
                            取消
                          </button>
                        </div>
                      </div>
                    )}

                    {thVerify.step === 'loading_code' && (
                      <div className="flex flex-col items-center gap-5 py-10 text-center">
                        <div className="flex items-center gap-2 text-text-muted">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-[13px]">正在產生驗證碼⋯</span>
                        </div>
                      </div>
                    )}

                    {thVerify.step === 'waiting_send' && (
                      <div className="flex flex-col gap-6">
                        <div className="text-center space-y-1">
                          <p className="font-semibold text-[15px] text-text-strong">傳送驗證碼</p>
                          <p className="text-[13px] text-text-muted leading-relaxed">
                            用 Threads 私訊以下數字給{' '}
                            <a href={`https://www.threads.net/@${threadsAdminHandle}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-text-strong hover:underline">
                              @{threadsAdminHandle}
                            </a>
                          </p>
                          <p className="text-[13px] text-text-muted leading-relaxed">傳送後請點擊『<span className="text-text-strong">我已傳送</span>』按鈕</p>
                        </div>
                        <div className="flex justify-center gap-2">
                          {thVerify.code.toString().split('').map((digit, i) => (
                            <div key={i} className="flex items-center justify-center rounded-xl border-2 border-border-soft bg-surface-muted text-[22px] font-mono font-bold text-text-strong shadow-sm" style={{ width: 40, height: 52 }}>
                              {digit}
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => setThVerify({ step: 'reviewing', id: thVerify.id })}
                            className="h-11 w-full rounded-xl border border-brand-500 bg-surface-card text-brand-700 text-[14px] font-semibold hover:bg-brand-500 hover:text-cta-foreground active:translate-y-px transition-[background,color,transform]"
                          >
                            我已傳送
                          </button>
                          <button onClick={cancelThVerify} className="h-10 w-full rounded-xl text-[13px] text-text-muted hover:text-text-strong transition-colors">
                            取消
                          </button>
                        </div>
                      </div>
                    )}

                    {thVerify.step === 'reviewing' && (
                      <div className="flex flex-col items-center gap-6 py-6 text-center">
                        <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden">
                          <Image src="/images/threads.png" alt="Threads" width={72} height={72} />
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-semibold text-[16px] text-text-strong">審核中</p>
                          <p className="text-[13px] text-text-muted leading-relaxed">我們已收到你的驗證,管理員審核通過後會以通知告知你。你可以先離開這個頁面。</p>
                        </div>
                        <button onClick={cancelThVerify} className="h-10 px-10 rounded-xl text-[13px] text-text-muted hover:text-text-strong transition-colors">
                          取消申請
                        </button>
                      </div>
                    )}

                    {thVerify.step === 'rejected' && (
                      <div className="flex flex-col items-center gap-6 py-6 text-center">
                        <div className="relative">
                          <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden">
                            <Image src="/images/threads.png" alt="Threads" width={72} height={72} />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-semibold text-[16px] text-text-strong">驗證未通過</p>
                          <p className="text-[13px] text-text-muted">{thVerify.reason || '管理員未通過這次驗證,請確認已把驗證碼私訊給正確帳號後重試'}</p>
                        </div>
                        <button
                          onClick={() => { setThVerify({ step: 'entering_username' }); setThUsernameInput('') }}
                          className="h-11 px-10 rounded-xl border border-brand-500 bg-surface-card text-brand-700 text-[14px] font-semibold hover:bg-brand-500 hover:text-cta-foreground active:translate-y-px transition-[background,color,transform]"
                        >
                          重新驗證
                        </button>
                      </div>
                    )}

                  </div>
                </div>
              </CardContent>

            ) : igVerify.step !== 'idle' ? (

              /* ── IG 驗證流程 ── */
              <CardContent className="p-0">
                <div className="flex items-center justify-center" style={{ height: 360 }}>
                  <div className="w-full max-w-[300px] px-5">

                    {igVerify.step === 'entering_username' && (
                      <div className="flex flex-col gap-7">
                        <div className="flex flex-col items-center gap-3.5 text-center">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden">
                            <Image src="/images/instagram.png" alt="Instagram" width={56} height={56} />
                          </div>
                          <div>
                            <p className="font-semibold text-[15px] text-text-strong">驗證 Instagram</p>
                            <p className="text-[13px] text-text-muted mt-1 leading-relaxed">輸入你的帳號名稱</p>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <input
                            className="w-full h-11 px-3.5 rounded-xl border border-border-soft bg-white text-[14px] text-text-strong placeholder:text-text-faint focus:outline-none focus:border-text-strong focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] transition-[border-color,box-shadow]"
                            placeholder="帳號名稱"
                            value={igUsernameInput}
                            onChange={e => { setIgUsernameInput(e.target.value); setIgInputError('') }}
                            onKeyDown={e => { if (e.key === 'Enter') void handleIgVerifyStart() }}
                            autoFocus
                          />
                          <FormFieldError message={igInputError} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => void handleIgVerifyStart()}
                            className="h-11 w-full rounded-xl border border-brand-500 bg-surface-card text-brand-700 text-[14px] font-semibold hover:bg-brand-500 hover:text-cta-foreground active:translate-y-px transition-[background,color,transform]"
                          >
                            取得驗證碼
                          </button>
                          <button
                            onClick={cancelIgVerify}
                            className="h-10 w-full rounded-xl text-[13px] text-text-muted hover:text-text-strong transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}

                    {igVerify.step === 'loading_code' && (
                      <div className="flex flex-col items-center gap-5 py-10 text-center">
                        <div className="flex items-center gap-2 text-text-muted">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-[13px]">正在產生驗證碼⋯</span>
                        </div>
                      </div>
                    )}

                    {igVerify.step === 'waiting_send' && (
                      <div className="flex flex-col gap-6">
                        <div className="text-center space-y-1">
                          <p className="font-semibold text-[15px] text-text-strong">傳送驗證碼</p>
                          <p className="text-[13px] text-text-muted leading-relaxed">
                            用 Instagram 私訊以下數字給{' '}
                            <a href={`https://www.instagram.com/${adminHandle}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-text-strong hover:underline">
                              @{adminHandle}
                            </a>
                          </p>
                          <p className="text-[13px] text-text-muted leading-relaxed">傳送後請點擊『<span className="text-text-strong">我已傳送</span>』按鈕</p>
                        </div>
                        <div className="flex justify-center gap-2">
                          {igVerify.code.toString().split('').map((digit, i) => (
                            <div key={i} className="flex items-center justify-center rounded-xl border-2 border-border-soft bg-surface-muted text-[22px] font-mono font-bold text-text-strong shadow-sm" style={{ width: 40, height: 52 }}>
                              {digit}
                            </div>
                          ))}
                        </div>
                        <span className="text-[12px] font-mono text-text-faint tabular-nums text-center">剩餘時間 {igCountdown}</span>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => beginPolling(igVerify.id, igVerify.code, igVerify.expiresAt)}
                            className="h-11 w-full rounded-xl border border-brand-500 bg-surface-card text-brand-700 text-[14px] font-semibold hover:bg-brand-500 hover:text-cta-foreground active:translate-y-px transition-[background,color,transform]"
                          >
                            我已傳送
                          </button>
                          <button onClick={cancelIgVerify} className="h-10 w-full rounded-xl text-[13px] text-text-muted hover:text-text-strong transition-colors">
                            取消
                          </button>
                        </div>
                      </div>
                    )}

                    {igVerify.step === 'polling' && (
                      <div className="flex flex-col gap-6">
                        <div className="flex justify-center gap-2">
                          {igVerify.code.toString().split('').map((digit, i) => (
                            <div key={i} className="flex items-center justify-center rounded-xl border-2 border-border-soft bg-surface-muted text-[22px] font-mono font-bold text-text-strong shadow-sm" style={{ width: 40, height: 52 }}>
                              {digit}
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-[12px] font-mono text-text-faint tabular-nums">剩餘時間 {igCountdown}</span>
                          <div className="flex items-center gap-1.5 text-[12px] text-text-faint">
                            <Loader2 className="h-3 w-3 animate-spin" />等待確認中⋯
                          </div>
                        </div>
                        <button onClick={cancelIgVerify} className="h-10 w-full rounded-xl text-[13px] text-text-muted hover:text-text-strong transition-colors">
                          取消
                        </button>
                      </div>
                    )}

                    {igVerify.step === 'failed' && (
                      <div className="flex flex-col items-center gap-6 py-6 text-center">
                        <div className="relative">
                          <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden">
                            <Image src="/images/instagram.png" alt="Instagram" width={72} height={72} />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-semibold text-[16px] text-text-strong">驗證失敗</p>
                          <p className="text-[13px] text-text-muted">未收到驗證碼，請確認已傳送給正確帳號後重試</p>
                        </div>
                        <button
                          onClick={() => setIgVerify({ step: 'entering_username' })}
                          className="h-11 px-10 rounded-xl border border-brand-500 bg-surface-card text-brand-700 text-[14px] font-semibold hover:bg-brand-500 hover:text-cta-foreground active:translate-y-px transition-[background,color,transform]"
                        >
                          重新驗證
                        </button>
                      </div>
                    )}

                    {igVerify.step === 'success' && (
                      <div className="flex flex-col items-center gap-6 py-6 text-center">
                        <div className="relative">
                          <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden">
                            <Image src="/images/instagram.png" alt="Instagram" width={72} height={72} />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-semibold text-[16px] text-text-strong">驗證完成</p>
                          <p className="text-[13px] text-text-muted">@{igHandle || igUsernameInput} 已成功連結至賣家頁面</p>
                        </div>
                        <button
                          onClick={() => setIgVerify({ step: 'idle' })}
                          className="h-11 px-10 rounded-xl border border-brand-500 bg-surface-card text-brand-700 text-[14px] font-semibold hover:bg-brand-500 hover:text-cta-foreground active:translate-y-px transition-[background,color,transform]"
                        >
                          完成
                        </button>
                      </div>
                    )}

                  </div>
                </div>
              </CardContent>

            ) : (

              /* ── 一般列表畫面 ── */
              <CardContent className="p-0 divide-y divide-border">

                {/* Instagram Row */}
                <div className="flex items-center gap-3.5 px-5 py-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-[10px] overflow-hidden shadow-[0_1px_6px_rgba(0,0,0,0.1)]">
                      <Image src="/images/instagram.png" alt="Instagram" width={40} height={40} />
                    </div>
                    {igConnectedAt && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-[15px] h-[15px] rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                        <svg width={7} height={7} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-text-strong leading-none mb-1">Instagram</p>
                    {igConnectedAt ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {igHandle && (
                          <a
                            href={`https://www.instagram.com/${igHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12.5px] text-text-muted font-medium hover:underline"
                          >@{igHandle}</a>
                        )}
                        {igFollowers != null && (
                          <>
                            <span className="text-text-faint text-[11px]">·</span>
                            <span className="text-[12px] text-muted-foreground">{igFollowers.toLocaleString()} 位粉絲</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">尚未連結</p>
                    )}
                  </div>

                  {igConnectedAt ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-[12px] text-muted-foreground hover:text-destructive flex-shrink-0"
                      disabled={disconnectSocial.isPending}
                      onClick={() => disconnectSocial.mutate({ platform: 'instagram' })}
                    >
                      {disconnectSocial.isPending && disconnectSocial.variables?.platform === 'instagram'
                        ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        : <Link2Off className="mr-1 h-3 w-3" />
                      }
                      取消
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 px-3.5 text-[13px] flex-shrink-0"
                      onClick={() => setIgVerify({ step: 'entering_username' })}
                    >
                      驗證
                    </Button>
                  )}
                </div>

                {/* Threads Row */}
                <div className="flex items-center gap-3.5 px-5 py-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-[10px] overflow-hidden shadow-[0_1px_6px_rgba(0,0,0,0.1)]">
                      <Image src="/images/threads.png" alt="Threads" width={40} height={40} />
                    </div>
                    {threadsConnectedAt && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-[15px] h-[15px] rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                        <svg width={7} height={7} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-text-strong leading-none mb-1">Threads</p>
                    {threadsConnectedAt ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {threadsHandle && (
                          <span className="text-[12.5px] text-text-muted font-medium">@{threadsHandle}</span>
                        )}
                        {threadsFollowers != null && (
                          <>
                            <span className="text-text-faint text-[11px]">·</span>
                            <span className="text-[12px] text-muted-foreground">{threadsFollowers.toLocaleString()} 位粉絲</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">尚未連結</p>
                    )}
                  </div>

                  {threadsConnectedAt ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-[12px] text-muted-foreground"
                        onClick={() => setThVerify({ step: 'entering_username' })}
                      >
                        重新驗證
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-[12px] text-muted-foreground hover:text-destructive"
                        disabled={disconnectSocial.isPending}
                        onClick={() => disconnectSocial.mutate({ platform: 'threads' })}
                      >
                        {disconnectSocial.isPending && disconnectSocial.variables?.platform === 'threads'
                          ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          : <Link2Off className="mr-1 h-3 w-3" />
                        }
                        取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 px-3.5 text-[13px] flex-shrink-0"
                      onClick={() => setThVerify({ step: 'entering_username' })}
                    >
                      驗證
                    </Button>
                  )}
                </div>

              </CardContent>

            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
