'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { Loader2, Mail, CheckCircle, Lock, ChevronDown } from 'lucide-react'

const DEV_ACCOUNTS = [
  { label: 'Admin', email: 'admin@eduscore.lb', role: 'ADMIN' },
  { label: 'Student 1', email: 'reviewer1@eduscore.lb', role: 'STUDENT' },
  { label: 'Student 2', email: 'reviewer2@eduscore.lb', role: 'STUDENT' },
  { label: 'Student 3', email: 'reviewer3@eduscore.lb', role: 'STUDENT' },
]

export function LoginButtons() {
  const [credEmail, setCredEmail] = useState('')
  const [credPassword, setCredPassword] = useState('')
  const [credLoading, setCredLoading] = useState(false)
  const [credError, setCredError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [quickLoading, setQuickLoading] = useState<string | null>(null)

  const handleQuickLogin = async (account: typeof DEV_ACCOUNTS[0]) => {
    setQuickLoading(account.email)
    setCredError('')
    try {
      const res = await signIn('credentials', {
        email: account.email,
        password: 'test123',
        callbackUrl: '/',
        redirect: false,
      })
      if (res?.error) {
        setCredError('Login failed. Make sure the dev server seeded test accounts.')
      } else {
        window.location.href = res?.url ?? '/'
      }
    } catch {
      setCredError('Login error. Try again.')
    } finally {
      setQuickLoading(null)
    }
  }

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credEmail.trim() || !credPassword.trim()) return
    setCredLoading(true)
    setCredError('')
    try {
      const res = await signIn('credentials', {
        email: credEmail,
        password: credPassword,
        callbackUrl: '/',
        redirect: false,
      })
      if (res?.error) {
        setCredError('Invalid email or password.')
      } else {
        window.location.href = res?.url ?? '/'
      }
    } catch {
      setCredError('Login error. Try again.')
    } finally {
      setCredLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    await signIn('google', { callbackUrl: '/' })
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setEmailLoading(true)
    try {
      await signIn('resend', { email, callbackUrl: '/', redirect: false })
      setEmailSent(true)
    } finally {
      setEmailLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="font-bold text-slate-900 text-lg mb-2">Check your inbox</h3>
        <p className="text-slate-500 text-sm leading-relaxed">
          We sent a sign-in link to <strong className="text-slate-700">{email}</strong>.
          Click the link to sign in instantly — no password needed.
        </p>
        <button
          onClick={() => { setEmailSent(false); setEmail('') }}
          className="mt-6 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Dev Quick Login ─────────────────────────────────────── */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-semibold text-amber-800 mb-3 uppercase tracking-wide">
          Dev Testing — Quick Login
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DEV_ACCOUNTS.map(account => (
            <button
              key={account.email}
              onClick={() => handleQuickLogin(account)}
              disabled={quickLoading === account.email}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-60"
            >
              {quickLoading === account.email ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className={`w-2 h-2 rounded-full ${account.role === 'ADMIN' ? 'bg-red-400' : 'bg-green-400'}`} />
              )}
              {account.label}
            </button>
          ))}
        </div>
        {credError && (
          <p className="text-xs text-red-600 mt-2 font-medium">{credError}</p>
        )}
        <p className="text-[10px] text-amber-600 mt-2">Password for all accounts: <code className="font-mono font-bold">test123</code></p>
      </div>

      {/* ── Divider ─────────────────────────────────────────────── */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs text-slate-400 uppercase tracking-widest font-medium">
            or sign in with
          </span>
        </div>
      </div>

      {/* ── Google ──────────────────────────────────────────────── */}
      <button
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {googleLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : (
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        Continue with Google
      </button>

      {/* ── Advanced: email/password + magic link ────────────────── */}
      <button
        onClick={() => setShowAdvanced(v => !v)}
        className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors py-1"
      >
        More sign-in options
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
      </button>

      {showAdvanced && (
        <div className="space-y-4 pt-1">
          {/* Credentials */}
          <form onSubmit={handleCredentials} className="space-y-2.5">
            <input
              type="email"
              value={credEmail}
              onChange={e => setCredEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
            <input
              type="password"
              value={credPassword}
              onChange={e => setCredPassword(e.target.value)}
              placeholder="Password (test123 for dev accounts)"
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
            <button
              type="submit"
              disabled={credLoading || !credEmail.trim() || !credPassword.trim()}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-slate-900 transition-all disabled:opacity-60"
            >
              {credLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              ) : (
                <><Lock className="h-4 w-4" /> Sign In with Password</>
              )}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-slate-400 uppercase tracking-widest font-medium">or magic link</span>
            </div>
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@university.edu"
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
            <button
              type="submit"
              disabled={emailLoading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-3.5 text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-60"
            >
              {emailLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending link…</>
              ) : (
                <><Mail className="h-4 w-4" /> Send Magic Link</>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
