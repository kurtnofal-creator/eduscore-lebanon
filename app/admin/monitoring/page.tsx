'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Clock, FileWarning } from 'lucide-react'

interface SyncJobInfo {
  status: string
  type: string
  completedAt: string | null
  startedAt: string | null
  createdAt: string
  errorMessage: string | null
  stats: { added?: number; updated?: number; errors?: number } | null
}

interface UniversityRow {
  id: string
  slug: string
  shortName: string
  name: string
  totalSections: number
  currentTermSections: number
  staleSections: number
  professorCount: number
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN'
  lastJob: SyncJobInfo | null
}

interface MonitoringData {
  universities: UniversityRow[]
  openReports: number
  recentErrors: number
}

function HealthBadge({ status }: { status: UniversityRow['healthStatus'] }) {
  if (status === 'HEALTHY')  return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" />Healthy</span>
  if (status === 'DEGRADED') return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><AlertTriangle className="h-3 w-3" />Degraded</span>
  if (status === 'CRITICAL') return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle className="h-3 w-3" />Critical</span>
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full"><HelpCircle className="h-3 w-3" />No data</span>
}

function SyncStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: 'text-green-700 bg-green-50 border-green-200',
    FAILED:    'text-red-700 bg-red-50 border-red-200',
    RUNNING:   'text-blue-700 bg-blue-50 border-blue-200',
    RETRYING:  'text-amber-700 bg-amber-50 border-amber-200',
    PENDING:   'text-slate-600 bg-slate-50 border-slate-200',
  }
  return (
    <span className={`inline-block text-xs font-medium border px-2 py-0.5 rounded-full ${map[status] ?? map.PENDING}`}>
      {status}
    </span>
  )
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/monitoring')
      if (res.ok) {
        setData(await res.json())
        setRefreshedAt(new Date())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const liveUnis = ['aub', 'lau']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Connector Monitoring</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time health status for all university data connectors
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refreshedAt && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Updated {timeAgo(refreshedAt.toISOString())}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Open Data Reports</div>
            <div className={`text-3xl font-bold mt-1 ${data.openReports > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {data.openReports}
            </div>
            <a href="/admin/data-reports" className="text-xs text-blue-600 hover:underline mt-1 block">View all →</a>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Errors (24h)</div>
            <div className={`text-3xl font-bold mt-1 ${data.recentErrors > 5 ? 'text-red-600' : 'text-slate-800'}`}>
              {data.recentErrors}
            </div>
            <div className="text-xs text-slate-400 mt-1">API + schedule errors</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Live Connectors</div>
            <div className="text-3xl font-bold mt-1 text-green-600">
              {data.universities.filter(u => liveUnis.includes(u.slug)).length}
            </div>
            <div className="text-xs text-slate-400 mt-1">AUB + LAU (Banner)</div>
          </div>
        </div>
      )}

      {/* Per-university table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">University Connector Status</h2>
        </div>
        {loading && !data ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">University</th>
                  <th className="px-4 py-3 text-left">Health</th>
                  <th className="px-4 py-3 text-right">Sections (term)</th>
                  <th className="px-4 py-3 text-right">Sections (total)</th>
                  <th className="px-4 py-3 text-right">Stale</th>
                  <th className="px-4 py-3 text-right">Professors</th>
                  <th className="px-4 py-3 text-left">Last Sync</th>
                  <th className="px-4 py-3 text-left">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.universities.map(uni => (
                  <tr key={uni.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{uni.shortName}</div>
                      <div className="text-xs text-slate-400">{uni.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <HealthBadge status={uni.healthStatus} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {uni.currentTermSections.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      {uni.totalSections.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={uni.staleSections > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                        {uni.staleSections}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {uni.professorCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {uni.lastJob
                        ? timeAgo(uni.lastJob.completedAt ?? uni.lastJob.startedAt ?? uni.lastJob.createdAt)
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {uni.lastJob ? (
                        <div className="space-y-1">
                          <SyncStatusBadge status={uni.lastJob.status} />
                          {uni.lastJob.errorMessage && (
                            <div className="text-xs text-red-600 max-w-xs truncate" title={uni.lastJob.errorMessage}>
                              {uni.lastJob.errorMessage}
                            </div>
                          )}
                          {uni.lastJob.stats && (
                            <div className="text-xs text-slate-400">
                              +{uni.lastJob.stats.added ?? 0} / ~{uni.lastJob.stats.updated ?? 0}
                              {(uni.lastJob.stats.errors ?? 0) > 0 && (
                                <span className="text-red-500 ml-1">{uni.lastJob.stats.errors} err</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Never synced</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Data Reports summary */}
      {data && data.openReports > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <FileWarning className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-amber-800">
              {data.openReports} open data report{data.openReports !== 1 ? 's' : ''} from users
            </div>
            <div className="text-xs text-amber-600 mt-0.5">
              Users have flagged incorrect course, section, or professor data. Review and resolve in the Data Reports page.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
