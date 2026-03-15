import type { Metadata } from 'next'
import Link from 'next/link'
import { GraduationCap, Star, Shield, Users, BookOpen } from 'lucide-react'
import { LoginButtons } from '@/components/auth/LoginButtons'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Sign In – EduScore Lebanon',
  description: 'Sign in to write professor reviews and save your class schedules.',
}

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect('/')

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── Left panel: branding + social proof ─────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-white text-xl tracking-tight">EduScore Lebanon</span>
        </Link>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            Make smarter decisions before you register.
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed mb-10">
            Join thousands of Lebanese students who use EduScore to find the best professors, compare courses, and build perfect schedules.
          </p>

          <div className="space-y-4">
            {[
              { icon: Star,     label: 'Professor reviews',      desc: 'Honest, anonymous ratings by real students' },
              { icon: BookOpen, label: 'Course comparison',       desc: 'Side-by-side professor stats per course' },
              { icon: Users,    label: 'Conflict-free schedules', desc: 'Smart builder that finds all valid combos' },
              { icon: Shield,   label: 'Always anonymous',        desc: 'Your identity is never revealed' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{label}</p>
                  <p className="text-blue-200 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-blue-300 text-xs">© 2025 EduScore Lebanon · Made for Lebanese students</p>
      </div>

      {/* ── Right panel: auth form ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-12">

        {/* Mobile logo */}
        <Link href="/" className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/25">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-[15px]">EduScore</span>
            <span className="font-bold text-blue-600 text-[15px]"> Lebanon</span>
          </div>
        </Link>

        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Welcome back
            </h2>
            <p className="text-slate-500 text-sm mt-2">
              Sign in to review professors and save schedules
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-900/5 p-8">
            <LoginButtons />
          </div>

          <p className="text-center text-xs text-slate-400 mt-6 leading-relaxed px-4">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="text-blue-600 hover:underline">Terms</Link>,{' '}
            <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>, and{' '}
            <Link href="/guidelines" className="text-blue-600 hover:underline">Community Guidelines</Link>.
          </p>

          <div className="text-center mt-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
              ← Back to EduScore
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
