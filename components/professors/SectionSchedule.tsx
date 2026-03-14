import { formatTime, DAY_LABELS } from '@/lib/schedule-engine'
import { MapPin, Clock } from 'lucide-react'

interface Meeting {
  day: string
  startTime: string
  endTime: string
  type: string
  location?: string | null
}

interface SectionWithCourse {
  id: string
  sectionNumber: string
  location?: string | null
  course: { code: string; name: string }
  meetings: Meeting[]
  term: { name: string }
}

export function SectionSchedule({ sections }: { sections: SectionWithCourse[] }) {
  if (sections.length === 0) return null

  return (
    <div className="bg-card border rounded-xl p-5">
      <h3 className="font-semibold mb-4">Current Term Sections ({sections[0]?.term.name})</h3>
      <div className="space-y-3">
        {sections.map(section => (
          <div key={section.id} className="border rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{section.course.code} – {section.course.name}</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">§{section.sectionNumber}</span>
            </div>
            <div className="space-y-1 text-muted-foreground">
              {section.meetings.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium text-foreground">{DAY_LABELS[m.day] ?? m.day}</span>
                    {' '}{formatTime(m.startTime)}–{formatTime(m.endTime)}
                  </span>
                  {m.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {m.location}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
