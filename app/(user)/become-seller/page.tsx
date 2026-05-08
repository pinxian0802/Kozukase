'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Store, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MultiSelect } from '@/components/ui/multi-select'
import { FormFieldError } from '@/components/shared/form-field-error'
import { AvatarUpload } from '@/components/shared/avatar-upload'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'
import Link from 'next/link'

export default function SettingsPage() {
  const router = useRouter()
  const session = useSession()
  const { data: regions } = trpc.seller.getRegions.useQuery()

  const [sellerName, setSellerName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [avatarImage, setAvatarImage] = useState<{ url: string; r2Key: string } | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<{ sellerName?: string; phone?: string; regions?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const becomeSeller = trpc.seller.becomeSeller.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  if (!session?.profile) return null

  if (session.isSeller) {
    return (
      <div className="min-h-screen bg-[#FAFAFD]">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Card className="ring-0 shadow-sm bg-white">
          <CardHeader>
            <CardTitle>你已經是賣家了</CardTitle>
            <CardDescription>前往賣家後台管理你的上架商品</CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/dashboard" />}>
              <Store className="mr-2 h-4 w-4" />前往賣家後台
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: { sellerName?: string; phone?: string; regions?: string } = {}

    if (!sellerName.trim()) {
      nextErrors.sellerName = '賣家名稱為必填'
    }

    if (!phone.trim()) {
      nextErrors.phone = '手機號碼為必填'
    }

    if (selectedRegions.length === 0) {
      nextErrors.regions = '請至少選擇一個代購地區'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setIsSubmitting(true)

    let finalAvatarUrl = avatarImage?.url
    let uploadedR2Key: string | null = null

    try {
      if (pendingFile) {
        const [uploaded] = await uploadImageFiles('avatar', [pendingFile], getPresignedUrl.mutateAsync)
        finalAvatarUrl = uploaded.url
        uploadedR2Key = uploaded.r2Key
      }

      await becomeSeller.mutateAsync({
        name: sellerName.trim(),
        phone_number: phone.trim(),
        region_ids: selectedRegions,
        bio: bio.trim() || undefined,
        avatar_url: finalAvatarUrl,
      })

      toast.success('成功成為賣家！')
      router.push('/dashboard')
    } catch (err: unknown) {
      if (uploadedR2Key) {
        await deleteObjects.mutateAsync({ r2Keys: [uploadedR2Key] }).catch(() => {})
      }
      toast.error(err instanceof Error ? err.message : '操作失敗')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFD]">
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Card className="ring-0 shadow-sm bg-white">
        <CardHeader>
          <CardTitle>成為賣家</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
              <Label className="pt-2">頭貼</Label>
              <AvatarUpload
                value={avatarImage}
                onChange={setAvatarImage}
                pendingFile={pendingFile}
                onPendingFileChange={setPendingFile}
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
              <Label htmlFor="sellerName" className="pt-2">賣家名稱 <span className="text-destructive">*</span></Label>
              <div>
                <Input
                  id="sellerName"
                  value={sellerName}
                  onChange={(e) => {
                    setSellerName(e.target.value)
                    if (errors.sellerName) {
                      setErrors((current) => {
                        const next = { ...current }
                        delete next.sellerName
                        return next
                      })
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                  placeholder="你的店家名稱"
                  maxLength={50}
                  aria-invalid={!!errors.sellerName}
                />
                <FormFieldError message={errors.sellerName} />
              </div>
            </div>

            <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
              <Label htmlFor="phone" className="pt-2">手機號碼 <span className="text-destructive">*</span></Label>
              <div>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    if (errors.phone) {
                      setErrors((current) => {
                        const next = { ...current }
                        delete next.phone
                        return next
                      })
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                  placeholder="0912345678"
                  type="tel"
                  aria-invalid={!!errors.phone}
                />
                <FormFieldError message={errors.phone} />
              </div>
            </div>

            <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
              <Label className="pt-2">代購地區 <span className="text-destructive">*</span></Label>
              <div>
                <MultiSelect
                  value={selectedRegions}
                  onValueChange={(ids) => {
                    setSelectedRegions(ids)
                    if (errors.regions) {
                      setErrors((current) => {
                        const next = { ...current }
                        delete next.regions
                        return next
                      })
                    }
                  }}
                  options={(regions ?? []).map((r: any) => ({ value: r.id, label: r.name }))}
                  placeholder="選擇代購地區"
                  searchPlaceholder="搜尋地區..."
                  emptyText="找不到相符的地區"
                  invalid={!!errors.regions}
                />
                <FormFieldError message={errors.regions} />
              </div>
            </div>

            <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
              <Label htmlFor="bio" className="pt-2">簡介</Label>
              <div>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="介紹你的代購服務、專長地區或購物風格…"
                  maxLength={300}
                  rows={4}
                  className="resize-none"
                />
                <p className="mt-1 text-xs text-muted-foreground text-right">{bio.length}/300</p>
              </div>
            </div>

            <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
              <div />
              <button type="submit" className={buttonVariants({ className: 'w-fit justify-self-end' })} disabled={isSubmitting || becomeSeller.isPending || getPresignedUrl.isPending}>
                {becomeSeller.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
                開始成為賣家
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </div>
  )
}
