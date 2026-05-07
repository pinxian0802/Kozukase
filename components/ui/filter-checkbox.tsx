import { Check } from 'lucide-react'

interface FilterCheckboxProps {
  label: string
  checked: boolean
  color?: string
  onClick: () => void
}

export function FilterCheckbox({ label, checked, color = '#2da6cf', onClick }: FilterCheckboxProps) {
  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer items-center gap-3 py-2 text-left transition-colors ${
        checked ? 'text-[#111]' : 'text-[#333] hover:text-[#111]'
      }`}
      onClick={onClick}
    >
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-lg border transition-colors"
        style={
          checked
            ? { backgroundColor: color, borderColor: color }
            : { backgroundColor: '#fff', borderColor: '#d2d7df' }
        }
      >
        {checked && <Check className="size-3.5 text-white" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
    </button>
  )
}
