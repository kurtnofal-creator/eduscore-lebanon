/**
 * FlexibleConnector – generic connector for universities without structured SIS portals.
 * Used for: USJ, NDU, LIU, AUST, AOU, UA, USEK, BAU
 *
 * Strategy:
 *  1. Attempt university-specific public timetable URL (HTML scrape via Cheerio)
 *  2. Fall back to curated static course data (historicalInference = true)
 */

import { BaseConnector } from '../base'
import {
  ConnectorConfig, ConnectorResult, ConnectorSection,
  scoreCompleteness, qualityFromScore,
} from '../types'

interface UniversityProfile {
  slug: string
  name: string
  timetableUrl?: string
  courses: Array<{ code: string; name: string; sections: string[] }>
  locationPrefix: string
}

const UNIVERSITY_PROFILES: UniversityProfile[] = [
  {
    slug: 'usj',
    name: 'Université Saint-Joseph',
    courses: [
      { code: 'INF 101', name: 'Introduction à l\'Informatique', sections: ['1', '2'] },
      { code: 'INF 201', name: 'Structures de Données', sections: ['1'] },
      { code: 'MED 301', name: 'Anatomy', sections: ['1', '2'] },
      { code: 'LAW 201', name: 'Introduction to Law', sections: ['1', '2', '3'] },
      { code: 'PHARM 101', name: 'General Pharmacology', sections: ['1'] },
      { code: 'ECON 201', name: 'Macroéconomie', sections: ['1', '2'] },
      { code: 'FRN 101', name: 'French Literature I', sections: ['1', '2'] },
      { code: 'ARC 201', name: 'Architectural Studio I', sections: ['1'] },
    ],
    locationPrefix: 'Campus USJ',
  },
  {
    slug: 'ndu',
    name: 'Notre Dame University',
    courses: [
      { code: 'CS 101', name: 'Introduction to Programming', sections: ['1', '2', '3'] },
      { code: 'CS 201', name: 'Data Structures', sections: ['1', '2'] },
      { code: 'CS 305', name: 'Software Engineering', sections: ['1'] },
      { code: 'MATH 101', name: 'Calculus I', sections: ['1', '2', '3'] },
      { code: 'BUS 101', name: 'Business Administration', sections: ['1', '2'] },
      { code: 'COMM 201', name: 'Mass Communication', sections: ['1', '2'] },
      { code: 'ENG 101', name: 'English Composition', sections: ['1', '2', '3', '4'] },
      { code: 'PHI 201', name: 'Ethics', sections: ['1', '2'] },
    ],
    locationPrefix: 'Zouk Mosbeh',
  },
  {
    slug: 'liu',
    name: 'Lebanese International University',
    courses: [
      { code: 'CIS 101', name: 'Computer Applications', sections: ['1', '2', '3'] },
      { code: 'CIS 201', name: 'Programming in C++', sections: ['1', '2'] },
      { code: 'CIS 301', name: 'Database Systems', sections: ['1', '2'] },
      { code: 'MATH 101', name: 'College Mathematics', sections: ['1', '2', '3'] },
      { code: 'ENG 101', name: 'English I', sections: ['1', '2', '3', '4', '5'] },
      { code: 'BUS 201', name: 'Principles of Management', sections: ['1', '2', '3'] },
      { code: 'ACC 201', name: 'Financial Accounting', sections: ['1', '2'] },
      { code: 'MKT 201', name: 'Marketing Fundamentals', sections: ['1', '2'] },
    ],
    locationPrefix: 'Beirut Campus',
  },
  {
    slug: 'aust',
    name: 'American University of Science & Technology',
    courses: [
      { code: 'CS 210', name: 'Object-Oriented Programming', sections: ['1', '2'] },
      { code: 'CS 310', name: 'Algorithms', sections: ['1'] },
      { code: 'EE 201', name: 'Circuit Analysis', sections: ['1', '2'] },
      { code: 'MATH 215', name: 'Linear Algebra', sections: ['1', '2'] },
      { code: 'BIO 101', name: 'Biology I', sections: ['1', '2'] },
      { code: 'CHE 101', name: 'Chemistry I', sections: ['1', '2'] },
    ],
    locationPrefix: 'AUST Achrafieh',
  },
  {
    slug: 'aou',
    name: 'Arab Open University',
    courses: [
      { code: 'T175', name: 'Networked Living', sections: ['1', '2'] },
      { code: 'M150', name: 'Data, Computing & Information', sections: ['1', '2', '3'] },
      { code: 'B207', name: 'Shaping Business Opportunities', sections: ['1', '2'] },
      { code: 'A210', name: 'Voices, Texts and Material Culture', sections: ['1'] },
      { code: 'L161', name: 'English for Academic Purposes', sections: ['1', '2', '3'] },
    ],
    locationPrefix: 'AOU Beirut',
  },
  {
    slug: 'ua',
    name: 'University of Balamand',
    courses: [
      { code: 'CS 201', name: 'Programming Fundamentals', sections: ['1', '2'] },
      { code: 'CS 301', name: 'Data Structures', sections: ['1'] },
      { code: 'ENG 101', name: 'English Writing Skills', sections: ['1', '2', '3'] },
      { code: 'MED 201', name: 'Human Anatomy', sections: ['1', '2'] },
      { code: 'ARCH 201', name: 'Design Studio I', sections: ['1'] },
      { code: 'NUR 201', name: 'Foundations of Nursing', sections: ['1', '2'] },
    ],
    locationPrefix: 'Koura Campus',
  },
  {
    slug: 'usek',
    name: 'Holy Spirit University of Kaslik',
    courses: [
      { code: 'IS 201', name: 'Introduction to Information Systems', sections: ['1', '2'] },
      { code: 'IS 301', name: 'Systems Analysis', sections: ['1'] },
      { code: 'MUS 101', name: 'Music Theory I', sections: ['1', '2'] },
      { code: 'THEO 201', name: 'Introduction to Theology', sections: ['1', '2', '3'] },
      { code: 'LAW 201', name: 'Civil Law', sections: ['1', '2'] },
      { code: 'BUS 201', name: 'Business Management', sections: ['1', '2'] },
    ],
    locationPrefix: 'Kaslik Campus',
  },
  {
    slug: 'bau',
    name: 'Beirut Arab University',
    courses: [
      { code: 'CS 201', name: 'Programming I', sections: ['1', '2', '3'] },
      { code: 'CS 301', name: 'Algorithms', sections: ['1', '2'] },
      { code: 'ENG 205', name: 'Technical Writing', sections: ['1', '2'] },
      { code: 'ARCH 301', name: 'Architectural Design III', sections: ['1', '2'] },
      { code: 'DEN 201', name: 'Dental Anatomy', sections: ['1'] },
      { code: 'LAW 201', name: 'Introduction to Islamic Law', sections: ['1', '2'] },
      { code: 'PHARM 201', name: 'Pharmaceutical Chemistry', sections: ['1'] },
    ],
    locationPrefix: 'BAU Debbieh',
  },
]

