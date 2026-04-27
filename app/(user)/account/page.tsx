'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FormFieldError } from '@/components/shared/form-field-error'
import { AvatarUpload } from '@/components/shared/avatar-upload'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function AccountPage() {
  const session = useSession()
  const router = useRouter()

  const [displayName, setDisplayName] = useState(session?.profile?.display_name ?? '')
  const [displayNameError, setDisplayNameError] = useState('')
  const [avatarValue, setAvatarValue] = useState<{ url: string; r2Key: string } | null>(
    session?.profile?.avatar_url ? { url: session.profile.avatar_url, r2Key: '' } : null,
  )
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success('已更新')
      router.refresh()
    },
    onError: (err) => toast.error(err.message),
  })

  if (!session?.profile) return null

  const isPending = updateProfile.isPending || getPresignedUrl.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setDisplayNameError('顯示名稱為必填')
      return
    }
    setDisplayNameError('')

    let finalAvatarUrl: string | null = avatarValue?.url ?? null

    if (pendingFile) {
      try {
        const [uploaded] = await uploadImageFiles('avatar', [pendingFile], getPresignedUrl.mutateAsync)
        finalAvatarUrl = uploaded.url
        setAvatarValue(uploaded)
        setPendingFile(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '圖片上傳失敗')
        return
      }
    }

    updateProfile.mutate({
      display_name: displayName.trim(),
      avatar_url: finalAvatarUrl,
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>個人資料</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <Label>頭貼</Label>
              <AvatarUpload
                value={avatarValue}
                onChange={setAvatarValue}
                pendingFile={pendingFile}
                onPendingFileChange={setPendingFile}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="username">ID</Label>
              <Input
                id="username"
                value={`@${session.profile.username}`}
                readOnly
                className="mt-1 text-muted-foreground"
              />
            </div>

            <div>
              <Label htmlFor="display-name">顯示名稱 <span className="text-destructive">*</span></Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  if (displayNameError) setDisplayNameError('')
                }}
                maxLength={50}
                className="mt-1"
                aria-invalid={!!displayNameError}
              />
              <FormFieldError message={displayNameError} />
            </div>

            <button
              type="submit"
              className={buttonVariants({ className: 'w-full' })}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              儲存變更
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
