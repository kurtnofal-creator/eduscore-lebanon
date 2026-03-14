import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { BetaBanner } from '@/components/BetaBanner'
import { FeedbackButton } from '@/components/FeedbackButton'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <BetaBanner />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <FeedbackButton />
    </div>
  )
}
