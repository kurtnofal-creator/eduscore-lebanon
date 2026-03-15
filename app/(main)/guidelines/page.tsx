import type { Metadata } from 'next'
import { CheckCircle, XCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Community Guidelines – EduScore Lebanon',
  description: 'EduScore Lebanon community guidelines for writing helpful, respectful professor and course reviews.',
}

const ALLOWED = [
  'Honest feedback about teaching style, clarity, and communication',
  'Factual comments about grading practices, workload, and exam difficulty',
  'Constructive suggestions for improvement',
  'Comments about class organization, materials, and pace',
  'Your own academic experience and outcomes',
  'Both positive and negative feedback, as long as it is respectful',
]

const NOT_ALLOWED = [
  'Personal attacks, insults, or harassment of any kind',
  'Content targeting a professor\'s religion, ethnicity, gender, or political views',
  'Unsubstantiated accusations of misconduct or illegal activity',
  'Revealing personal information (phone numbers, home addresses, etc.)',
  'Political commentary or sectarian statements',
  'Content about non-academic personal characteristics',
  'Fake reviews or reviews written by professors about themselves',
  'Spam or repetitive content',
]

export default function GuidelinesPage() {
  return (
    <div className="container max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Community Guidelines</h1>
      <p className="text-muted-foreground mb-8">
        EduScore Lebanon is a trusted academic resource. These guidelines ensure our review platform remains helpful, fair, and respectful for all students and faculty.
      </p>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4 text-green-700 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" /> What You Can Write
          </h2>
          <ul className="space-y-3">
            {ALLOWED.map(item => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-red-700 flex items-center gap-2">
            <XCircle className="h-5 w-5" /> What Is Not Allowed
          </h2>
          <ul className="space-y-3">
            {NOT_ALLOWED.map(item => (
              <li key={item} className="flex items-start gap-3">
                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-blue-50 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-3">Moderation Process</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            All reviews are automatically screened for policy violations before publication. Reviews that trigger automated flags enter a human moderation queue. Approved moderators review flagged content and make final decisions within 24 hours.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground mt-3">
            Users who repeatedly violate these guidelines may have their accounts suspended. If you believe a review violates these guidelines, use the Report button to flag it for moderator review.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Remember</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Professors are professionals doing their jobs. Reviews should help students make informed academic decisions — not damage anyone&apos;s career or reputation. Write the review you would want written about you if you were teaching. Focus on the academic experience, not the person.
          </p>
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
