'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface AdBannerProps {
  slot: string
  className?: string
  vertical?: boolean
}

declare global {
  interface Window {
    adsbygoogle: unknown[]
  }
}

export function AdBanner({ slot, className, vertical = false }: AdBannerProps) {
  const adRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID) return
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
    } catch {}
  }, [])

  if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID) {
    // Show placeholder in development
    if (process.env.NODE_ENV !== 'development') return null
    return (
      <div
        className={cn(
          'bg-gradient-to-r from-slate-50 to-slate-100/80 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1.5',
          vertical ? 'w-full min-h-[250px]' : 'w-full min-h-[90px]',
          className
        )}
      >
        <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">Advertisement</span>
      </div>
    )
  }

  return (
    <div ref={adRef} className={cn('w-full overflow-hidden', className)}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format={vertical ? 'vertical' : 'horizontal'}
        data-full-width-responsive="true"
      />
    </div>
  )
}
