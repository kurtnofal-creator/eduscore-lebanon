'use client'

import { useState } from 'react'
import { MessageSquare, X, Send, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FeedbackButton() {
  const [open, setOpen]       = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail]     = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const submit = async () => {
    if (message.trim().length < 5) {
      setError('Please write at least a few words.')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          email:   email.trim() || undefined,
          page:    typeof window !== 'undefined' ? window.location.pathname : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSent(true)
      setTimeout(() => {
        setOpen(false)
        setSent(false)
        setMessage('')
        setEmail('')
      }, 2200)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-5 right-5 z-50 flex items-center gap-1.5',
          'bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium',
          'px-3 py-1.5 rounded-full shadow-md transition-all',
          open && 'opacity-0 pointer-events-none',
        )}
        aria-label="Send feedback"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Feedback
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-sm text-slate-800">Send Feedback</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-400"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {sent ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="font-medium text-slate-800">Thank you!</p>
                  <p className="text-sm text-slate-500">Your feedback helps us improve EduScore.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1.5">
                      Your feedback <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="What's working well? What could be better?"
                      rows={4}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={2000}
                    />
                    <p className="text-xs text-slate-400 text-right mt-0.5">{message.length}/2000</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1.5">
                      Email <span className="text-slate-400 font-normal">(optional — for follow-up)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <button
                    onClick={submit}
                    disabled={sending || message.trim().length < 5}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                  >
                    {sending
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      : <><Send className="h-4 w-4" /> Send Feedback</>
                    }
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
