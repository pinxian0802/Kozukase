'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { FormFieldError } from '@/components/shared/form-field-error'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  buildAuthCallbackUrl,
  getAuthErrorMessage,
  getSafeNextPath,
} from '@/lib/supabase/auth-error'

type RegisterAction = 'google' | 'email' | null

export default function RegisterPage() {
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [loadingAction, setLoadingAction] = useState<RegisterAction>(null)
  const [emailError, setEmailError] = useState<string | undefined>()

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

    if (!trimmedEmail) {
      setEmailError('Email 為必填')
      return
    }

    setEmailError(undefined)
    setLoadingAction('email')
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(window.location.origin, safeNext),
        shouldCreateUser: true,
      },
    })
    setLoadingAction(null)

    if (error) {
      toast.error(getAuthErrorMessage(error, '驗證信寄送失敗，請稍後再試'))
      return
    }

    setEmailSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm shadow-none">
        <CardHeader className="space-y-1 text-center pb-4">
          <Link href="/" className="font-heading text-2xl font-bold text-foreground tracking-tight">
            Kozukase
          </Link>
          <CardTitle className="text-base font-medium text-foreground">建立帳號</CardTitle>
          <CardDescription className="text-sm">
            已經有帳號？
            <Link href={`/login?next=${encodeURIComponent(safeNext)}`} className="ml-1 text-foreground underline underline-offset-4 hover:text-muted-foreground">
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
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            使用 Google 註冊
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">或使用 Email 註冊</span>
            </div>
          </div>

          {emailSent ? (
            <div className="rounded-md border bg-muted p-4 text-sm">
              <p className="font-medium">驗證信已寄出</p>
              <p className="mt-1 text-muted-foreground">請到 <span className="font-medium text-foreground">{email.trim()}</span> 的信箱點擊連結完成驗證。</p>
            </div>
          ) : (
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
                    if (emailError) setEmailError(undefined)
                  }}
                  placeholder="your@email.com"
                  aria-invalid={!!emailError}
                  className="mt-1"
                />
                <FormFieldError message={emailError} />
              </div>

              <button
                type="submit"
                className={buttonVariants({ className: 'w-full' })}
                disabled={loadingAction !== null}
              >
                {loadingAction === 'email' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                寄送驗證信
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
