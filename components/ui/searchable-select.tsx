'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

export interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  invalid?: boolean
  disabled?: boolean
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = '請選擇',
  searchPlaceholder = '搜尋...',
  emptyText = '找不到結果',
  className,
  invalid,
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        aria-invalid={invalid}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none select-none',
          'focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
          invalid && 'border-destructive',
          !selected && 'text-muted-foreground',
          className
        )}
      >
        <span className="flex-1 truncate text-left">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        className="w-(--anchor-width) min-w-36 p-0"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value)
                    setOpen(false)
                  }}
                  data-checked={value === option.value}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
