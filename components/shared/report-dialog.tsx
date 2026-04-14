'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

interface ReportDialogProps {
  listing_id?: string
  review_id?: string
  connection_id?: string
  seller_id?: string
}

export function ReportDialog(props: ReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const report = trpc.report.create.useMutation({
    onSuccess: () => {
      toast.success('檢舉已送出，我們會盡快處理')
      setOpen(false)
      setReason('')
    },
    onError: () => {
      toast.error('檢舉送出失敗，請稍後再試')
    },
  })

  const handleSubmit = () => {
    if (!reason.trim()) return
    report.mutate({ ...props, reason: reason.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
          <Flag className="mr-1 h-4 w-4" />
          檢舉
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>檢舉</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>檢舉原因</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="請描述檢舉的原因..."
              maxLength={500}
              rows={4}
            />
            <p className="mt-1 text-xs text-muted-foreground">{reason.length}/500</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={!reason.trim() || report.isPending}>
            {report.isPending ? '送出中...' : '送出檢舉'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
