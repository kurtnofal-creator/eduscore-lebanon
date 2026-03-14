'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Play, AlertCircle, Loader2, AlertTriangle, CheckCircle2,
  BarChart3, Activity, Bell, Flag, MessageSquare, Shield, Zap, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SyncJob {
  id: string
  type: string
  status: string
  startedAt?: string | null
  completedAt?: string | null
  errorMessage?: string | null
  retryCount: number
  stats?: { added: number; updated: number; skipped: number; errors: number } | null
  createdAt: string
  university: { shortName: string; name: string }
}

interface University {
  id: string
  shortName: string
  name: string
}

interface QualityStat {
  universityId: string
  shortName: string
  total: number
  stale: number
  complete: number
  partial: number
  minimal: number
  open: number
  closed: number
  unknown: number
  avgCompleteness: number
}

interface HealthStats {
  sections: { total: number; stale: number; stalePercent: number; open: number }
  reviews: { pending: number }
  dataReports: { open: number }
  seatAlerts: { active: number; notified24h: number }
  connector: {
    degraded: boolean
    criticals7d: number
    warnings7d: number
    byUniversity: Record<string, {
      healthScore: number
      passed: boolean
      totalSections: number
      staleSections: number
      crnCoverageRate: number
      checkedAt: string
    }>
  }
  feedback: { last7d: number }
  recentSyncJobs: Array<{ id: string; university: string; type: string; status: string; createdAt: string; errorMessage: string | null }>
}

