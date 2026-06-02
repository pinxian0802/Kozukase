"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format, parseISO } from "date-fns"
import { type DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateRangePickerProps {
  startDate?: string
  endDate?: string
  onRangeChange: (range: { startDate: string; endDate: string }) => void
  startPlaceholder?: string
  endPlaceholder?: string
  className?: string
  disabled?: boolean
  invalid?: boolean
  minDate?: Date
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
  startPlaceholder = "開始日期",
  endPlaceholder = "結束日期",
  className,
  disabled,
  invalid,
  minDate,
}: DateRangePickerProps) {
  const from = parseDate(startDate)
  const to = parseDate(endDate)
  const selected: DateRange | undefined = from ? { from, to } : undefined

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        aria-invalid={invalid || undefined}
        data-invalid={invalid || undefined}
        type="button"
        className={cn(
          buttonVariants({
            variant: "outline",
            className:
              "w-full justify-start bg-transparent text-left font-normal hover:bg-transparent aria-expanded:bg-transparent focus-visible:border-ring focus-visible:ring-0 aria-invalid:border-destructive aria-invalid:ring-0 data-[invalid=true]:border-destructive data-[invalid=true]:ring-0 dark:bg-transparent dark:hover:bg-transparent",
          }),
          !from && "text-muted-foreground",
          className
        )}
      >
        {from ? (
          <>
            {format(from, "yyyy/MM/dd")}
            {" – "}
            {to ? format(to, "yyyy/MM/dd") : endPlaceholder}
          </>
        ) : (
          <span>{startPlaceholder} – {endPlaceholder}</span>
        )}
        <CalendarIcon className="ml-auto size-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={from}
          selected={selected}
          numberOfMonths={2}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(range) => {
            onRangeChange({
              startDate: range?.from ? format(range.from, "yyyy-MM-dd") : "",
              endDate: range?.to ? format(range.to, "yyyy-MM-dd") : "",
            })
          }}
          className="rounded-xl"
        />
      </PopoverContent>
    </Popover>
  )
}

export { DateRangePicker }
