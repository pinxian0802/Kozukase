"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format, parseISO } from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  invalid?: boolean
  minDate?: Date
  name?: string
  form?: string
  required?: boolean
}

function DatePicker({
  value,
  onValueChange,
  placeholder = "選擇日期",
  className,
  disabled,
  invalid,
  minDate,
  name,
  form,
  required,
}: DatePickerProps) {
  const [invalidState, setInvalid] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const triggerId = React.useId()
  const isInvalid = invalid ?? invalidState
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined
    const parsed = parseISO(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }, [value])

  React.useEffect(() => {
    if (selectedDate) {
      setInvalid(false)
    }
  }, [selectedDate])

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen} triggerId={triggerId}>
        <PopoverTrigger
          id={triggerId}
          className={cn(
            buttonVariants({
              variant: "outline",
              className:
                "w-full justify-start bg-transparent text-left font-normal hover:bg-transparent aria-expanded:bg-transparent focus-visible:border-ring focus-visible:ring-0 aria-invalid:border-destructive aria-invalid:ring-0 data-[invalid=true]:border-destructive data-[invalid=true]:ring-0 dark:bg-transparent dark:hover:bg-transparent",
            }),
            !selectedDate && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          aria-invalid={isInvalid || undefined}
          data-invalid={isInvalid || undefined}
          type="button"
        >
          <span>{selectedDate ? format(selectedDate, "yyyy/MM/dd") : placeholder}</span>
          <CalendarIcon className="ml-auto size-4 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" positionMethod="fixed" initialFocus={false}>
          <Calendar
            mode="single"
            selected={selectedDate}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(date) => {
              setInvalid(false)
              setOpen(false)
              onValueChange(date ? format(date, "yyyy-MM-dd") : "")
            }}
            className="rounded-xl"
          />
        </PopoverContent>
      </Popover>
      <input
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        type="date"
        value={value ?? ""}
        name={name}
        form={form}
        required={required}
        onInvalid={() => setInvalid(true)}
        onInput={() => setInvalid(false)}
        readOnly
      />
    </div>
  )
}

export { DatePicker }
