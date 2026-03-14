'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface SearchFiltersProps {
  universities: Array<{ id: string; shortName: string; name: string }>
  currentType: string
  currentUniversityId?: string
  query: string
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Results' },
  { value: 'professors', label: 'Professors' },
  { value: 'courses', label: 'Courses' },
]

export function SearchFilters({ universities, currentType, currentUniversityId, query }: SearchFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.set('page', '1')
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* Type filter */}
      <div>
        <h3 className="font-semibold text-sm mb-3">Search in</h3>
        <div className="space-y-1">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => updateFilter('type', opt.value)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                currentType === opt.value
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* University filter */}
      <div>
        <h3 className="font-semibold text-sm mb-3">University</h3>
        <div className="space-y-1">
          <button
            onClick={() => updateFilter('universityId', '')}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
              !currentUniversityId
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'hover:bg-muted text-muted-foreground'
            )}
          >
            All Universities
          </button>
          {universities.map(uni => (
            <button
              key={uni.id}
              onClick={() => updateFilter('universityId', uni.id)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                currentUniversityId === uni.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {uni.shortName}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
