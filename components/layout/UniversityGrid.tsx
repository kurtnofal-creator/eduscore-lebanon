import Link from 'next/link'

interface University {
  id: string
  name: string
  shortName: string
  slug: string
  city?: string | null
}

export function UniversityGrid({ universities }: { universities: University[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {universities.map(uni => (
        <Link
          key={uni.id}
          href={`/universities/${uni.slug}`}
          className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-secondary transition-all"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-display font-black text-sm group-hover:bg-primary group-hover:text-white transition-colors">
            {uni.shortName.slice(0, 3)}
          </div>
          <div className="text-center">
            <p className="font-bold text-sm">{uni.shortName}</p>
            {uni.city && <p className="text-xs text-muted-foreground mt-0.5">{uni.city}</p>}
          </div>
        </Link>
      ))}
    </div>
  )
}
