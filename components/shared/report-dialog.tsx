'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { FormFieldError } from '@/components/shared/form-field-error'
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
  const [reasonError, setReasonError] = useState('')
  const report = trpc.report.create.useMutation({
    onSuccess: () => {
      toast.success('檢舉已送出，我們會盡快處理')
      setOpen(false)
      setReason('')
      setReasonError('')
    },
    onError: () => {
      toast.error('檢舉送出失敗，請稍後再試')
    },
  })

  const handleSubmit = () => {
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setReasonError('檢舉原因為必填')
      return
    }

    setReasonError('')
    report.mutate({ ...props, reason: trimmedReason })
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
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); handleSubmit() }} noValidate>
          <div>
            <Label htmlFor="report-reason">檢舉原因</Label>
            <Textarea
              id="report-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (reasonError) setReasonError('')
              }}
              placeholder="請描述檢舉的原因..."
              maxLength={500}
              rows={4}
              aria-invalid={!!reasonError}
            />
            <FormFieldError message={reasonError} />
            <p className="mt-1 text-xs text-muted-foreground">{reason.length}/500</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <button type="submit" disabled={report.isPending} className={buttonVariants()}>
              {report.isPending ? '送出中...' : '送出檢舉'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
