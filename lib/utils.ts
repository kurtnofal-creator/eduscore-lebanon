import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatRating(rating: number | null | undefined, decimals = 1): string {
  if (rating == null) return 'N/A'
  return rating.toFixed(decimals)
}

export function ratingToColor(rating: number | null | undefined): string {
  if (rating == null) return 'text-muted-foreground'
  if (rating >= 4) return 'text-green-600'
  if (rating >= 3) return 'text-yellow-600'
  return 'text-red-600'
}

export function workloadLabel(level: number | null | undefined): string {
  if (level == null) return 'Unknown'
  if (level <= 1.5) return 'Very Light'
  if (level <= 2.5) return 'Light'
  if (level <= 3.5) return 'Moderate'
  if (level <= 4.5) return 'Heavy'
  return 'Very Heavy'
}

export function workloadColor(level: number | null | undefined): string {
  if (level == null) return 'bg-muted'
  if (level <= 2) return 'bg-green-500'
  if (level <= 3) return 'bg-yellow-500'
  if (level <= 4) return 'bg-orange-500'
  return 'bg-red-500'
}

export function difficultyLabel(level: number | null | undefined): string {
  if (level == null) return 'Unknown'
  if (level <= 1.5) return 'Very Easy'
  if (level <= 2.5) return 'Easy'
  if (level <= 3.5) return 'Medium'
  if (level <= 4.5) return 'Hard'
  return 'Very Hard'
}

export function gradePoints(grade: string | null | undefined): number | null {
  const map: Record<string, number> = {
    'A+': 4.3, A: 4.0, 'A-': 3.7,
    'B+': 3.3, B: 3.0, 'B-': 2.7,
    'C+': 2.3, C: 2.0, 'C-': 1.7,
    'D+': 1.3, D: 1.0, F: 0.0,
  }
  return grade ? (map[grade] ?? null) : null
}

export function timeAgo(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diff = now.getTime() - then.getTime()
  const secs = Math.floor(diff / 1000)
  const mins = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (secs < 60) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 4) return `${weeks}w ago`
  if (months < 12) return `${months}mo ago`
  return then.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).replace(/\s+\S*$/, '') + '…'
}

export function generateProfessorSlug(firstName: string, lastName: string, universitySlug: string): string {
  return `${slugify(firstName)}-${slugify(lastName)}-${universitySlug}`
}

// Rate limiting check helper (uses simple in-memory for dev; use Redis in prod)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) return false

  entry.count++
  return true
}

export function paginate(total: number, page: number, perPage: number) {
  const totalPages = Math.ceil(total / perPage)
  return {
    total,
    page,
    perPage,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}
