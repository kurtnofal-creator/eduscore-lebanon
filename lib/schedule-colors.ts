/**
 * EduScore Lebanon – Shared course color palette for schedule builder.
 *
 * Centralizes all color assignments so they're consistent across:
 * - Course selector chips (left panel)
 * - Section detail accent bars (right panel)
 * - Calendar time blocks
 * - Registration summary table
 */

export interface CourseColors {
  chip:   string  // light chip: bg + border + text
  accent: string  // solid bg for side accent bar
  block:  string  // calendar block: bg + border + text
  text:   string  // text color on white background
  hex:    string  // hex for canvas/PDF contexts
  name:   string  // human-readable name
}

export const COURSE_PALETTE: CourseColors[] = [
  { name: 'blue',    chip: 'bg-blue-50 border-blue-100 text-blue-800',       accent: 'bg-blue-500',    block: 'bg-blue-100 border-blue-400 text-blue-900',       text: 'text-blue-700',    hex: '#3b82f6' },
  { name: 'violet',  chip: 'bg-violet-50 border-violet-100 text-violet-800', accent: 'bg-violet-500',  block: 'bg-violet-100 border-violet-400 text-violet-900', text: 'text-violet-700',  hex: '#8b5cf6' },
  { name: 'emerald', chip: 'bg-emerald-50 border-emerald-100 text-emerald-800', accent: 'bg-emerald-500', block: 'bg-emerald-100 border-emerald-400 text-emerald-900', text: 'text-emerald-700', hex: '#10b981' },
  { name: 'amber',   chip: 'bg-amber-50 border-amber-100 text-amber-800',     accent: 'bg-amber-500',   block: 'bg-amber-100 border-amber-400 text-amber-900',     text: 'text-amber-700',   hex: '#f59e0b' },
  { name: 'rose',    chip: 'bg-rose-50 border-rose-100 text-rose-800',       accent: 'bg-rose-500',    block: 'bg-rose-100 border-rose-400 text-rose-900',       text: 'text-rose-700',    hex: '#f43f5e' },
  { name: 'cyan',    chip: 'bg-cyan-50 border-cyan-100 text-cyan-800',       accent: 'bg-cyan-500',    block: 'bg-cyan-100 border-cyan-400 text-cyan-900',       text: 'text-cyan-700',    hex: '#06b6d4' },
  { name: 'indigo',  chip: 'bg-indigo-50 border-indigo-100 text-indigo-800', accent: 'bg-indigo-500',  block: 'bg-indigo-100 border-indigo-400 text-indigo-900', text: 'text-indigo-700',  hex: '#6366f1' },
  { name: 'orange',  chip: 'bg-orange-50 border-orange-100 text-orange-800', accent: 'bg-orange-500',  block: 'bg-orange-100 border-orange-400 text-orange-900', text: 'text-orange-700',  hex: '#f97316' },
]

/** Get color palette entry for a given index (wraps automatically for > 8 courses) */
export function getCourseColors(index: number): CourseColors {
  return COURSE_PALETTE[index % COURSE_PALETTE.length]
}

/** Build a courseId → color-index map from an ordered list of course IDs */
export function buildCourseColorMap(courseIds: string[]): Map<string, number> {
  const map = new Map<string, number>()
  courseIds.forEach((id, i) => map.set(id, i))
  return map
}
