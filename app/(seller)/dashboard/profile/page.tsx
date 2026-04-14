'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

export default function SellerProfilePage() {
  const { data: session, isLoading } = trpc.auth.getSession.useQuery()
  
  const [name, setName] = useState('')
  const [igHandle, setIgHandle] = useState('')
  const [igFollowers, setIgFollowers] = useState('')
  const [threadsHandle, setThreadsHandle] = useState('')
  const [threadsFollowers, setThreadsFollowers] = useState('')

  useEffect(() => {
    const seller = session?.profile?.sellers as any
    if (seller) {
      setName(seller.name ?? '')
      setIgHandle(seller.ig_handle ?? '')
      setIgFollowers(seller.ig_follower_count?.toString() ?? '')
      setThreadsHandle(seller.threads_handle ?? '')
      setThreadsFollowers(seller.threads_follower_count?.toString() ?? '')
    }
  }, [session])

  const updateSeller = trpc.seller.update.useMutation({
    onSuccess: () => toast.success('已更新'),
    onError: (err) => toast.error(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateSeller.mutate({
      name: name || undefined,
      ig_handle: igHandle || undefined,
      ig_follower_count: igFollowers ? Number(igFollowers) : undefined,
      threads_handle: threadsHandle || undefined,
      threads_follower_count: threadsFollowers ? Number(threadsFollowers) : undefined,
    })
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full max-w-2xl rounded-xl" />
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>賣家資料設定</CardTitle>
          <CardDescription>管理你的賣家資訊和社群連結</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">賣家名稱</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className="mt-1" />
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-sm">社群連結</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="ig">Instagram 帳號</Label>
                  <Input id="ig" value={igHandle} onChange={(e) => setIgHandle(e.target.value)} placeholder="@youraccount" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="igFollowers">IG 粉絲數</Label>
                  <Input id="igFollowers" type="number" value={igFollowers} onChange={(e) => setIgFollowers(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="threads">Threads 帳號</Label>
                  <Input id="threads" value={threadsHandle} onChange={(e) => setThreadsHandle(e.target.value)} placeholder="@youraccount" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="threadsFollowers">Threads 粉絲數</Label>
                  <Input id="threadsFollowers" type="number" value={threadsFollowers} onChange={(e) => setThreadsFollowers(e.target.value)} className="mt-1" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">填寫社群帳號後將獲得認證標章</p>
            </div>

            <Button type="submit" disabled={updateSeller.isPending}>
              {updateSeller.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              儲存變更
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
