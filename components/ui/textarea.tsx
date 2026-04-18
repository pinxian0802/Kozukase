import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 invalid:border-destructive invalid:ring-0 invalid:focus-visible:border-destructive aria-invalid:border-destructive aria-invalid:ring-0 data-[invalid=true]:border-destructive data-[invalid=true]:ring-0 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:invalid:border-destructive/50 dark:aria-invalid:border-destructive/50 dark:data-[invalid=true]:border-destructive/50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
