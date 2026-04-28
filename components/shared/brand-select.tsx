'use client'

import * as React from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandEmpty,
} from '@/components/ui/command'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

// ── Single select ────────────────────────────────────────────────────────────

interface BrandSelectProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  invalid?: boolean
  disabled?: boolean
  deferred?: boolean
}

export function BrandSelect({
  value,
  onValueChange,
  placeholder = '選擇品牌',
  className,
  invalid,
  disabled,
  deferred,
}: BrandSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const utils = trpc.useUtils()
  const { data: brands = [] } = trpc.brand.list.useQuery()
  const createBrand = trpc.brand.create.useMutation()

  const pendingName = value.startsWith('__new__:') ? value.slice(8) : null
  const selected = pendingName ? null : brands.find((b) => b.id === value)

  const filtered = search
    ? brands.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : brands

  const exactMatch = brands.some((b) => b.name.toLowerCase() === search.trim().toLowerCase())
  const showCreate = search.trim().length > 0 && !exactMatch

  const handleCreate = async () => {
    if (deferred) {
      onValueChange('__new__:' + search.trim())
      setOpen(false)
      setSearch('')
      return
    }
    try {
      const brand = await createBrand.mutateAsync({ name: search.trim() })
      await utils.brand.list.invalidate()
      onValueChange(brand.id)
      setOpen(false)
      setSearch('')
    } catch (error: any) {
      toast.error(error.message ?? '新增品牌失敗')
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch('') }}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        aria-invalid={invalid}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none select-none',
          'focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
          invalid && 'border-destructive',
          !(selected || pendingName) && 'text-muted-foreground',
          className
        )}
      >
        <span className="flex-1 truncate text-left">{pendingName ?? (selected ? selected.name : placeholder)}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-36 p-0" align="start" sideOffset={4}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜尋或輸入品牌名稱..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 && !showCreate && (
              <CommandEmpty>找不到相符的品牌</CommandEmpty>
            )}
            <CommandGroup>
              {filtered.map((brand) => (
                <CommandItem
                  key={brand.id}
                  value={brand.id}
                  onSelect={() => {
                    onValueChange(brand.id)
                    setOpen(false)
                    setSearch('')
                  }}
                  data-checked={value === brand.id}
                >
                  {brand.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreate && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${search}`}
                  onSelect={handleCreate}
                  disabled={createBrand.isPending}
                  className="text-primary"
                >
                  <Plus className="mr-2 size-4" />
                  新增品牌「{search.trim()}」
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ── Multi select ─────────────────────────────────────────────────────────────

interface BrandMultiSelectProps {
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  className?: string
  invalid?: boolean
  disabled?: boolean
}

export function BrandMultiSelect({
  value,
  onValueChange,
  placeholder = '選擇品牌',
  className,
  invalid,
  disabled,
}: BrandMultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const utils = trpc.useUtils()
  const { data: brands = [] } = trpc.brand.list.useQuery()
  const createBrand = trpc.brand.create.useMutation()

  const selectedBrands = brands.filter((b) => value.includes(b.id))

  const filtered = search
    ? brands.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : brands

  const exactMatch = brands.some((b) => b.name.toLowerCase() === search.trim().toLowerCase())
  const showCreate = search.trim().length > 0 && !exactMatch

  const toggle = (id: string) => {
    onValueChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  const handleCreate = async () => {
    try {
      const brand = await createBrand.mutateAsync({ name: search.trim() })
      await utils.brand.list.invalidate()
      onValueChange([...value, brand.id])
      setSearch('')
    } catch (error: any) {
      toast.error(error.message ?? '新增品牌失敗')
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch('') }}>
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
        {selectedBrands.length === 0 ? (
          <span className="flex-1 text-left text-muted-foreground">{placeholder}</span>
        ) : (
          selectedBrands.map((brand) => (
            <span
              key={brand.id}
              className="flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium"
            >
              {brand.name}
              <span
                role="button"
                tabIndex={-1}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onValueChange(value.filter((v) => v !== brand.id))
                }}
                className="ml-0.5 cursor-pointer rounded-full opacity-60 hover:opacity-100"
              >
                <X className="size-3" />
              </span>
            </span>
          ))
        )}
        <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-36 p-0" align="start" sideOffset={4}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜尋或輸入品牌名稱..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 && !showCreate && (
              <CommandEmpty>找不到相符的品牌</CommandEmpty>
            )}
            <CommandGroup>
              {filtered.map((brand) => (
                <CommandItem
                  key={brand.id}
                  value={brand.id}
                  onSelect={() => toggle(brand.id)}
                  data-checked={value.includes(brand.id)}
                >
                  {brand.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreate && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${search}`}
                  onSelect={handleCreate}
                  disabled={createBrand.isPending}
                  className="text-primary"
                >
                  <Plus className="mr-2 size-4" />
                  新增品牌「{search.trim()}」
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
