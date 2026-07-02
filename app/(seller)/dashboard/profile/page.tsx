'use client'

import { useState, useEffect } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { AvatarUpload } from '@/components/shared/avatar-upload'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'
import { scrollToFirstError } from '@/lib/utils/scroll-to-error'
import Image from 'next/image'
import { useIgVerification } from '@/lib/hooks/use-ig-verification'
import { IgVerificationCard } from '@/components/seller/ig-verification-card'
import { useThreadsVerification } from '@/lib/hooks/use-threads-verification'
import { ThreadsVerificationCard } from '@/components/seller/threads-verification-card'

export default function SellerProfilePage() {
  const session = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [bio, setBio] = useState('')
  const [canProvideProof, setCanProvideProof] = useState(false)
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [regionError, setRegionError] = useState('')
  const [avatarImage, setAvatarImage] = useState<{ url: string; r2Key: string } | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const adminHandle = process.env.NEXT_PUBLIC_INSTAGRAM_ADMIN_HANDLE ?? ''

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
      setCanProvideProof(Boolean((seller as Record<string, unknown>).can_provide_proof))
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

  const igVm = useIgVerification()
  const thVm = useThreadsVerification()


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
      if (variables.platform === 'instagram') igVm.setState({ step: 'idle' })
      if (variables.platform === 'threads') thVm.setState({ step: 'idle' })
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
          can_provide_proof: canProvideProof,
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

  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
      <Tabs defaultValue="seller-info">
        <FilterTabsList items={[
          { value: 'seller-info', label: '賣家資料' },
          { value: 'social', label: '社群帳號' },
        ]} />

        <TabsContent value="seller-info" className="mt-4">
          <Card size="sm" className="ring-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">賣家資料</CardTitle>
            </CardHeader>
            <CardContent>
              {(isSellerLoading || isRegionsLoading) ? (
                <div className="space-y-3 md:space-y-5">
                  {/* 頭貼 */}
                  <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
                    <Skeleton className="h-3 w-10 md:mt-2 md:h-4" />
                    <div className="flex items-center justify-center gap-4 md:justify-start">
                      <Skeleton className="h-24 w-24 rounded-full" />
                      <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-16" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </div>

                  {/* 賣家名稱 */}
                  <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
                    <Skeleton className="h-3 w-20 md:mt-2 md:h-4" />
                    <Skeleton className="h-[30px] w-full rounded-lg md:h-10" />
                  </div>

                  {/* 代購地區 */}
                  <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
                    <Skeleton className="h-3 w-20 md:mt-2 md:h-4" />
                    <Skeleton className="h-[30px] w-full rounded-lg md:h-10" />
                  </div>

                  {/* 簡介 */}
                  <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
                    <Skeleton className="h-3 w-10 md:mt-2 md:h-4" />
                    <Skeleton className="h-20 w-full rounded-lg md:h-44" />
                  </div>

                  {/* 儲存按鈕 */}
                  <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
                    <div className="hidden md:block" />
                    <Skeleton className="ml-auto h-8 w-24 rounded-lg md:h-9 md:w-28 md:justify-self-end" />
                  </div>
                </div>
              ) : (
              <form onSubmit={handleSubmit} className="form-compact space-y-3 md:space-y-5" noValidate>
                <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
                  <Label className="pt-2">頭貼</Label>
                  <AvatarUpload
                    value={avatarImage}
                    onChange={setAvatarImage}
                    pendingFile={pendingFile}
                    onPendingFileChange={setPendingFile}
                    className="max-md:justify-center"
                  />
                </div>

                <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
                  <Label htmlFor="name" className="pt-2">賣家名稱 <span className="text-foreground">*</span></Label>
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

                <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
                  <Label className="pt-2">代購地區 <span className="text-foreground">*</span></Label>
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

                <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
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

                <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
                  <Label className="pt-2">購買證明</Label>
                  <div className="flex items-center gap-2.5 pt-1 md:gap-3">
                    <Switch checked={canProvideProof} onCheckedChange={setCanProvideProof} className="max-md:origin-left max-md:scale-90" />
                    <span className="text-[12px] text-muted-foreground md:text-sm">可提供購買證明 / 明細（協助買家辨別正品）</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
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
          <Card size="sm" className="ring-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">社群帳號</CardTitle>
            </CardHeader>

            {thVm.state.step !== 'idle' ? (

              /* ── Threads 驗證流程 ── */
              <CardContent className="p-0">
                <div className="flex items-center justify-center h-[360px] max-md:h-[300px]">
                  <div className="w-full max-w-[300px] px-5 max-md:scale-[0.85]">

                    <ThreadsVerificationCard vm={thVm} adminHandle={threadsAdminHandle} />
                  </div>
                </div>
              </CardContent>

            ) : igVm.state.step !== 'idle' ? (

              /* ── IG 驗證流程 ── */
              <CardContent className="p-0">
                <div className="flex items-center justify-center h-[360px] max-md:h-[300px]">
                  <div className="w-full max-w-[300px] px-5 max-md:scale-[0.85]">

                    <IgVerificationCard vm={igVm} adminHandle={adminHandle} />

                  </div>
                </div>
              </CardContent>

            ) : (

              /* ── 一般列表畫面 ── */
              <CardContent className="p-0 divide-y divide-border">

                {/* Instagram Row */}
                <div data-testid="social-row" data-platform="instagram" className="flex items-center gap-2.5 px-3 py-3 md:gap-3.5 md:px-5 md:py-4">
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
                  ) : igVm.pendingId ? (
                    <Button
                      variant="cta-outline"
                      size="sm"
                      className="h-8 px-3.5 text-[13px] flex-shrink-0"
                      onClick={() => igVm.setState({ step: 'reviewing', id: igVm.pendingId! })}
                    >
                      審核中
                    </Button>
                  ) : igVm.pendingSend ? (
                    <Button
                      variant="cta-outline"
                      size="sm"
                      className="h-8 px-3.5 text-[13px] flex-shrink-0"
                      onClick={igVm.openSend}
                    >
                      {igVm.pendingSendExpired ? '驗證碼已過期' : '傳送驗證碼'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 px-3.5 text-[13px] flex-shrink-0"
                      onClick={() => igVm.setState({ step: 'entering_username' })}
                    >
                      驗證
                    </Button>
                  )}
                </div>

                {/* Threads Row */}
                <div data-testid="social-row" data-platform="threads" className="flex items-center gap-2.5 px-3 py-3 md:gap-3.5 md:px-5 md:py-4">
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
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">尚未連結</p>
                    )}
                  </div>

                  {threadsConnectedAt ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-[12px] text-muted-foreground hover:text-destructive flex-shrink-0"
                      disabled={disconnectSocial.isPending}
                      onClick={() => disconnectSocial.mutate({ platform: 'threads' })}
                    >
                      {disconnectSocial.isPending && disconnectSocial.variables?.platform === 'threads'
                        ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        : <Link2Off className="mr-1 h-3 w-3" />
                      }
                      取消
                    </Button>
                  ) : thVm.pendingId ? (
                    <Button
                      variant="cta-outline"
                      size="sm"
                      className="h-8 px-3.5 text-[13px] flex-shrink-0"
                      onClick={() => thVm.setState({ step: 'reviewing', id: thVm.pendingId! })}
                    >
                      審核中
                    </Button>
                  ) : thVm.pendingSend ? (
                    <Button
                      variant="cta-outline"
                      size="sm"
                      className="h-8 px-3.5 text-[13px] flex-shrink-0"
                      onClick={thVm.openSend}
                    >
                      {thVm.pendingSendExpired ? '驗證碼已過期' : '傳送驗證碼'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 px-3.5 text-[13px] flex-shrink-0"
                      onClick={() => thVm.setState({ step: 'entering_username' })}
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
