'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Store, Loader2, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { FormFieldError } from '@/components/shared/form-field-error'
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
  const [errors, setErrors] = useState<{ sellerName?: string; phone?: string; regions?: string }>({})

  const becomeSeller = trpc.seller.becomeSeller.useMutation({
    onSuccess: () => {
      toast.success('成功成為賣家！')
      router.push('/dashboard')
    },
    onError: (err) => toast.error(err.message),
  })

  if (!session?.profile) return null

  if (session.isSeller) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Card>
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
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
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
    becomeSeller.mutate({
      name: sellerName.trim(),
      phone_number: phone.trim(),
      region_ids: selectedRegions,
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            成為賣家
          </CardTitle>
          <CardDescription>
            填寫以下資料開始在 Kozukase 上架代購商品
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <Label htmlFor="sellerName">賣家名稱 *</Label>
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
                placeholder="你的店家名稱"
                maxLength={50}
                aria-invalid={!!errors.sellerName}
              />
              <FormFieldError message={errors.sellerName} />
            </div>

            <div>
              <Label htmlFor="phone">手機號碼 *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912345678"
                type="tel"
              />
              <p className="mt-1 text-xs text-muted-foreground">不會公開顯示，僅供平台聯繫使用</p>
            </div>

            <div>
              <Label>代購地區 *</Label>
              <p className="text-xs text-muted-foreground mb-2">選擇你提供代購服務的地區</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {(regions ?? []).map((region: any) => (
                  <div key={region.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`region-${region.id}`}
                      checked={selectedRegions.includes(region.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedRegions([...selectedRegions, region.id])
                        else setSelectedRegions(selectedRegions.filter(r => r !== region.id))

                        if (errors.regions) {
                          setErrors((current) => {
                            const next = { ...current }
                            delete next.regions
                            return next
                          })
                        }
                      }}
                    />
                    <Label htmlFor={`region-${region.id}`} className="text-sm">{region.name}</Label>
                  </div>
                ))}
              </div>
              <FormFieldError message={errors.regions} />
            </div>

            <button type="submit" className={buttonVariants({ className: 'w-full' })} disabled={becomeSeller.isPending}>
              {becomeSeller.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
              開始成為賣家
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
