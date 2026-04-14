import { ShieldCheck } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function SocialBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <ShieldCheck className="h-4 w-4 text-primary" />
        </TooltipTrigger>
        <TooltipContent>
          <p>已連結社群帳號</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
