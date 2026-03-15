import Link from 'next/link'
import { GraduationCap, Instagram, Linkedin, Twitter } from 'lucide-react'

const COL1 = [
  { href: '/about',      label: 'About' },
  { href: '/privacy',    label: 'Privacy Policy' },
  { href: '/terms',      label: 'Terms of Service' },
]

const COL2 = [
  { href: '/guidelines', label: 'Review Guidelines' },
  { href: '/contact',    label: 'Contact' },
  { href: '/admin',      label: 'Admin' },
]

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start">

          {/* Left: Brand */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/30 transition-transform group-hover:scale-105">
                <GraduationCap style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <span className="font-bold text-white text-[15px] tracking-tight">EduScore Lebanon</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-[220px] mb-6">
              Built for Lebanese university students 🇱🇧
            </p>
            {/* Social */}
            <div className="flex items-center gap-3">
              <a href="#" aria-label="Instagram"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white flex items-center justify-center transition-all duration-200 hover:scale-105">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" aria-label="LinkedIn"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white flex items-center justify-center transition-all duration-200 hover:scale-105">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="#" aria-label="Twitter / X"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white flex items-center justify-center transition-all duration-200 hover:scale-105">
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Middle: Links in two columns */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">Platform</p>
              <ul className="space-y-3">
                {COL1.map(link => (
                  <li key={link.href}>
                    <Link href={link.href}
                      className="footer-link text-sm text-slate-400 hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">Community</p>
              <ul className="space-y-3">
                {COL2.map(link => (
                  <li key={link.href}>
                    <Link href={link.href}
                      className="footer-link text-sm text-slate-400 hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: Newsletter / CTA */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">Browse</p>
            <ul className="space-y-3">
              {[
                { href: '/professors',      label: 'All Professors' },
                { href: '/courses',         label: 'All Courses' },
                { href: '/universities',    label: 'Universities' },
                { href: '/schedule-builder',label: 'Schedule Builder' },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href}
                    className="footer-link text-sm text-slate-400 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Divider */}
        <div className="mt-14" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">© 2026 EduScore Lebanon. All rights reserved.</p>
          <p className="text-xs text-slate-600 text-center max-w-sm">
            Reviews represent individual student opinions.
          </p>
        </div>
      </div>
    </footer>
  )
}
