'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { FormFieldError } from '@/components/shared/form-field-error'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  buildAuthCallbackUrl,
  getAuthErrorMessage,
  getSafeNextPath,
} from '@/lib/supabase/auth-error'

type RegisterAction = 'google' | 'email' | null
type RegisterErrors = {
  email?: string
  password?: string
  confirmPassword?: string
}

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [loadingAction, setLoadingAction] = useState<RegisterAction>(null)
  const [errors, setErrors] = useState<RegisterErrors>({})

  const safeNext = useMemo(
    () => getSafeNextPath(searchParams.get('next')),
    [searchParams]
  )

  const handleGoogleRegister = async () => {
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
      toast.error(getAuthErrorMessage(error, 'Google 註冊失敗，請稍後再試'))
    }
  }

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = email.trim()
    const nextErrors: RegisterErrors = {}

    if (!trimmedEmail) {
      nextErrors.email = 'Email 為必填'
    }

    if (!password) {
      nextErrors.password = '密碼為必填'
    } else if (password.length < 6) {
      nextErrors.password = '密碼至少需要 6 個字元'
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = '請再次輸入密碼'
    } else if (password && password !== confirmPassword) {
      nextErrors.confirmPassword = '兩次輸入的密碼不一致'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setLoadingAction('email')
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(window.location.origin, safeNext),
      },
    })
    setLoadingAction(null)

    if (error) {
      toast.error(getAuthErrorMessage(error, '註冊失敗，請稍後再試'))
      return
    }

    if (data.session) {
      toast.success('註冊成功，已自動登入')
      router.push(safeNext)
      router.refresh()
      return
    }

    setEmailSent(true)
    toast.success('註冊成功，驗證信已寄出')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <Link href="/" className="font-heading text-3xl font-bold text-primary">
            Kozukase
          </Link>
          <CardTitle className="text-xl">建立帳號</CardTitle>
          <CardDescription>
            已經有帳號？
            <Link href={`/login?next=${encodeURIComponent(safeNext)}`} className="ml-1 text-primary underline-offset-4 hover:underline">
              前往登入
            </Link>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleRegister}
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
            使用 Google 註冊
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <Badge variant="secondary" className="px-2 text-muted-foreground">或使用 Email</Badge>
            </div>
          </div>

          <form onSubmit={handleEmailRegister} className="space-y-3" noValidate>
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
              />
              <FormFieldError message={errors.email} />
            </div>

            <div>
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
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
                placeholder="至少 6 個字元"
                aria-invalid={!!errors.password}
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
                  if (errors.confirmPassword) {
                    setErrors((current) => {
                      const next = { ...current }
                      delete next.confirmPassword
                      return next
                    })
                  }
                }}
                placeholder="再次輸入密碼"
                aria-invalid={!!errors.confirmPassword}
              />
              <FormFieldError message={errors.confirmPassword} />
            </div>

            <button type="submit" className={buttonVariants({ className: 'w-full' })} disabled={loadingAction !== null}>
              {loadingAction === 'email' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              使用 Email 註冊
            </button>
          </form>

          {emailSent && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              驗證信已寄到 <span className="font-medium">{email.trim()}</span>，請完成驗證後再登入。
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => router.push(`/login?next=${encodeURIComponent(safeNext)}`)}
          >
            <Mail className="mr-2 h-4 w-4" />
            我已有帳號，前往登入
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
