import Link from 'next/link'
import { GraduationCap, Instagram, Linkedin } from 'lucide-react'

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
    <footer className="bg-slate-900 text-white border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-start">

          {/* Left: Brand */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 mb-3 group">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <GraduationCap style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <span className="font-bold text-white text-[15px]">EduScore Lebanon</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-[220px]">
              Built for Lebanese university students 🇱🇧
            </p>
          </div>

          {/* Middle: Links in two columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <ul className="space-y-2.5">
                {COL1.map(link => (
                  <li key={link.href}>
                    <Link href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <ul className="space-y-2.5">
                {COL2.map(link => (
                  <li key={link.href}>
                    <Link href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: Social links */}
          <div className="flex md:justify-end items-start gap-4">
            <a href="#" aria-label="Instagram"
              className="text-slate-400 hover:text-white transition-colors">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="#" aria-label="LinkedIn"
              className="text-slate-400 hover:text-white transition-colors">
              <Linkedin className="h-5 w-5" />
            </a>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">© 2026 EduScore Lebanon. All rights reserved.</p>
          <p className="text-xs text-slate-600 text-center max-w-sm">
            Reviews represent individual student opinions.
          </p>
        </div>
      </div>
    </footer>
  )
}
