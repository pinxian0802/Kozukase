'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FormFieldError } from '@/components/shared/form-field-error'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ReportDialogProps {
  listing_id?: string
  review_id?: string
  connection_id?: string
  seller_id?: string
  iconOnly?: boolean
  triggerClassName?: string
  /** 受控開關（不傳則自行管理） */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 隱藏自帶的檢舉觸發按鈕（由外部開啟時使用） */
  hideTrigger?: boolean
}

export function ReportDialog({ iconOnly, triggerClassName, open: openProp, onOpenChange, hideTrigger, ...props }: ReportDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next)
    else setInternalOpen(next)
  }
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
      setReasonError('請填寫檢舉原因')
      return
    }
    setReasonError('')
    report.mutate({ ...props, reason: trimmedReason })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : iconOnly ? (
        <DialogTrigger nativeButton render={<Button variant="outline" size="icon-xl" className={cn("rounded-[10px] text-text-muted", triggerClassName)} />}>
          <Flag className="h-4 w-4" />
        </DialogTrigger>
      ) : (
        <DialogTrigger nativeButton render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
          <Flag className="mr-1 h-4 w-4" />
          檢舉
        </DialogTrigger>
      )}

      <DialogContent showCloseButton className="sm:max-w-md">
        <div className="flex items-start justify-between">
          <div>
            <DialogTitle>檢舉內容</DialogTitle>
            <p className="mt-1.5 text-sm text-muted-foreground">我們會盡快審核並處理您的回報</p>
          </div>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
          noValidate
        >
          <div className="space-y-1.5">
            <Textarea
              id="report-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (reasonError) setReasonError('')
              }}
              placeholder="請描述您的檢舉原因，例如：內容涉及詐騙、廣告不實..."
              maxLength={500}
              rows={4}
              aria-invalid={!!reasonError}
              className={cn(
                "resize-none rounded-[14px] text-sm placeholder:text-muted-foreground/50",
                "border-border-soft bg-surface-muted transition-colors",
                "focus:border-brand-500 focus:bg-surface-card",
                reasonError && "border-red-400"
              )}
            />
            <div className="flex min-h-[18px] items-center">
              <FormFieldError message={reasonError} />
              <span className={cn(
                "ml-auto text-[11px] tabular-nums transition-colors",
                reason.length > 450 ? "text-orange-500" : "text-muted-foreground/40"
              )}>
                {reason.length}/500
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <DialogClose render={<Button variant="outline-soft" className="rounded-[12px]" />}>
              取消
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              className="rounded-[12px]"
              disabled={report.isPending}
            >
              {report.isPending ? '送出中...' : '送出檢舉'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