export default function AdminSyncPage() {
  const [jobs, setJobs]                 = useState<SyncJob[]>([])
  const [universities, setUniversities] = useState<University[]>([])
  const [quality, setQuality]           = useState<QualityStat[]>([])
  const [health, setHealth]             = useState<HealthStats | null>(null)
  const [selectedUniversity, setSelectedUniversity] = useState('')
  const [syncType, setSyncType]         = useState('MANUAL')
  const [loading, setLoading]           = useState(true)
  const [triggering, setTriggering]     = useState(false)
  const [message, setMessage]           = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, uniRes, qualityRes, healthRes] = await Promise.all([
        fetch('/api/admin/sync'),
        fetch('/api/universities'),
        fetch('/api/admin/section-quality'),
        fetch('/api/admin/health'),
      ])
      if (jobsRes.ok)    { const d = await jobsRes.json();    setJobs(d.jobs) }
      if (uniRes.ok)     { const d = await uniRes.json();     setUniversities(d.universities ?? []); if (d.universities?.[0]) setSelectedUniversity(d.universities[0].id) }
      if (qualityRes.ok) { const d = await qualityRes.json(); setQuality(d.stats ?? []) }
      if (healthRes.ok)  { const d = await healthRes.json();  setHealth(d) }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const triggerSync = async () => {
    if (!selectedUniversity) return
    setTriggering(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId: selectedUniversity, type: syncType }),
      })
      const data = await res.json()
      setMessage(res.ok ? data.message : (data.error ?? 'Failed'))
      if (res.ok) setTimeout(fetchData, 3000)
    } finally {
      setTriggering(false)
    }
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-700',
      FAILED:    'bg-red-100 text-red-700',
      RUNNING:   'bg-blue-100 text-blue-700',
      RETRYING:  'bg-yellow-100 text-yellow-700',
      PENDING:   'bg-slate-100 text-slate-500',
    }
    return (
      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', map[status] ?? 'bg-slate-100 text-slate-500')}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Data Sync &amp; Monitoring</h1>

      {/* ── Beta Health Overview ────────────────────────────────────── */}
      {health && (
        <>
          {/* Degraded connector alert */}
          {health.connector.degraded && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Connector degraded</p>
                <p className="text-red-600 mt-0.5">
                  One or more university connectors failed their health check in the last 7 days.
                  {health.connector.criticals7d > 0 && ` ${health.connector.criticals7d} critical event${health.connector.criticals7d > 1 ? 's' : ''} recorded.`}
                  {' '}Run a manual sync or check sync logs below.
                </p>
              </div>
            </div>
          )}

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: 'Total Sections',
                value: health.sections.total.toLocaleString(),
                sub: `${health.sections.open.toLocaleString()} open`,
                icon: BarChart3,
                color: 'text-blue-600 bg-blue-50',
              },
              {
                label: 'Stale Sections',
                value: health.sections.stale.toLocaleString(),
                sub: `${health.sections.stalePercent}% of total`,
                icon: AlertTriangle,
                color: health.sections.stalePercent > 15 ? 'text-red-600 bg-red-50' : health.sections.stalePercent > 5 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50',
              },
              {
                label: 'Pending Reviews',
                value: health.reviews.pending.toLocaleString(),
                sub: 'awaiting moderation',
                icon: Shield,
                color: health.reviews.pending > 0 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50',
              },
              {
                label: 'Open Reports',
                value: health.dataReports.open.toLocaleString(),
                sub: 'data issues filed',
                icon: Flag,
                color: health.dataReports.open > 5 ? 'text-amber-600 bg-amber-50' : 'text-slate-600 bg-slate-50',
              },
              {
                label: 'Seat Alerts',
                value: health.seatAlerts.active.toLocaleString(),
                sub: `${health.seatAlerts.notified24h} fired (24h)`,
                icon: Bell,
                color: 'text-violet-600 bg-violet-50',
              },
              {
                label: 'Feedback (7d)',
                value: health.feedback.last7d.toLocaleString(),
                sub: 'beta submissions',
                icon: MessageSquare,
                color: 'text-indigo-600 bg-indigo-50',
              },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl border shadow-sm p-4">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', stat.color)}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                <p className="text-[11px] text-slate-400">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Connector health per university */}
          {Object.keys(health.connector.byUniversity).length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm">
              <div className="p-5 border-b flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <h2 className="font-semibold">Connector Health (last automated check)</h2>
              </div>
              <div className="divide-y">
                {Object.entries(health.connector.byUniversity).map(([uni, data]) => (
                  <div key={uni} className="px-5 py-4 flex items-center gap-4">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', data.passed ? 'bg-green-500' : 'bg-red-500')} />
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                      <div>
                        <p className="font-semibold uppercase text-xs text-slate-500">{uni}</p>
                        <p className={cn('font-medium', data.passed ? 'text-green-700' : 'text-red-700')}>
                          {data.passed ? 'Healthy' : 'Degraded'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Health score</p>
                        <p className={cn('font-semibold', data.healthScore >= 80 ? 'text-green-600' : data.healthScore >= 50 ? 'text-amber-600' : 'text-red-600')}>
                          {data.healthScore}/100
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Sections</p>
                        <p className="font-medium">{data.totalSections.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">CRN coverage</p>
                        <p className={cn('font-medium', data.crnCoverageRate >= 0.9 ? 'text-green-600' : data.crnCoverageRate >= 0.5 ? 'text-amber-600' : 'text-red-600')}>
                          {(data.crnCoverageRate * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Last checked</p>
                        <p className="text-slate-600 text-xs">{new Date(data.checkedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    {data.passed
                      ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      : <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Data Quality Overview ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" /> Section Data Quality
          </h2>
          <button onClick={fetchData} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : quality.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">No section data yet. Run a sync first.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500">
                  <th className="text-left px-4 py-2.5 font-medium">University</th>
                  <th className="text-right px-4 py-2.5 font-medium">Sections</th>
                  <th className="text-right px-4 py-2.5 font-medium">Avg. Completeness</th>
                  <th className="text-right px-4 py-2.5 font-medium">Complete</th>
                  <th className="text-right px-4 py-2.5 font-medium">Partial</th>
                  <th className="text-right px-4 py-2.5 font-medium">Minimal</th>
                  <th className="text-right px-4 py-2.5 font-medium">Open</th>
                  <th className="text-right px-4 py-2.5 font-medium">Stale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quality.map(q => (
                  <tr key={q.universityId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{q.shortName}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{q.total}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', q.avgCompleteness >= 85 ? 'bg-green-500' : q.avgCompleteness >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                            style={{ width: `${q.avgCompleteness}%` }}
                          />
                        </div>
                        <span className={cn('text-xs font-semibold',
                          q.avgCompleteness >= 85 ? 'text-green-600' :
                          q.avgCompleteness >= 50 ? 'text-amber-600' : 'text-red-600'
                        )}>
                          {q.avgCompleteness}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{q.complete}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{q.partial}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{q.minimal}</td>
                    <td className="px-4 py-3 text-right">
                      {q.open > 0
                        ? <span className="flex items-center justify-end gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" />{q.open}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      {q.stale > 0
                        ? <span className="flex items-center justify-end gap-1 text-amber-600 font-medium"><AlertTriangle className="h-3 w-3" />{q.stale}</span>
                        : <span className="text-slate-300">0</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Trigger sync ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-500" /> Trigger Manual Sync
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-slate-500 block mb-1.5">University</label>
            <select
              value={selectedUniversity}
              onChange={e => setSelectedUniversity(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              {universities.map(u => (
                <option key={u.id} value={u.id}>{u.shortName} – {u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1.5">Sync Type</label>
            <select
              value={syncType}
              onChange={e => setSyncType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="MANUAL">Manual (full resync)</option>
              <option value="INCREMENTAL">Incremental</option>
              <option value="FULL">Full Resync</option>
            </select>
          </div>
        </div>
        <button
          onClick={triggerSync}
          disabled={triggering || !selectedUniversity}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {triggering ? 'Starting sync...' : 'Start Sync'}
        </button>
        {message && (
          <p className={cn('mt-3 text-sm', message.toLowerCase().includes('fail') || message.toLowerCase().includes('error') ? 'text-red-600' : 'text-green-600')}>
            {message}
          </p>
        )}
      </div>

      {/* ── Sync job history ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold">Sync Job History</h2>
          <button onClick={fetchData} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-slate-400 text-sm p-6 text-center">No sync jobs yet.</p>
        ) : (
          <div className="divide-y">
            {jobs.map(job => (
              <div key={job.id} className="p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium text-sm">{job.university.shortName}</span>
                    <span className="text-xs text-slate-400">{job.type}</span>
                  </div>
                  <StatusBadge status={job.status} />
                  <span className="text-xs text-slate-400">
                    {new Date(job.createdAt).toLocaleString()}
                  </span>
                </div>

                {job.stats && (
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-600">+{job.stats.added} added</span>
                    <span className="text-blue-600">~{job.stats.updated} updated</span>
                    <span className="text-slate-400">{job.stats.skipped} skipped</span>
                    {job.stats.errors > 0 && <span className="text-red-600">{job.stats.errors} errors</span>}
                  </div>
                )}

                {job.errorMessage && (
                  <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded p-2">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{job.errorMessage}</span>
                  </div>
                )}

                {job.retryCount > 0 && (
                  <p className="text-xs text-slate-400">Retried {job.retryCount} time{job.retryCount > 1 ? 's' : ''}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
