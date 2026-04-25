'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormFieldError } from '@/components/shared/form-field-error'
import { AvatarUpload } from '@/components/shared/avatar-upload'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getAuthErrorMessage, getSafeNextPath } from '@/lib/supabase/auth-error'
import { trpc } from '@/lib/trpc/client'

const USERNAME_REGEX = /^[a-z0-9]{3,20}$/

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const safeNext = useMemo(() => getSafeNextPath(searchParams.get('next')), [searchParams])

  const [isEmailUser, setIsEmailUser] = useState(false)
  const [ready, setReady] = useState(false)

  const [username, setUsername] = useState('')
  const [debouncedUsername, setDebouncedUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarImage, setAvatarImage] = useState<{ url: string; r2Key: string } | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const completeOnboarding = trpc.auth.completeOnboarding.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const usernameCheck = trpc.auth.checkUsername.useQuery(
    { username: debouncedUsername },
    { enabled: USERNAME_REGEX.test(debouncedUsername), staleTime: 10000 }
  )

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
      if (profile?.username) {
        router.replace('/')
        return
      }
      setIsEmailUser(user.app_metadata?.provider === 'email')
      if (user.user_metadata?.full_name) {
        setDisplayName(user.user_metadata.full_name as string)
      }
      setReady(true)
    })
  }, [router])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUsername(username), 400)
    return () => clearTimeout(timer)
  }, [username])

  const usernameAvailable =
    USERNAME_REGEX.test(debouncedUsername) && debouncedUsername === username
      ? usernameCheck.data?.available
      : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}

    if (!USERNAME_REGEX.test(username)) {
      nextErrors.username = '只能使用小寫英文和數字，長度 3-20'
    } else if (usernameAvailable === false) {
      nextErrors.username = '此 username 已被使用'
    }

    if (!displayName.trim()) {
      nextErrors.displayName = '顯示名稱為必填'
    }

    if (isEmailUser) {
      if (!password) {
        nextErrors.password = '密碼為必填'
      } else if (password.length < 6) {
        nextErrors.password = '密碼至少需要 6 個字元'
      }
      if (!confirmPassword) {
        nextErrors.confirmPassword = '請再次輸入密碼'
      } else if (password !== confirmPassword) {
        nextErrors.confirmPassword = '兩次輸入的密碼不一致'
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setSubmitting(true)

    try {
      if (isEmailUser) {
        const supabase = createSupabaseBrowserClient()
        const { error } = await supabase.auth.updateUser({ password })
        if (error) {
          toast.error(getAuthErrorMessage(error, '密碼設定失敗，請稍後再試'))
          return
        }
      }

      let finalAvatarUrl = avatarImage?.url
      if (pendingFile) {
        const [uploaded] = await uploadImageFiles('avatar', [pendingFile], getPresignedUrl.mutateAsync)
        finalAvatarUrl = uploaded.url
      }

      await completeOnboarding.mutateAsync({
        username,
        display_name: displayName.trim(),
        avatar_url: finalAvatarUrl,
      })

      toast.success('歡迎加入！')
      router.push(safeNext)
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('已被使用')) {
        setErrors(prev => ({ ...prev, username: '此 username 已被使用' }))
      } else if (message.includes('已設定完成')) {
        router.push(safeNext)
        router.refresh()
      } else {
        toast.error('設定失敗，請稍後再試')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-primary/5 to-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xl">設定個人資料</CardTitle>
          <CardDescription>在開始之前，先設定你的帳號資訊</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <Label>頭貼（選填）</Label>
              <AvatarUpload
                value={avatarImage}
                onChange={setAvatarImage}
                pendingFile={pendingFile}
                onPendingFileChange={setPendingFile}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="username">ID</Label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))
                    setErrors(prev => { const n = { ...prev }; delete n.username; return n })
                  }}
                  placeholder="只能使用小寫英文和數字"
                  aria-invalid={!!errors.username}
                  className="pl-7 pr-16"
                />
                {USERNAME_REGEX.test(username) && debouncedUsername === username && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs">
                    {usernameCheck.isFetching ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : usernameAvailable === true ? (
                      <><Check className="h-3 w-3 text-green-600" /><span className="text-green-600">可使用</span></>
                    ) : usernameAvailable === false ? (
                      <><X className="h-3 w-3 text-destructive" /><span className="text-destructive">已被使用</span></>
                    ) : null}
                  </span>
                )}
              </div>
              <FormFieldError message={errors.username} />
            </div>

            <div>
              <Label htmlFor="display-name">顯示名稱</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setErrors(prev => { const n = { ...prev }; delete n.displayName; return n })
                }}
                placeholder="你想讓別人怎麼稱呼你？"
                aria-invalid={!!errors.displayName}
                className="mt-1"
              />
              <FormFieldError message={errors.displayName} />
            </div>

            {isEmailUser && (
              <>
                <div>
                  <Label htmlFor="password">設定密碼</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrors(prev => { const n = { ...prev }; delete n.password; return n })
                    }}
                    placeholder="至少 6 個字元"
                    aria-invalid={!!errors.password}
                    className="mt-1"
                  />
                  <FormFieldError message={errors.password} />
                </div>

                <div>
                  <Label htmlFor="confirm-password">確認密碼</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setErrors(prev => { const n = { ...prev }; delete n.confirmPassword; return n })
                    }}
                    placeholder="再次輸入密碼"
                    aria-invalid={!!errors.confirmPassword}
                    className="mt-1"
                  />
                  <FormFieldError message={errors.confirmPassword} />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={submitting || usernameAvailable === false}
              className={buttonVariants({ className: 'w-full' })}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              開始使用
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
