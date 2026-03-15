export function BetaBanner() {
  return (
    <div className="bg-slate-900 text-white text-center text-[13px] py-2.5 px-4">
      <span className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
        <span className="inline-flex items-center gap-1.5 bg-blue-600 rounded-full px-2.5 py-0.5 font-bold tracking-wider text-[10px] uppercase flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Beta
        </span>
        <span className="text-slate-200">
          EduScore Beta — Currently supporting{' '}
          <span className="font-semibold text-white">AUB</span> and{' '}
          <span className="font-semibold text-white">LAU</span> with live schedule data.{' '}
          <span className="text-slate-400">More universities coming soon.</span>
        </span>
      </span>
    </div>
  )
}
