'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Save, Loader2, Link2, Link2Off, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { FormFieldError } from '@/components/shared/form-field-error'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'

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

  const { data: seller, refetch: refetchSeller } = trpc.seller.getSelf.useQuery(undefined, {
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    const initialName = (session?.profile?.sellers as Record<string, unknown> | null)?.name
    if (typeof initialName === 'string') setName(initialName)
  }, [session])

  // 處理 OAuth callback 的 URL 參數，顯示 toast 後清除 params
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected === 'instagram') {
      toast.success('Instagram 已成功連結')
      refetchSeller()
    } else if (connected === 'threads') {
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

  const updateSeller = trpc.seller.update.useMutation({
    onSuccess: () => toast.success('已更新'),
    onError: (err) => toast.error(err.message),
  })

  const disconnectSocial = trpc.seller.disconnectSocial.useMutation({
    onSuccess: (_data, variables) => {
      const label = variables.platform === 'instagram' ? 'Instagram' : 'Threads'
      toast.success(`${label} 已取消連結`)
      refetchSeller()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('賣家名稱為必填')
      return
    }
    setNameError('')
    updateSeller.mutate({ name: trimmedName })
  }

  const igConnectedAt = seller?.ig_connected_at as string | null | undefined
  const threadsConnectedAt = seller?.threads_connected_at as string | null | undefined
  const igHandle = seller?.ig_handle as string | null | undefined
  const threadsHandle = seller?.threads_handle as string | null | undefined
  const igFollowers = seller?.ig_follower_count as number | null | undefined
  const threadsFollowers = seller?.threads_follower_count as number | null | undefined

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 基本資料 */}
      <Card>
        <CardHeader>
          <CardTitle>賣家資料設定</CardTitle>
          <CardDescription>管理你的賣家名稱</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="name">賣家名稱</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (nameError) setNameError('')
                }}
                maxLength={50}
                className="mt-1"
                aria-invalid={!!nameError}
              />
              <FormFieldError message={nameError} />
            </div>

            <button type="submit" className={buttonVariants()} disabled={updateSeller.isPending}>
              {updateSeller.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              儲存變更
            </button>
          </form>
        </CardContent>
      </Card>

      {/* 社群連結 */}
      <Card>
        <CardHeader>
          <CardTitle>社群帳號連結</CardTitle>
          <CardDescription>透過 OAuth 驗證連結你的社群帳號，連結後自動顯示帳號名稱與粉絲數，並獲得認證標章</CardDescription>
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
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-1 text-sm">
                    {igHandle && <p className="font-medium">@{igHandle}</p>}
                    {igFollowers !== null && igFollowers !== undefined
                      ? <p className="text-muted-foreground">{igFollowers.toLocaleString()} 位粉絲</p>
                      : null
                    }
                    <p className="text-xs text-muted-foreground">
                      連結時間：{new Date(igConnectedAt).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" render={<a href="/api/auth/instagram/connect" />}>
                      <Link2 className="mr-1 h-3.5 w-3.5" />
                      重新連結
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
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="flex-1 text-sm text-muted-foreground">
                  連結 Instagram 後，帳號名稱與粉絲數將自動顯示在你的賣家頁面
                </p>
                <Button size="sm" className="flex-shrink-0" render={<a href="/api/auth/instagram/connect" />}>
                  <Link2 className="mr-1 h-3.5 w-3.5" />
                  連結 Instagram
                </Button>
              </div>
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
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-1 text-sm">
                    {threadsHandle && <p className="font-medium">@{threadsHandle}</p>}
                    {threadsFollowers !== null && threadsFollowers !== undefined
                      ? <p className="text-muted-foreground">{threadsFollowers.toLocaleString()} 位粉絲</p>
                      : <p className="text-xs text-muted-foreground">Threads 目前不提供粉絲數資料</p>
                    }
                    <p className="text-xs text-muted-foreground">
                      連結時間：{new Date(threadsConnectedAt).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" render={<a href="/api/auth/threads/connect" />}>
                      <Link2 className="mr-1 h-3.5 w-3.5" />
                      重新連結
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
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="flex-1 text-sm text-muted-foreground">
                  連結 Threads 後，帳號名稱將自動顯示在你的賣家頁面
                </p>
                <Button size="sm" className="flex-shrink-0" render={<a href="/api/auth/threads/connect" />}>
                  <Link2 className="mr-1 h-3.5 w-3.5" />
                  連結 Threads
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
