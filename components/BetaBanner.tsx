export function BetaBanner() {
  return (
    <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white text-center text-xs py-2 px-4">
      <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 bg-white/20 border border-white/30 rounded-full px-2 py-0.5 font-bold tracking-wide text-[10px] uppercase flex-shrink-0">
          Beta
        </span>
        <span>
          Currently supporting{' '}
          <span className="font-bold">AUB</span> and{' '}
          <span className="font-bold">LAU</span> with live schedule data.{' '}
          <span className="text-blue-100">More universities coming soon.</span>
        </span>
      </span>
    </div>
  )
}
