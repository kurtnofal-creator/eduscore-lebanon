'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { SearchBar } from '@/components/search/SearchBar'
import { GraduationCap, Menu, X, ChevronDown, LogOut, LayoutDashboard, BookMarked, Shield } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/professors',       label: 'Professors' },
  { href: '/courses',          label: 'Courses' },
  { href: '/universities',     label: 'Universities' },
  { href: '/schedule-builder', label: 'Schedule Builder' },
]

export function Header() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const isHome = pathname === '/'

  return (
    <header className={cn(
      'sticky top-0 z-50 transition-all duration-200',
      'bg-white/95 backdrop-blur-md',
      'border-b border-slate-200/80',
      'shadow-[0_1px_0_0_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.04)]',
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-[62px] gap-3">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
                boxShadow: '0 2px 8px rgba(37,99,235,0.32)',
              }}>
              <GraduationCap style={{ width: 17, height: 17, color: '#fff' }} />
            </div>
            <div className="hidden sm:flex items-baseline gap-0.5">
              <span className="font-bold text-slate-900 text-[15px] tracking-tight leading-none"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>EduScore</span>
              <span className="text-blue-600 font-bold text-[15px] tracking-tight leading-none"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}> Lebanon</span>
            </div>
          </Link>

          {/* Search (hidden on homepage — hero has it) */}
          {!isHome && (
            <div className="flex-1 max-w-md hidden md:block mx-4">
              <SearchBar placeholder="Search professors, courses…" />
            </div>
          )}

          {/* Nav */}
          <nav className={cn(
            'hidden lg:flex items-center gap-0.5',
            isHome ? 'flex-1 justify-center' : 'ml-auto mr-3'
          )}>
            {NAV_LINKS.map(link => {
              const active = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'relative px-3.5 py-2 rounded-lg text-[13.5px] font-medium transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  {link.label}
                  {active && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Auth */}
          <div className={cn(
            'flex items-center gap-2',
            isHome && 'ml-auto',
          )}>
            {session?.user ? (
              <div className="relative">
                {/* Backdrop overlay */}
                {userMenuOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                )}

                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}>
                    {session.user.name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <span className="hidden sm:block text-slate-700 text-sm">{session.user.name?.split(' ')[0]}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', userMenuOpen && 'rotate-180')} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 py-2 z-50">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-900 truncate">{session.user.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{session.user.email}</p>
                    </div>
                    <div className="py-1">
                      {[
                        { href: '/dashboard', icon: LayoutDashboard, label: 'My Reviews' },
                        { href: '/saved-schedules', icon: BookMarked, label: 'Saved Schedules' },
                      ].map(item => (
                        <Link key={item.href} href={item.href} onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                          <item.icon className="h-4 w-4 text-slate-400" />
                          {item.label}
                        </Link>
                      ))}
                      {(session.user.role === 'ADMIN' || session.user.role === 'MODERATOR') && (
                        <Link href="/admin" onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors">
                          <Shield className="h-4 w-4" /> Admin Panel
                        </Link>
                      )}
                    </div>
                    <div className="border-t border-slate-100 pt-1">
                      <button onClick={() => { signOut(); setUserMenuOpen(false) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                        <LogOut className="h-4 w-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login"
                  className="hidden sm:block px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  Log In
                </Link>
                <Link href="/login"
                  className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all"
                  style={{
                    background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.32)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(37,99,235,0.42)'
                    ;(e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 8px rgba(37,99,235,0.32)'
                    ;(e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'
                  }}
                >
                  Sign Up Free
                </Link>
              </div>
            )}

            <button onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors ml-1"
              aria-label="Toggle menu">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-100 py-3 space-y-0.5 pb-4">
            {!isHome && <div className="pb-3"><SearchBar placeholder="Search professors, courses…" /></div>}
            {NAV_LINKS.map(link => {
              const active = pathname.startsWith(link.href)
              return (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}>
                  {link.label}
                </Link>
              )
            })}
            {!session && (
              <div className="pt-3 flex gap-2">
                <Link href="/login" className="flex-1 text-center py-2.5 text-sm font-semibold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">Log In</Link>
                <Link href="/login" className="flex-1 text-center py-2.5 text-sm font-semibold text-white rounded-xl"
                  style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}>
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
