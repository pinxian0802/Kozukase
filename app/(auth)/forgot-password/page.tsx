'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormFieldError } from '@/components/shared/form-field-error'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/supabase/auth-error'

type ForgotPasswordAction = 'email' | null

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [loadingAction, setLoadingAction] = useState<ForgotPasswordAction>(null)
  const [emailError, setEmailError] = useState<string | undefined>()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setEmailError('Email 為必填')
      return
    }

    setEmailError(undefined)
    setLoadingAction('email')

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/callback?type=recovery&next=/reset-password`,
    })

    setLoadingAction(null)

    if (error) {
      toast.error(getAuthErrorMessage(error, '重設密碼信寄送失敗，請稍後再試'))
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
          <CardTitle className="text-base font-medium">忘記密碼</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {emailSent ? (
            <div className="rounded-md border bg-muted p-4 text-sm">
              <p className="font-medium">重設連結已寄出</p>
              <p className="mt-1 text-muted-foreground">
                請到 <span className="font-medium text-foreground">{email.trim()}</span> 的信箱點擊連結繼續。
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
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
                寄送重設連結
              </button>
            </form>
          )}

          <div className="text-center">
            <Link href="/login" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
              返回登入
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
