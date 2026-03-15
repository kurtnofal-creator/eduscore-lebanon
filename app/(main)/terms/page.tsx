import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service – EduScore Lebanon',
  description: 'Read EduScore Lebanon\'s terms of service.',
}

export default function TermsPage() {
  return (
    <div className="container max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground mb-8">Last updated: January 2025</p>
      <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
          <p>By accessing or using EduScore Lebanon (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-3">2. Purpose of the Platform</h2>
          <p>EduScore Lebanon is a student-driven academic review and schedule planning platform. Reviews represent individual student academic experiences and are intended for informational purposes only. The Platform is not affiliated with any Lebanese university.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
          <p>You must create an account to submit reviews. You are responsible for maintaining the confidentiality of your account credentials. You must be a current or former student at a Lebanese university to submit reviews.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-3">4. Content Guidelines</h2>
          <p>Reviews must be based on genuine academic experiences. Prohibited content includes: personal attacks, harassment, defamatory statements, political commentary, religious discrimination, false information, and personal identifying information about professors. All reviews are subject to moderation.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-3">5. Intellectual Property</h2>
          <p>By submitting a review, you grant EduScore Lebanon a non-exclusive, royalty-free license to publish, display, and moderate your content on the Platform.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-3">6. Disclaimer</h2>
          <p>The Platform provides academic information for informational purposes only. EduScore Lebanon makes no warranties about the accuracy or completeness of professor ratings or course information. Ratings are based on student opinions and may not reflect official university positions.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
          <p>EduScore Lebanon shall not be liable for any indirect, incidental, or consequential damages arising from the use of the Platform or reliance on its content.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-3">8. Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. Continued use of the Platform constitutes acceptance of the modified terms.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
          <p>For questions about these Terms, contact us at legal@eduscore.lb</p>
        </section>
      </div>

      <div className="mt-10 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          Reviews represent individual student opinions and do not reflect the views of EduScore Lebanon, its team, or any affiliated institutions.
        </p>
      </div>
    </div>
  )
}
