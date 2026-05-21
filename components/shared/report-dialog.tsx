'use client'

import { useState } from 'react'
import { Flag, X } from 'lucide-react'
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
}

export function ReportDialog({ iconOnly, triggerClassName, ...props }: ReportDialogProps) {
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
      setReasonError('請填寫檢舉原因')
      return
    }
    setReasonError('')
    report.mutate({ ...props, reason: trimmedReason })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {iconOnly ? (
        <DialogTrigger nativeButton render={<Button variant="outline" size="icon" className={cn("h-11 w-11 rounded-[10px] text-text-muted", triggerClassName)} />}>
          <Flag className="h-4 w-4" />
        </DialogTrigger>
      ) : (
        <DialogTrigger nativeButton render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
          <Flag className="mr-1 h-4 w-4" />
          檢舉
        </DialogTrigger>
      )}

      <DialogContent showCloseButton={false} className="gap-0 p-0 overflow-hidden sm:max-w-md rounded-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border-soft px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50">
            <Flag className="h-3.5 w-3.5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-[15px] font-semibold leading-none text-foreground">檢舉內容</DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">我們會盡快審核並處理您的回報</p>
          </div>
          <DialogClose
            render={
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              />
            }
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </div>

        {/* Body */}
        <form
          className="flex flex-col gap-4 px-5 py-5"
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
                "resize-none rounded-xl text-sm placeholder:text-muted-foreground/50",
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
            <DialogClose
              render={
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl text-sm font-medium text-text-muted border border-border-soft bg-surface-card hover:bg-surface-muted transition-colors cursor-pointer"
                />
              }
            >
              取消
            </DialogClose>
            <button
              type="submit"
              disabled={report.isPending}
              className="h-10 px-5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {report.isPending ? '送出中...' : '送出檢舉'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
