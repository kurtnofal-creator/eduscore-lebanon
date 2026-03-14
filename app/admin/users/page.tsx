import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Users, Search, Star, Bell, Calendar, Shield, Ban, ChevronRight } from 'lucide-react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Users – EduScore Admin' }

interface Props {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') {
    redirect('/admin')
  }

  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const role = params.role ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const perPage = 50

  const where = {
    ...(q ? {
      OR: [
        { email: { contains: q } },
        { name: { contains: q } },
      ],
    } : {}),
    ...(role ? { role } : {}),
  }

  const [users, total, roleCounts] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        accounts: { select: { provider: true }, take: 1 },
        _count: {
          select: {
            reviews: true,
            seatAlerts: true,
            savedSchedules: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
    }),
  ])

  const totalPages = Math.ceil(total / perPage)
  const roleMap = Object.fromEntries(roleCounts.map(r => [r.role, r._count.role]))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500 text-sm mt-1">{total.toLocaleString()} registered users</p>
        </div>
        {/* Role breakdown */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'Students', key: 'STUDENT', color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: 'Moderators', key: 'MODERATOR', color: 'bg-violet-50 text-violet-700 border-violet-200' },
            { label: 'Admins', key: 'ADMIN', color: 'bg-amber-50 text-amber-700 border-amber-200' },
          ].map(({ label, key, color }) => (
            <span key={key} className={cn('text-xs font-semibold border px-2.5 py-1 rounded-full', color)}>
              {label}: {(roleMap[key] ?? 0).toLocaleString()}
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
        <form className="flex-1 min-w-60 flex gap-2">
          <input type="hidden" name="role" value={role} />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by email or name…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Search</button>
          {(q || role) && (
            <Link href="/admin/users" className="px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Clear</Link>
          )}
        </form>

        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/users${q ? `?q=${q}` : ''}`}
            className={cn('px-3 py-2 text-sm rounded-lg border font-medium', !role ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
            All
          </Link>
          {['STUDENT', 'MODERATOR', 'ADMIN'].map(r => (
            <Link key={r} href={`/admin/users?role=${r}${q ? `&q=${q}` : ''}`}
              className={cn('px-3 py-2 text-sm rounded-lg border font-medium', role === r ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">User</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Provider</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Role</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Reviews</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Alerts</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Schedules</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden xl:table-cell">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => {
                const provider = user.accounts[0]?.provider ?? 'credentials'
                const providerLabel = provider === 'google' ? 'Google' : provider === 'resend' ? 'Email' : 'Dev'
                const providerColor = provider === 'google' ? 'bg-red-50 text-red-700 border-red-200' : provider === 'resend' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                const roleColor = user.role === 'ADMIN' ? 'bg-amber-100 text-amber-800' : user.role === 'MODERATOR' ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-600'
                const joined = new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                return (
                  <tr key={user.id} className={cn('hover:bg-slate-50 transition-colors', user.isBanned && 'bg-red-50/40')}>
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {user.isBanned && <span title="Banned"><Ban className="h-3 w-3 text-red-500 flex-shrink-0" /></span>}
                          <span className="font-semibold text-slate-900 truncate max-w-[200px]">{user.name || '—'}</span>
                        </div>
                        <span className="text-xs text-slate-400 truncate max-w-[200px] block">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={cn('text-[11px] font-semibold border px-2 py-0.5 rounded-full', providerColor)}>{providerLabel}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', roleColor)}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-slate-600 text-xs">
                        <Star className="h-3 w-3 text-slate-400" />
                        {user._count.reviews}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="flex items-center justify-center gap-1 text-slate-600 text-xs">
                        <Bell className="h-3 w-3 text-slate-400" />
                        {user._count.seatAlerts}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="flex items-center justify-center gap-1 text-slate-600 text-xs">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {user._count.savedSchedules}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell whitespace-nowrap">{joined}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400 font-mono select-all" title="User ID">{user.id.slice(0, 8)}…</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="py-16 text-center">
            <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400">No users found.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total.toLocaleString()}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/users?page=${page - 1}${q ? `&q=${q}` : ''}${role ? `&role=${role}` : ''}`}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/admin/users?page=${page + 1}${q ? `&q=${q}` : ''}${role ? `&role=${role}` : ''}`}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Privacy notice */}
      <div className="mt-6 flex items-start gap-2 text-xs text-slate-400 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Shield className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <span>This page is admin-only and never publicly accessible. Handle all user data in accordance with EduScore&apos;s privacy policy.</span>
      </div>
    </div>
  )
}
