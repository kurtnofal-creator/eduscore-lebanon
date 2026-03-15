'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  /** Static text to copy, or leave blank to build from scheduleId */
  text?: string
  scheduleId?: string
  className?: string
  children: React.ReactNode
}

export function CopyButton({ text, scheduleId, className, children }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const url = text || (scheduleId ? `${window.location.origin}/schedule/${scheduleId}` : window.location.href)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button type="button" onClick={handleCopy} className={cn(className)}>
      {copied ? (
        <><Check className="h-4 w-4" /> Copied!</>
      ) : (
        children
      )}
    </button>
  )
}
