'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormFieldError } from '@/components/shared/form-field-error'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/supabase/auth-error'

type ResetPasswordErrors = {
  password?: string
  confirmPassword?: string
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const handled = useRef(false)

  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<ResetPasswordErrors>({})

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION') return
      if (handled.current) return
      handled.current = true

      if (session) {
        setReady(true)
      } else {
        toast.error('重設密碼連結已失效，請重新申請')
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: ResetPasswordErrors = {}

    if (password.length < 6) {
      nextErrors.password = '密碼至少需要 6 個字元'
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = '請再次輸入新密碼'
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = '兩次輸入的密碼不一致'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setLoading(true)

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      await supabase.auth.signOut()
      toast.error(getAuthErrorMessage(error, error.message || '密碼更新失敗，請稍後再試'))
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    toast.success('密碼已更新，請重新登入')
    router.replace('/login')
    router.refresh()
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-sm shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm shadow-none">
        <CardHeader className="space-y-1 text-center pb-4">
          <Link href="/" className="font-heading text-2xl font-bold text-foreground tracking-tight">
            Kozukase
          </Link>
          <CardTitle className="text-base font-medium">重設密碼</CardTitle>
          <CardDescription>請輸入新的密碼與確認密碼</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="password">新密碼</Label>
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
                  if (errors.confirmPassword) {
                    setErrors((current) => {
                      const next = { ...current }
                      delete next.confirmPassword
                      return next
                    })
                  }
                }}
                placeholder="再次輸入新密碼"
                aria-invalid={!!errors.confirmPassword}
                className="mt-1"
              />
              <FormFieldError message={errors.confirmPassword} />
            </div>

            <button type="submit" className={buttonVariants({ className: 'w-full' })} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              更新密碼
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
