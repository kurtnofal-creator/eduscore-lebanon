import { cn } from '@/lib/utils'

interface RatingBarProps {
  label: string
  value: number | null | undefined
  max?: number
  className?: string
}

function ratingBarColor(value: number): string {
  if (value >= 4) return 'bg-green-500'
  if (value >= 3) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function RatingBar({ label, value, max = 5, className }: RatingBarProps) {
  if (value == null) return null

  const pct = Math.min(100, (value / max) * 100)

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', ratingBarColor(value))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold w-7 text-right tabular-nums">{value.toFixed(1)}</span>
    </div>
  )
}
