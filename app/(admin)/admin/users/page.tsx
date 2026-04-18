'use client'

import { useState } from 'react'
import { Search, Shield, User } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/format'

type AdminUserRow = {
  id: string
  email: string | null
  display_name: string
  avatar_url: string | null
  is_seller: boolean
  is_admin: boolean
  created_at: string
  last_sign_in_at: string | null
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.admin.listUsers.useQuery({ search: search || undefined })

  const setUserAdmin = trpc.admin.setUserAdmin.useMutation({
    onSuccess: () => {
      toast.success('已更新管理員權限')
      utils.admin.listUsers.invalidate()
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold font-heading">使用者管理</h1>
        <p className="text-sm text-muted-foreground">列出所有使用者，並指派或取消管理員權限。</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 email 或名稱..."
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : data?.items.length ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">使用者</th>
                <th className="px-4 py-3 font-medium">角色</th>
                <th className="px-4 py-3 font-medium">建立時間</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user: AdminUserRow) => (
                <tr key={user.id} className="border-b last:border-b-0">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{user.display_name}</p>
                        <p className="text-xs text-muted-foreground">{user.email ?? '未設定 email'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {user.is_admin ? (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">管理員</Badge>
                      ) : (
                        <Badge variant="outline">一般使用者</Badge>
                      )}
                      {user.is_seller && (
                        <Badge variant="secondary">賣家</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-4 text-right">
                    <Button
                      size="sm"
                      variant={user.is_admin ? 'outline' : 'default'}
                      onClick={() => setUserAdmin.mutate({ user_id: user.id, is_admin: !user.is_admin })}
                      disabled={setUserAdmin.isPending}
                    >
                      {user.is_admin ? '取消管理員' : '設為管理員'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <Shield className="mx-auto mb-3 h-8 w-8 text-primary/60" />
          找不到符合條件的使用者
        </div>
      )}
    </div>
  )
}
