'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Loader2, X, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  professors: Array<{
    id: string; fullName: string; slug: string; overallRating: number | null
    department: { name: string; faculty: { university: { shortName: string } } } | null
  }>
  courses: Array<{
    id: string; code: string; name: string; slug: string; reviewCount: number
    department: { faculty: { university: { shortName: string } } } | null
  }>
  universities: Array<{ id: string; name: string; shortName: string; slug: string }>
}

interface SearchBarProps {
  placeholder?: string
  large?: boolean
  defaultValue?: string
  className?: string
  light?: boolean
}

function RatingDot({ r }: { r: number }) {
  const color = r >= 4 ? 'bg-green-500' : r >= 3 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <span className={cn('inline-flex items-center justify-center rounded-md text-white text-xs font-bold px-1.5 py-0.5', color)}>
      {r.toFixed(1)}
    </span>
  )
}

export function SearchBar({ placeholder = 'Search…', large = false, defaultValue = '', className, light = false }: SearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultValue)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debounceRef = useRef<any>(undefined)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`)
      if (res.ok) { setResults(await res.json()); setOpen(true) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => search(query.trim()), 280)
    } else {
      setResults(null); setOpen(false)
    }
    return () => clearTimeout(debounceRef.current)
  }, [query, search])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) { setOpen(false); router.push(`/search?q=${encodeURIComponent(query.trim())}`) }
  }

  const totalResults = results
    ? results.professors.length + results.courses.length + results.universities.length
    : 0

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form onSubmit={handleSubmit}>
        <div className={cn(
          large ? 'search-field-hero' : 'search-field',
          'flex items-center gap-3 px-4'
        )}>
          <Search className={cn('flex-shrink-0 text-slate-400', large ? 'h-5 w-5' : 'h-4 w-4')} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setOpen(true)}
            placeholder={placeholder}
            className={cn(
              'flex-1 bg-transparent outline-none text-slate-900 placeholder:text-slate-400',
              large ? 'text-base' : 'text-sm'
            )}
            autoComplete="off"
          />
          {loading && <Loader2 className="h-4 w-4 text-slate-400 animate-spin flex-shrink-0" />}
          {query && !loading && (
            <button type="button" onClick={() => { setQuery(''); setResults(null); setOpen(false) }}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0">
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </form>

      {/* ── Dropdown ──────────────────────────────────────────────── */}
      {open && results && totalResults > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 z-50 overflow-hidden">

          {results.professors.length > 0 && (
            <div className="py-1.5">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Professors</p>
              {results.professors.map(p => (
                <Link key={p.id} href={`/professors/${p.slug}`} onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                    {p.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{p.fullName}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {p.department?.name} · {p.department?.faculty?.university?.shortName}
                    </p>
                  </div>
                  {p.overallRating != null && <RatingDot r={p.overallRating} />}
                </Link>
              ))}
            </div>
          )}

          {results.courses.length > 0 && (
            <div className={cn('py-1.5', results.professors.length > 0 && 'border-t border-slate-100')}>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Courses</p>
              {results.courses.map(c => (
                <Link key={c.id} href={`/courses/${c.slug}`} onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-green-600 flex-shrink-0">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      <span className="text-blue-600 font-mono text-xs mr-1.5">{c.code}</span>{c.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {c.department?.faculty?.university?.shortName} · {c.reviewCount} reviews
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {results.universities.length > 0 && (
            <div className="py-1.5 border-t border-slate-100">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Universities</p>
              {results.universities.map(u => (
                <Link key={u.id} href={`/universities/${u.slug}`} onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 text-xs font-bold flex-shrink-0">
                    {u.shortName.slice(0, 3)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.shortName}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50">
            <button onClick={() => { setOpen(false); router.push(`/search?q=${encodeURIComponent(query)}`) }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
              See all results for &quot;{query}&quot; →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
