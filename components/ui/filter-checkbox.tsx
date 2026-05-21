import { Check } from 'lucide-react'

interface FilterCheckboxProps {
  label: string
  checked: boolean
  color?: string
  onClick: () => void
}

export function FilterCheckbox({ label, checked, color = 'var(--brand-500)', onClick }: FilterCheckboxProps) {
  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer items-center gap-3 py-2 text-left transition-colors ${
        checked ? 'text-text-strong' : 'text-text-muted hover:text-text-strong'
      }`}
      onClick={onClick}
    >
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-lg border transition-colors"
        style={
          checked
            ? { backgroundColor: color, borderColor: color }
            : { backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-strong)' }
        }
      >
        {checked && <Check className="size-3.5 text-text-inverse" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
    </button>
  )
}
