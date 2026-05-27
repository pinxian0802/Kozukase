'use client'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function ToastTestPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Toast 測試</h1>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => toast.success('操作成功！')}>success</Button>
        <Button variant="outline" onClick={() => toast.error('發生錯誤！')}>error</Button>
        <Button variant="outline" onClick={() => toast.warning('請注意！')}>warning</Button>
        <Button variant="outline" onClick={() => toast.info('這是資訊')}>info</Button>
        <Button variant="outline" onClick={() => toast.loading('載入中...')}>loading</Button>
        <Button variant="outline" onClick={() => toast('一般通知')}>default</Button>
      </div>
    </div>
  )
}
