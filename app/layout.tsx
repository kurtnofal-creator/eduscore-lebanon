import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'
import { auth } from '@/lib/auth'
import { SessionProvider } from 'next-auth/react'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://eduscore.lb'),
  title: {
    default: 'EduScore Lebanon – Professor Reviews & Schedule Planner',
    template: '%s | EduScore Lebanon',
  },
  description:
    'Read honest professor reviews, compare courses, and build your perfect class schedule at AUB, LAU, USJ, LIU, NDU, BAU, and other Lebanese universities.',
  keywords: [
    'Lebanon university reviews',
    'AUB professor reviews',
    'LAU course ratings',
    'Lebanese university schedule planner',
    'professor ratings Lebanon',
    'course difficulty Lebanon',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'EduScore Lebanon',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className="font-sans">
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
