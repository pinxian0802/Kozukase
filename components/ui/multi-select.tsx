'use client'

import * as React from 'react'
import { X, ChevronDown } from 'lucide-react'
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

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  value: string[]
  onValueChange: (value: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  invalid?: boolean
  disabled?: boolean
}

export function MultiSelect({
  value,
  onValueChange,
  options,
  placeholder = '請選擇',
  searchPlaceholder = '搜尋...',
  emptyText = '找不到結果',
  className,
  invalid,
  disabled,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onValueChange(value.filter((v) => v !== id))
    } else {
      onValueChange([...value, id])
    }
  }

  const selectedOptions = options.filter((o) => value.includes(o.value))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        aria-invalid={invalid}
        className={cn(
          'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm transition-colors outline-none',
          'focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
          invalid && 'border-destructive',
          className
        )}
      >
        {selectedOptions.length === 0 ? (
          <span className="flex-1 text-left text-muted-foreground">{placeholder}</span>
        ) : (
          selectedOptions.map((option) => (
            <span
              key={option.value}
              className="flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium"
            >
              {option.label}
              <span
                role="button"
                tabIndex={-1}
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onValueChange(value.filter((v) => v !== option.value)) }}
                className="ml-0.5 cursor-pointer rounded-full opacity-60 hover:opacity-100 focus:opacity-100"
              >
                <X className="size-3" />
              </span>
            </span>
          ))
        )}
        <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
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
                  onSelect={() => toggle(option.value)}
                  data-checked={value.includes(option.value)}
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
