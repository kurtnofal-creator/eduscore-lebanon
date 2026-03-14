import Link from 'next/link'
import { BookOpen, Users } from 'lucide-react'
import { difficultyLabel, workloadLabel, workloadColor, cn } from '@/lib/utils'

interface CourseCardProps {
  course: {
    id: string
    code: string
    name: string
    slug: string
    credits?: number | null
    avgWorkload?: number | null
    avgDifficulty?: number | null
    reviewCount: number
    department?: {
      name: string
      code?: string | null
      faculty?: {
        university?: { shortName: string; slug: string } | null
      } | null
    } | null
  }
}

export function CourseCard({ course }: CourseCardProps) {
  const uni = course.department?.faculty?.university

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group block bg-card border rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">
              {course.code}
            </span>
            {course.credits && (
              <span className="text-xs text-muted-foreground">{course.credits} cr</span>
            )}
          </div>
          <h3 className="font-medium group-hover:text-blue-700 transition-colors truncate">
            {course.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {course.department?.name}
            {uni && ` · ${uni.shortName}`}
          </p>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
            <Users className="h-3 w-3" />
            {course.reviewCount}
          </div>
        </div>
      </div>

      {(course.avgWorkload != null || course.avgDifficulty != null) && (
        <div className="mt-3 flex gap-4 text-xs">
          {course.avgWorkload != null && (
            <div className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', workloadColor(course.avgWorkload))} />
              <span className="text-muted-foreground">{workloadLabel(course.avgWorkload)}</span>
            </div>
          )}
          {course.avgDifficulty != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Difficulty: {difficultyLabel(course.avgDifficulty)}</span>
            </div>
          )}
        </div>
      )}
    </Link>
  )
}