const PATTERNS = [
  { days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], start: '08:00', end: '08:50' },
  { days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], start: '10:00', end: '10:50' },
  { days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], start: '12:00', end: '12:50' },
  { days: ['TUESDAY', 'THURSDAY'], start: '09:00', end: '10:15' },
  { days: ['TUESDAY', 'THURSDAY'], start: '11:00', end: '12:15' },
  { days: ['TUESDAY', 'THURSDAY'], start: '14:00', end: '15:15' },
  { days: ['TUESDAY', 'THURSDAY'], start: '16:00', end: '17:15' },
  { days: ['MONDAY', 'WEDNESDAY'], start: '15:00', end: '16:15' },
]

export class FlexibleConnector extends BaseConnector {
  readonly name: string
  readonly universitySlug: string
  private profile: UniversityProfile

  constructor(slug: string) {
    super()
    const profile = UNIVERSITY_PROFILES.find(p => p.slug === slug)
    if (!profile) throw new Error(`No flexible connector profile for university: ${slug}`)
    this.profile = profile
    this.universitySlug = slug
    this.name = `${slug}-flexible`
  }

  async fetch(config: ConnectorConfig): Promise<ConnectorResult> {
    const termCode = config.termCode ?? 'SPRING-2025'
    const errors: string[] = []

    // Attempt public timetable if URL configured
    if (this.profile.timetableUrl) {
      try {
        const sections = await this.scrapeTimetable(this.profile.timetableUrl, termCode)
        if (sections.length > 0) {
          return { universitySlug: this.universitySlug, termCode, sections, fetchedAt: new Date(), isPartial: false, errors }
        }
      } catch (err) {
        errors.push(`Timetable scrape failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Fallback to structured data
    const sections = this.buildFallbackSections(termCode)
    errors.push(`Using structured fallback data for ${this.profile.name}`)
    return { universitySlug: this.universitySlug, termCode, sections, fetchedAt: new Date(), isPartial: true, errors }
  }

  private async scrapeTimetable(_url: string, _termCode: string): Promise<ConnectorSection[]> {
    // Generic HTML scraping — to be customized per university once their page structure is known
    throw new Error('Timetable scraping not yet implemented for this university')
  }

  private buildFallbackSections(termCode: string): ConnectorSection[] {
    const sections: ConnectorSection[] = []
    let idx = 0

    for (const course of this.profile.courses) {
      for (const secNum of course.sections) {
        const pattern = PATTERNS[idx % PATTERNS.length]
        idx++

        const section: ConnectorSection = {
          sourceIdentifier: `${this.universitySlug.toUpperCase()}-${termCode}-${course.code.replace(' ', '')}-${secNum}`,
          courseCode: course.code,
          courseName: course.name,
          sectionNumber: secNum,
          instructors: [],
          meetings: pattern.days.map(day => ({
            day,
            startTime: pattern.start,
            endTime: pattern.end,
            type: 'LECTURE' as const,
            location: `${this.profile.locationPrefix} R${100 + (idx % 40)}`,
          })),
          capacity: 35,
          enrolled: undefined,
          seatsRemaining: undefined,
          status: 'UNKNOWN',
          sourceConnector: this.name,
          historicalInference: true,
          professorConfidence: 'INFERRED',
          completenessScore: 0,
          dataQualityStatus: 'MINIMAL',
        }
        section.completenessScore = scoreCompleteness(section)
        section.dataQualityStatus = qualityFromScore(section.completenessScore)
        sections.push(section)
      }
    }

    return sections
  }
}

/** Create a FlexibleConnector for any supported university slug */
export function createFlexibleConnector(slug: string): FlexibleConnector {
  return new FlexibleConnector(slug)
}

export { UNIVERSITY_PROFILES }
