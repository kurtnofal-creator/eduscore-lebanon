import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy – EduScore Lebanon',
  description: 'How EduScore Lebanon collects, uses, and protects your personal information.',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 text-blue-600 text-sm font-semibold mb-4">
          <Shield className="h-4 w-4" /> Legal
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Privacy Policy</h1>
        <p className="text-slate-500">Last updated: January 2025</p>
      </div>

      <div className="prose prose-slate max-w-none space-y-8 text-slate-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">1. Information We Collect</h2>
          <p>When you use EduScore Lebanon, we may collect the following information:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Account information:</strong> Name, email address, and university affiliation when you sign in via Google or email.</li>
            <li><strong>Review content:</strong> Text, ratings, and metadata you submit when writing professor or course reviews.</li>
            <li><strong>Usage data:</strong> Pages visited, searches performed, and features used, collected anonymously for analytics.</li>
            <li><strong>Technical data:</strong> IP address (hashed for privacy), browser type, and session identifiers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To authenticate you and maintain your account.</li>
            <li>To display your reviews (anonymously — your identity is never shown publicly).</li>
            <li>To send you notifications about professors and courses you follow (if enabled).</li>
            <li>To detect and prevent spam, abuse, and fake reviews.</li>
            <li>To improve the platform through aggregate analytics.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">3. Anonymity of Reviews</h2>
          <p>All reviews on EduScore Lebanon are published anonymously. We never display your name, email, or any personal identifier alongside your reviews. However, we retain a link between your account and your reviews internally for moderation and abuse prevention purposes.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">4. Data Sharing</h2>
          <p>We do not sell, rent, or share your personal information with third parties except:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Service providers who help us operate the platform (hosting, email delivery, analytics) under strict data agreements.</li>
            <li>When required by law or to protect the rights and safety of users.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">5. Cookies & Tracking</h2>
          <p>We use cookies and session tokens to keep you signed in. We use minimal analytics to understand how the platform is used — no invasive tracking or advertising cookies are used.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">6. Data Retention</h2>
          <p>Your account data is retained as long as your account is active. Reviews you submit are retained to maintain the integrity of the platform. You may request deletion of your account by contacting us.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">7. Your Rights</h2>
          <p>You have the right to access, correct, or request deletion of your personal data. Contact us at <strong>privacy@eduscore.lb</strong> with any requests.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">8. Contact</h2>
          <p>For privacy-related questions, email us at <strong>privacy@eduscore.lb</strong>.</p>
        </section>
      </div>

      <div className="mt-10 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          Reviews represent individual student opinions and do not reflect the views of EduScore Lebanon, its team, or any affiliated institutions.
        </p>
      </div>

      <div className="mt-12 pt-6 border-t border-slate-200 flex gap-6 text-sm">
        <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
        <Link href="/guidelines" className="text-blue-600 hover:underline">Community Guidelines</Link>
        <Link href="/" className="text-slate-400 hover:text-slate-700">← Back to EduScore</Link>
      </div>
    </div>
  )
}
