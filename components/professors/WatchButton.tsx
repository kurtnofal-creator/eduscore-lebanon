'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Bell, BellOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WatchButtonProps {
  professorId?: string
  courseId?: string
  initialWatched?: boolean
  className?: string
}

export function WatchButton({ professorId, courseId, initialWatched = false, className }: WatchButtonProps) {
  const { data: session } = useSession()
  const [watched, setWatched] = useState(initialWatched)
  const [loading, setLoading] = useState(false)

  if (!session?.user) return null

  const toggle = async () => {
    setLoading(true)
    try {
      const method = watched ? 'DELETE' : 'POST'
      await fetch('/api/watchlist', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ professorId, courseId }),
      })
      setWatched(v => !v)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={watched ? 'Unwatch' : 'Watch for new reviews'}
      className={cn(
        'p-2 rounded-lg transition-colors',
        watched
          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className
      )}
    >
      {watched ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
    </button>
  )
}
