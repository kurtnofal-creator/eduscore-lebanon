import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { GraduationCap, LayoutDashboard, Star, BookOpen, Users, RefreshCw, BarChart2, Shield, Activity, AlertTriangle } from 'lucide-react'

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/monitoring', label: 'Monitoring', icon: Activity },
  { href: '/admin/reviews', label: 'Review Queue', icon: Star },
  { href: '/admin/professors', label: 'Professors', icon: Users },
  { href: '/admin/courses', label: 'Courses', icon: BookOpen },
  { href: '/admin/sync', label: 'Data Sync', icon: RefreshCw },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/admin/reports', label: 'Reports', icon: AlertTriangle },
  { href: '/admin/users', label: 'Users', icon: Users },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR') {
    redirect('/')
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-white">
            <GraduationCap className="h-6 w-6 text-blue-400" />
            <div>
              <div className="text-sm font-semibold">EduScore</div>
              <div className="text-xs text-slate-400">Admin Panel</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {ADMIN_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm font-medium"
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              {session.user.name?.[0] ?? 'A'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{session.user.name}</div>
              <div className="text-xs text-slate-400 capitalize">{session.user.role.toLowerCase()}</div>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
            Back to Site
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-slate-50 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
