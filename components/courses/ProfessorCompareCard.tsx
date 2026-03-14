import Link from 'next/link'
import { RatingBar } from '@/components/professors/RatingBar'
import { formatRating, ratingToColor, cn } from '@/lib/utils'
import { CheckCircle } from 'lucide-react'

interface ProfessorCompareCardProps {
  professor: {
    id: string
    fullName: string
    slug: string
    title?: string | null
    overallRating?: number | null
    teachingClarity?: number | null
    workloadLevel?: number | null
    gradingFairness?: number | null
    examDifficulty?: number | null
    recommendRate?: number | null
    reviewCount: number
  }
}

export function ProfessorCompareCard({ professor }: ProfessorCompareCardProps) {
  return (
    <Link
      href={`/professors/${professor.slug}`}
      className="group block bg-card border rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
          {professor.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold group-hover:text-blue-700 transition-colors">
                {professor.title && <span className="text-muted-foreground font-normal">{professor.title} </span>}
                {professor.fullName}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {professor.reviewCount} reviews
                {professor.recommendRate != null && (
                  <span className="ml-2 text-green-600 font-medium">
                    <CheckCircle className="h-3 w-3 inline mr-0.5" />
                    {Math.round(professor.recommendRate)}%
                  </span>
                )}
              </p>
            </div>
            {professor.overallRating != null && (
              <div className={cn('text-3xl font-bold flex-shrink-0', ratingToColor(professor.overallRating))}>
                {formatRating(professor.overallRating)}
              </div>
            )}
          </div>

          <div className="mt-3 space-y-1.5">
            <RatingBar label="Teaching Clarity" value={professor.teachingClarity} />
            <RatingBar label="Grading Fairness" value={professor.gradingFairness} />
            <RatingBar label="Workload" value={professor.workloadLevel} />
            <RatingBar label="Exam Difficulty" value={professor.examDifficulty} />
          </div>
        </div>
      </div>
    </Link>
  )
}
