'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Save, Loader2, Link2, Link2Off, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FormFieldError } from '@/components/shared/form-field-error'
import { MultiSelect } from '@/components/ui/multi-select'
import { AvatarUpload } from '@/components/shared/avatar-upload'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'
import { scrollToFirstError } from '@/lib/utils/scroll-to-error'

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}

function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.473 12.01v-.017c.027-3.579.879-6.43 2.525-8.482C5.848 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.466l-2.04.569c-.509-1.928-1.424-3.401-2.721-4.378-1.378-1.047-3.195-1.57-5.43-1.583-2.8.02-5.043.896-6.667 2.605-1.582 1.664-2.393 4.07-2.415 7.175.022 3.104.83 5.51 2.413 7.174 1.624 1.71 3.87 2.584 6.679 2.603 2.297-.015 4.048-.603 5.357-1.804 1.39-1.267 2.097-3.04 2.203-5.423-.63.08-1.343.131-2.082.131-2.35 0-4.133-.408-5.297-1.213-1.297-.892-1.957-2.27-1.907-3.993.052-1.818.814-3.213 2.206-4.031 1.198-.701 2.795-.87 4.388-.48.76.188 1.443.523 2.018.989.576.469.994 1.038 1.243 1.69.25.657.33 1.33.236 1.997h-2.07c.058-.378.018-.728-.122-1.056a2.054 2.054 0 00-.694-.91 3.27 3.27 0 00-1.236-.597c-1.044-.257-2.138-.153-2.973.328-.778.455-1.218 1.294-1.25 2.367-.032 1.07.344 1.843 1.116 2.37.867.596 2.293.9 4.233.9 1.115 0 2.083-.085 2.9-.25.004-.115.006-.23.006-.348 0-2.785-.664-5.059-1.974-6.759" />
    </svg>
  )
}

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
    | { step: 'showing_code'; id: string; code: string }
    | { step: 'polling'; id: string; code: string }
    | { step: 'success' }

  const [igVerify, setIgVerify] = useState<IgVerifyState>({ step: 'idle' })
  const [igUsernameInput, setIgUsernameInput] = useState('')
  const [igInputError, setIgInputError] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const adminHandle = process.env.NEXT_PUBLIC_INSTAGRAM_ADMIN_HANDLE ?? ''

  const { data: seller, refetch: refetchSeller } = trpc.seller.getSelf.useQuery(undefined, {
    refetchOnWindowFocus: false,
  })
  const { data: regions } = trpc.seller.getRegions.useQuery()
  const { data: sellerRegions } = trpc.seller.getSellerRegions.useQuery(undefined, {
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
    if (sellerRegions) {
      setSelectedRegions(sellerRegions.map((r: { region_id: string }) => r.region_id))
      setInitialized(true)
    }
  }, [seller, sellerRegions, initialized])

  // 處理 Threads OAuth callback 的 URL 參數
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected === 'threads') {
      toast.success('Threads 已成功連結')
      refetchSeller()
    } else if (error === 'cancelled') {
      toast.info('已取消連結')
    } else if (error === 'invalid_state') {
      toast.error('連結失敗，請重試')
    } else if (error === 'token_exchange') {
      toast.error('連結失敗，請重試')
    } else if (error === 'fetch_failed') {
      toast.warning('已連結，但無法取得帳號資料，請稍後重試')
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
      setIgInputError('請輸入 IG 帳號')
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
      setIgVerify({ step: 'showing_code', id: data.id, code: data.code })
    } catch {
      toast.error('產生驗證碼失敗，請重試')
      setIgVerify({ step: 'entering_username' })
    }
  }

  const startPolling = (id: string, code: string) => {
    setIgVerify({ step: 'polling', id, code })
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/instagram/verify/status?id=${id}`)
        const data = await res.json()
        if (data.verified) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setIgVerify({ step: 'success' })
          toast.success('Instagram 已成功連結')
          void refetchSeller()
        } else if (data.expired) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          toast.error('驗證碼已過期，請重試')
          setIgVerify({ step: 'idle' })
        }
      } catch { /* 靜默，下次 interval 再試 */ }
    }, 3000)
  }

  const cancelIgVerify = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setIgVerify({ step: 'idle' })
    setIgUsernameInput('')
    setIgInputError('')
  }

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [])

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
      toast.success(`${label} 已取消連結`)
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
        <TabsList variant="line" className="flex-wrap w-full border-b border-border">
          <TabsTrigger value="seller-info">賣家資料</TabsTrigger>
          <TabsTrigger value="social">社群帳號</TabsTrigger>
        </TabsList>

        <TabsContent value="seller-info" className="mt-4">
          <Card className="ring-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle>賣家資料</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="mt-4">
          <Card className="ring-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle>社群帳號</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Instagram */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <InstagramIcon className="h-5 w-5 text-pink-500" />
                  <span className="font-medium">Instagram</span>
                  {igConnectedAt ? (
                    <Badge variant="secondary" className="text-xs">已連結</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">未連結</Badge>
                  )}
                </div>

                {igConnectedAt ? (
                  <div className="flex items-center justify-between flex-wrap gap-2 rounded-md border bg-muted/30 px-4 py-3">
                    <div className="space-y-0.5 text-sm">
                      {igHandle && <p className="font-medium">@{igHandle}</p>}
                      {igFollowers != null && (
                        <p className="text-muted-foreground">{igFollowers.toLocaleString()} 位粉絲</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => setIgVerify({ step: 'entering_username' })}>
                        <Link2 className="mr-1 h-3.5 w-3.5" />重新連結
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={disconnectSocial.isPending}
                        onClick={() => disconnectSocial.mutate({ platform: 'instagram' })}
                      >
                        {disconnectSocial.isPending && disconnectSocial.variables?.platform === 'instagram'
                          ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          : <Link2Off className="mr-1 h-3.5 w-3.5" />
                        }
                        取消連結
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {igVerify.step === 'idle' && (
                      <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
                        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="flex-1 text-sm text-muted-foreground">連結後帳號名稱與粉絲數將顯示在賣家頁面</p>
                        <Button size="sm" className="flex-shrink-0" onClick={() => setIgVerify({ step: 'entering_username' })}>
                          <Link2 className="mr-1 h-3.5 w-3.5" />連結
                        </Button>
                      </div>
                    )}

                    {igVerify.step === 'entering_username' && (
                      <div className="rounded-md border p-4 space-y-3">
                        <p className="text-sm text-muted-foreground">輸入你的 Instagram 帳號</p>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Input
                              placeholder="帳號名稱（不含 @）"
                              value={igUsernameInput}
                              onChange={(e) => { setIgUsernameInput(e.target.value); setIgInputError('') }}
                              onKeyDown={(e) => { if (e.key === 'Enter') void handleIgVerifyStart() }}
                              aria-invalid={!!igInputError}
                            />
                            <FormFieldError message={igInputError} />
                          </div>
                          <Button size="sm" onClick={() => void handleIgVerifyStart()}>取得驗證碼</Button>
                          <Button size="sm" variant="ghost" onClick={cancelIgVerify}>取消</Button>
                        </div>
                      </div>
                    )}

                    {igVerify.step === 'loading_code' && (
                      <div className="flex items-center gap-2 rounded-md border p-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">產生驗證碼中...</span>
                      </div>
                    )}

                    {(igVerify.step === 'showing_code' || igVerify.step === 'polling') && (
                      <div className="rounded-md border p-4 space-y-3">
                        <p className="text-sm font-medium">
                          請用 Instagram 私訊以下數字給{' '}
                          <span className="font-mono font-semibold">@{adminHandle}</span>
                        </p>
                        <p className="text-3xl font-mono font-bold tracking-[0.3em] text-center py-2">
                          {igVerify.code}
                        </p>
                        <p className="text-xs text-muted-foreground text-center">驗證碼 15 分鐘內有效</p>
                        {igVerify.step === 'showing_code' ? (
                          <Button
                            className="w-full"
                            onClick={() => startPolling(igVerify.id, igVerify.code)}
                          >
                            我已傳送，等待確認
                          </Button>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            等待確認中...
                          </div>
                        )}
                        <Button variant="ghost" size="sm" className="w-full" onClick={cancelIgVerify}>
                          取消
                        </Button>
                      </div>
                    )}

                    {igVerify.step === 'success' && (
                      <div className="rounded-md border bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950 dark:text-green-400">
                        Instagram 已成功連結！
                      </div>
                    )}
                  </>
                )}
              </div>

              <Separator />

              {/* Threads */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ThreadsIcon className="h-5 w-5" />
                  <span className="font-medium">Threads</span>
                  {threadsConnectedAt ? (
                    <Badge variant="secondary" className="text-xs">已連結</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">未連結</Badge>
                  )}
                </div>

                {threadsConnectedAt ? (
                  <div className="flex items-center justify-between flex-wrap gap-2 rounded-md border bg-muted/30 px-4 py-3">
                    <div className="space-y-0.5 text-sm">
                      {threadsHandle && <p className="font-medium">@{threadsHandle}</p>}
                      {threadsFollowers != null && (
                        <p className="text-muted-foreground">{threadsFollowers.toLocaleString()} 位粉絲</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" render={<a href="/api/auth/threads/connect" />}>
                        <Link2 className="mr-1 h-3.5 w-3.5" />重新連結
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={disconnectSocial.isPending}
                        onClick={() => disconnectSocial.mutate({ platform: 'threads' })}
                      >
                        {disconnectSocial.isPending && disconnectSocial.variables?.platform === 'threads'
                          ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          : <Link2Off className="mr-1 h-3.5 w-3.5" />
                        }
                        取消連結
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="flex-1 text-sm text-muted-foreground">
                      連結後帳號名稱將顯示在賣家頁面
                    </p>
                    <Button size="sm" className="flex-shrink-0" render={<a href="/api/auth/threads/connect" />}>
                      <Link2 className="mr-1 h-3.5 w-3.5" />連結
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
