'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { FormFieldError } from '@/components/shared/form-field-error'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  buildAuthCallbackUrl,
  getAuthCallbackErrorMessage,
  getAuthErrorMessage,
  getSafeNextPath,
} from '@/lib/supabase/auth-error'

type LoginAction = 'google' | 'password' | null
type LoginErrors = {
  email?: string
  password?: string
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const handledQueryKey = useRef<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingAction, setLoadingAction] = useState<LoginAction>(null)
  const [errors, setErrors] = useState<LoginErrors>({})

  const safeNext = useMemo(
    () => getSafeNextPath(searchParams.get('next')),
    [searchParams]
  )

  useEffect(() => {
    const error = searchParams.get('error')
    if (!error) return

    const description = searchParams.get('error_description')
    const queryKey = `${error}:${description ?? ''}`
    if (handledQueryKey.current === queryKey) return
    handledQueryKey.current = queryKey

    toast.error(getAuthCallbackErrorMessage(error, description))
  }, [searchParams])

  const handleGoogleLogin = async () => {
    setLoadingAction('google')
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildAuthCallbackUrl(window.location.origin, safeNext),
      },
    })
    setLoadingAction(null)

    if (error) {
      toast.error(getAuthErrorMessage(error, 'Google 登入失敗，請稍後再試'))
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = email.trim()
    const nextErrors: LoginErrors = {}

    if (!trimmedEmail) {
      nextErrors.email = 'Email 為必填'
    }

    if (!password) {
      nextErrors.password = '密碼為必填'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setLoadingAction('password')
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })
    setLoadingAction(null)

    if (error) {
      toast.error(getAuthErrorMessage(error, '登入失敗，請稍後再試'))
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
      if (!profile?.username) {
        router.push(`/onboarding${safeNext !== '/' ? `?next=${encodeURIComponent(safeNext)}` : ''}`)
        router.refresh()
        return
      }
    }

    toast.success('登入成功')
    router.push(safeNext)
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm shadow-none">
        <CardHeader className="space-y-1 text-center pb-4">
          <Link href="/" className="font-heading text-2xl font-bold text-foreground tracking-tight">
            Kozukase
          </Link>
          <CardTitle className="text-base font-medium text-foreground">登入帳號</CardTitle>
          <CardDescription className="text-sm">
            還沒有帳號？
            <Link href={`/register?next=${encodeURIComponent(safeNext)}`} className="ml-1 text-foreground underline underline-offset-4 hover:text-muted-foreground">
              立即註冊
            </Link>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={loadingAction !== null}
          >
            {loadingAction === 'google' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            使用 Google 登入
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">或使用 Email 登入</span>
            </div>
          </div>

          <form onSubmit={handlePasswordLogin} className="space-y-3" noValidate>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) {
                    setErrors((current) => {
                      const next = { ...current }
                      delete next.email
                      return next
                    })
                  }
                }}
                placeholder="your@email.com"
                aria-invalid={!!errors.email}
                className="mt-1"
              />
              <FormFieldError message={errors.email} />
            </div>

            <div>
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errors.password) {
                    setErrors((current) => {
                      const next = { ...current }
                      delete next.password
                      return next
                    })
                  }
                }}
                placeholder="請輸入密碼"
                aria-invalid={!!errors.password}
                className="mt-1"
              />
              <FormFieldError message={errors.password} />
              <Link href="/forgot-password" className="mt-1 block text-right text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
                忘記密碼？
              </Link>
            </div>

            <button type="submit" className={buttonVariants({ className: 'w-full' })} disabled={loadingAction !== null}>
              {loadingAction === 'password' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              使用密碼登入
            </button>
          </form>

        </CardContent>
      </Card>
    </div>
  )
}
