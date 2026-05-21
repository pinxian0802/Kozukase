'use client'

import { Share2, Link2, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useShare } from '@/lib/hooks/use-share'

interface SharePopoverProps {
  title: string
  triggerClassName?: string
}

export function SharePopover({ title, triggerClassName }: SharePopoverProps) {
  const { copied, copyLink, shareToLine, shareToThreads } = useShare(title)

  return (
    <Popover>
      <PopoverTrigger
        title="分享"
        className={
          triggerClassName ??
          'h-11 w-11 rounded-xl bg-background border border-border-soft text-muted-foreground flex items-center justify-center cursor-pointer hover:bg-muted/50 active:scale-[0.96] transition-all'
        }
      >
        <Share2 className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="end">
        <button
          onClick={copyLink}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left cursor-pointer"
        >
          {copied ? (
            <Check className="h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <Link2 className="h-4 w-4 shrink-0" />
          )}
          {copied ? '已複製！' : '複製連結'}
        </button>
        <button
          onClick={shareToLine}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left cursor-pointer"
        >
          <span className="h-4 w-4 shrink-0 flex items-center justify-center text-[11px] font-bold text-[#00b900]">L</span>
          分享到 LINE
        </button>
        <button
          onClick={shareToThreads}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left cursor-pointer"
        >
          <span className="h-4 w-4 shrink-0 flex items-center justify-center text-[13px] font-bold">@</span>
          分享到 Threads
        </button>
      </PopoverContent>
    </Popover>
  )
}
