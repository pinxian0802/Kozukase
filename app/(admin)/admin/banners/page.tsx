'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Trash2, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { SingleImageUpload } from '@/components/shared/single-image-upload'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { HomeHero } from '@/app/_home/home-hero'

type Banner = {
  id: string
  image_url: string
  image_r2_key: string
  link_url: string | null
  is_active: boolean
  sort_order: number
}

export default function AdminBannersPage() {
  const utils = trpc.useUtils()
  const { data: banners, isLoading } = trpc.banner.list.useQuery()
  const items: Banner[] = banners ?? []
  // 預覽用:只取上架的(與首頁 listActive 一致)
  const previewSlides = items
    .filter((b) => b.is_active)
    .map((b) => ({ id: b.id, src: b.image_url, href: b.link_url, alt: '' }))

  // 新增表單:選圖只暫存(deferred),按「新增」才上傳
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [newLink, setNewLink] = useState('')
  const [uploading, setUploading] = useState(false)

  const createMut = trpc.banner.create.useMutation({
    onSuccess: () => {
      utils.banner.list.invalidate()
      setPendingFile(null)
      setNewLink('')
      toast.success('已新增 banner')
    },
    onError: (e) => toast.error(e.message),
  })
  const updateMut = trpc.banner.update.useMutation({
    onSuccess: () => utils.banner.list.invalidate(),
    onError: (e) => toast.error(e.message),
  })
  const removeMut = trpc.banner.remove.useMutation({
    onSuccess: () => {
      utils.banner.list.invalidate()
      toast.success('已刪除')
    },
    onError: (e) => toast.error(e.message),
  })
  const reorderMut = trpc.banner.reorder.useMutation({
    onError: (e) => {
      toast.error(e.message)
      utils.banner.list.invalidate() // 失敗回復伺服器順序
    },
  })

  const handleAdd = async () => {
    if (!pendingFile) {
      toast.error('請先選擇圖片')
      return
    }
    // 按下「新增」時才真正上傳到 R2
    setUploading(true)
    let uploaded: { url: string; r2Key: string }
    try {
      ;[uploaded] = await uploadImageFiles('banner', [pendingFile], getPresignedUrl.mutateAsync)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '圖片上傳失敗')
      setUploading(false)
      return
    }
    setUploading(false)
    createMut.mutate({
      image_url: uploaded.url,
      image_r2_key: uploaded.r2Key,
      link_url: newLink.trim() || undefined,
    })
  }

  // 上移/下移排序
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    utils.banner.list.setData(undefined, next) // 樂觀更新清單順序
    reorderMut.mutate({ ids: next.map((b) => b.id) })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[17px] font-bold font-heading md:text-2xl">輪播管理</h1>
        <p className="mt-1 text-muted-foreground">
          設定首頁頂部的橫式 banner 輪播。建議圖片比例 16:6(桌機),例如 1920×720。用右側上/下箭頭調整順序。
        </p>
      </div>

      {/* 預覽:與首頁相同的輪播,縮小顯示 */}
      <div className="space-y-2">
        <h2 className="font-medium">預覽</h2>
        {previewSlides.length > 0 ? (
          <div className="mx-auto max-w-2xl">
            <HomeHero slides={previewSlides} arrowsInside />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">目前沒有上架的 banner,首頁不會顯示輪播區塊。</p>
        )}
      </div>

      {/* 新增 */}
      <div className="space-y-4 rounded-lg border p-4">
        <h2 className="font-medium">新增 banner</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SingleImageUpload
            purpose="banner"
            value={null}
            onChange={() => {}}
            pendingFile={pendingFile}
            onPendingFileChange={setPendingFile}
          />
          <div className="flex-1 space-y-2">
            <label className="text-sm text-muted-foreground">點擊連結(選填)</label>
            <Input
              placeholder="/search 或 https://..."
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
            />
          </div>
          <Button onClick={handleAdd} disabled={uploading || createMut.isPending}>
            {uploading || createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '新增'}
          </Button>
        </div>
      </div>

      {/* 清單 */}
      {isLoading ? (
        <p className="text-muted-foreground">載入中…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">尚未設定任何 banner。上傳第一張圖片即可開始。</p>
      ) : (
        <ul className="space-y-3">
          {items.map((b, i) => (
            <li key={b.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <span className="w-5 shrink-0 text-center text-sm font-medium text-muted-foreground">
                {i + 1}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image_url} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
              <div className="flex-1">
                <Input
                  defaultValue={b.link_url ?? ''}
                  placeholder="點擊連結(選填)"
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v === (b.link_url ?? '')) return
                    updateMut.mutate({ id: b.id, link_url: v || null })
                  }}
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={b.is_active}
                  onCheckedChange={(checked) => updateMut.mutate({ id: b.id, is_active: checked })}
                />
                <span className="w-10 text-sm text-muted-foreground">
                  {b.is_active ? '上架' : '下架'}
                </span>
              </div>
              {/* 上移 / 下移 */}
              <div className="flex shrink-0 flex-col">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="上移"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="下移"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="刪除"
                onClick={() => {
                  if (confirm('確定刪除這張 banner?')) removeMut.mutate({ id: b.id })
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
