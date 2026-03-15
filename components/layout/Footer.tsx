import Link from 'next/link'
import { GraduationCap, Instagram, Linkedin } from 'lucide-react'

const LINKS = {
  Platform: [
    { href: '/professors',       label: 'Browse Professors' },
    { href: '/courses',          label: 'Browse Courses' },
    { href: '/universities',     label: 'Universities' },
    { href: '/schedule-builder', label: 'Schedule Builder' },
  ],
  Universities: [
    { href: '/universities/aub', label: 'AUB' },
    { href: '/universities/lau', label: 'LAU' },
    { href: '/universities/usj', label: 'USJ' },
    { href: '/universities/liu', label: 'LIU' },
    { href: '/universities/ndu', label: 'NDU' },
    { href: '/universities/bau', label: 'BAU' },
  ],
  Company: [
    { href: '/about',     label: 'About' },
    { href: '/contact',   label: 'Contact' },
    { href: '/advertise', label: 'Advertise' },
  ],
  Legal: [
    { href: '/terms',      label: 'Terms of Service' },
    { href: '/privacy',    label: 'Privacy Policy' },
    { href: '/guidelines', label: 'Guidelines' },
    { href: '/disclaimer', label: 'Disclaimer' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                <GraduationCap style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <span className="font-bold text-white text-[15px]">EduScore Lebanon</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-[200px]">
              Built for Lebanese university students 🇱🇧
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="text-slate-500 hover:text-white transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
                className="text-slate-500 hover:text-white transition-colors">
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">{category}</h3>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link.href}>
                    <Link href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} EduScore Lebanon. All rights reserved.</p>
          <p className="text-xs text-slate-600 text-center max-w-sm">
            Reviews represent individual student experiences. Not affiliated with any university.
          </p>
        </div>
      </div>
    </footer>
  )
}
