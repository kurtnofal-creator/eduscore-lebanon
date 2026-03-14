import { cn } from '@/lib/utils'

interface CourseStatsBarProps {
  label: string
  value: number | null | undefined
  maxLabel?: string
  invertColor?: boolean
}

export function CourseStatsBar({ label, value, maxLabel, invertColor = false }: CourseStatsBarProps) {
  if (value == null) return null

  const pct = (value / 5) * 100

  const color = invertColor
    ? value >= 4 ? 'bg-green-500' : value >= 3 ? 'bg-yellow-500' : 'bg-red-500'
    : value >= 4 ? 'bg-red-500' : value >= 3 ? 'bg-yellow-500' : 'bg-green-500'

  return (
    <div className="text-center">
      <div className="text-2xl font-bold">{value.toFixed(1)}</div>
      <div className="text-xs text-muted-foreground mt-0.5 mb-2">{label}</div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      {maxLabel && <div className="text-xs text-muted-foreground mt-1">{maxLabel}</div>}
    </div>
  )
}
