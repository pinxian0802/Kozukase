'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2, Mail, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FormFieldError } from '@/components/shared/form-field-error'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { trpc } from '@/lib/trpc/client'
import {
  buildAuthCallbackUrl,
  getAuthErrorMessage,
  getSafeNextPath,
} from '@/lib/supabase/auth-error'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type RegisterAction = 'google' | 'email' | null

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const utils = trpc.useUtils()

  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [loadingAction, setLoadingAction] = useState<RegisterAction>(null)
  const [emailError, setEmailError] = useState<string | undefined>()
  const [agreed, setAgreed] = useState(false)

  const safeNext = useMemo(
    () => getSafeNextPath(searchParams.get('next')),
    [searchParams]
  )

  const handleGoogleRegister = async () => {
    if (!agreed) return
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

  const sendOtp = async (targetEmail: string) => {
    const supabase = createSupabaseBrowserClient()
    return supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(window.location.origin, safeNext),
        shouldCreateUser: true,
      },
    })
  }

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) return
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setEmailError('Email 為必填')
      return
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError('Email 格式不正確')
      return
    }

    setEmailError(undefined)
    setLoadingAction('email')

    try {
      const { registered } = await utils.auth.checkEmailRegistered.fetch({
        email: trimmedEmail,
      })
      if (registered) {
        setEmailError('此 Email 已註冊，請前往登入')
        setLoadingAction(null)
        return
      }
    } catch {
      // 檢查服務異常時不阻擋註冊：寄出的仍是一次性連結，對既有帳號只會變成登入連結，無重複建立風險。
    }

    const { error } = await sendOtp(trimmedEmail)
    setLoadingAction(null)

    if (error) {
      toast.error(getAuthErrorMessage(error, '驗證信寄送失敗，請稍後再試'))
      return
    }

    setEmailSent(true)
  }

  const handleResend = async () => {
    setLoadingAction('email')
    const { error } = await sendOtp(email.trim())
    setLoadingAction(null)

    if (error) {
      toast.error(getAuthErrorMessage(error, '驗證信寄送失敗，請稍後再試'))
      return
    }

    toast.success('已重新寄送驗證信')
  }

  const handleChangeEmail = () => {
    setEmailSent(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="relative w-full max-w-sm shadow-none py-6">
        <Link
          href="/"
          aria-label="返回首頁"
          className="absolute left-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <CardHeader className="space-y-4 text-center pb-8">
          <Link href="/" className="mx-auto inline-block">
            <Image src="/logo-navbar.png" alt="Kozukase" width={502} height={177} className="mx-auto h-8 w-auto" priority />
          </Link>
          <div className="space-y-1.5">
            <CardTitle className="text-base font-medium text-foreground">建立帳號</CardTitle>
            <CardDescription className="text-sm">
              已經有帳號？
              <Link href={`/login?next=${encodeURIComponent(safeNext)}`} className="ml-1 text-foreground underline underline-offset-4 hover:text-muted-foreground">
                前往登入
              </Link>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {emailSent ? (
            <div className="space-y-5 py-2 text-center">
              <svg viewBox="0 0 32 32" role="img" aria-hidden className="mx-auto h-14 w-14">
                <g fill="none">
                  <rect width="30" height="22" x="1" y="5" fill="#B4ACBC" rx="1.5" />
                  <rect width="28" height="18" x="2" y="7" fill="#CDC4D6" rx="1" />
                  <path fill="#E1D8EC" d="m30 23.4l-12.971-7.782a2 2 0 0 0-2.058 0L2 23.4V25a1 1 0 0 0 1 1h26a1 1 0 0 0 1-1z" />
                  <path fill="#998EA4" d="M2 9.766V8h28v1.766L17.544 17.24a3 3 0 0 1-3.088 0z" />
                  <path fill="#F3EEF8" d="M2 8.6V7a1 1 0 0 1 1-1h26a1 1 0 0 1 1 1v1.6l-12.971 7.783a2 2 0 0 1-2.058 0z" />
                </g>
              </svg>
              <div className="space-y-1.5">
                <p className="text-base font-medium text-foreground">驗證信已寄出</p>
                <p className="text-sm text-muted-foreground">
                  我們已將驗證連結寄到
                  <span className="mt-0.5 block break-all font-medium text-foreground">{email.trim()}</span>
                </p>
                <p className="text-sm text-muted-foreground">請點開信件完成註冊。</p>
              </div>
              <p className="text-xs text-muted-foreground">
                沒收到？請檢查垃圾信件匣，或稍候幾分鐘再試。
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  className={buttonVariants({ variant: 'outline', className: 'w-full' })}
                  onClick={handleResend}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === 'email' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  重新寄送
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleChangeEmail}
                  disabled={loadingAction !== null}
                >
                  換一個 Email
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleRegister}
                disabled={loadingAction !== null || !agreed}
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

              <form onSubmit={handleEmailRegister} className="space-y-4" noValidate>
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

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={agreed}
                    onCheckedChange={(v) => setAgreed(v === true)}
                    className="mt-0.5"
                    aria-label="我已閱讀並同意使用者條款與隱私權政策"
                  />
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    我已閱讀並同意{' '}
                    <Link href="/terms" target="_blank" className="text-foreground underline underline-offset-4 hover:text-muted-foreground">
                      使用者條款
                    </Link>
                    {' '}與{' '}
                    <Link href="/privacy" target="_blank" className="text-foreground underline underline-offset-4 hover:text-muted-foreground">
                      隱私權政策
                    </Link>
                  </span>
                </label>

                <button
                  type="submit"
                  className={buttonVariants({ className: 'w-full' })}
                  disabled={loadingAction !== null || !agreed}
                >
                  {loadingAction === 'email' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  寄送驗證信
                </button>

                {!agreed ? (
                  <p className="text-center text-xs text-muted-foreground">
                    勾選同意條款後，即可使用 Google 或 Email 註冊
                  </p>
                ) : null}
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
