'use client'

import { useState } from 'react'
import { Zap, Database, Info, X } from 'lucide-react'
import type { UniversityCapability } from '@/lib/university-capabilities'

interface Props {
  capability: UniversityCapability
  /** Show the full tooltip inline (used on university detail pages) */
  expanded?: boolean
}

export function DataTierBadge({ capability, expanded = false }: Props) {
  const [open, setOpen] = useState(false)
  const isLive = capability.liveDataSupported

  return (
    <div className="relative inline-flex items-center gap-1">
      {/* Badge pill */}
      <span
        className={[
          'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer select-none',
          isLive
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
        ].join(' ')}
        onClick={() => setOpen(v => !v)}
        title="Click for data source details"
      >
        {isLive ? <Zap className="h-3 w-3" /> : <Database className="h-3 w-3" />}
        {capability.dataLabel}
        <Info className="h-2.5 w-2.5 opacity-60" />
      </span>

      {/* Tooltip popover */}
      {(open || expanded) && (
        <div
          className={[
            'z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-sm',
            expanded ? 'mt-3 w-full block' : 'absolute left-0 top-7 w-72',
          ].join(' ')}
        >
          {!expanded && (
            <button
              className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
              onClick={() => setOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <p className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
            {isLive
              ? <><Zap className="h-3.5 w-3.5 text-emerald-600" /> Live Official Data</>
              : <><Database className="h-3.5 w-3.5 text-slate-500" /> Historical Catalog Data</>
            }
          </p>
          <p className="text-slate-600 leading-relaxed mb-3">{capability.sourceDescription}</p>
          <div className="space-y-1.5 text-xs text-slate-500">
            <Row label="Source" value={capability.officialSourceName} />
            <Row label="Professor names" value={isLive ? 'Confirmed from official schedule' : 'Inferred from historical data'} highlight={isLive} />
            <Row label="Seat availability" value={capability.seatDataAvailable ? 'Available' : 'Not available'} />
            <Row label="Schedule builder" value={
              capability.scheduleBuilderMode === 'FULL'
                ? 'Full — real sections with confirmed instructors'
                : 'Limited — based on historical patterns'
            } highlight={capability.scheduleBuilderMode === 'FULL'} />
          </div>
          <p className="mt-3 text-xs text-slate-400 border-t pt-2">
            CONFIRMED = instructor pulled directly from the university&apos;s official schedule for this term.
            INFERRED = assignment estimated from historical data; may not reflect the current term.
          </p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-400 w-36 flex-shrink-0">{label}:</span>
      <span className={highlight ? 'text-emerald-600 font-medium' : ''}>{value}</span>
    </div>
  )
}
