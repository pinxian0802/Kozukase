'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <Link href="/" className="font-heading text-3xl font-bold text-primary">
            Kozukase
          </Link>
          <CardTitle className="text-xl">忘記密碼</CardTitle>
          <CardDescription>輸入你的 Email，我們會寄出重設密碼連結</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <Badge variant="secondary" className="px-2 text-muted-foreground">
                透過 Email 重設
              </Badge>
            </div>
          </div>

          {emailSent ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
              <p className="font-medium">重設密碼連結已寄出</p>
              <p className="mt-1">
                重設密碼連結已寄至 <span className="font-medium">{email.trim()}</span>，請點擊信中連結繼續。
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

          <div className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              返回登入
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
