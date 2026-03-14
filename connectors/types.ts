/**
 * Connector types for per-university data ingestion.
 * Each connector fetches sections from a university's SIS or public portal
 * and normalizes data into ConnectorSection objects.
 */

export type SectionStatus = 'OPEN' | 'CLOSED' | 'WAITLIST' | 'UNKNOWN'
export type DataQualityStatus = 'COMPLETE' | 'PARTIAL' | 'MINIMAL'

export interface ConnectorMeeting {
  day: string       // MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY
  startTime: string // HH:MM 24h
  endTime: string   // HH:MM 24h
  type?: string     // LECTURE | LAB | RECITATION | TUTORIAL
  location?: string
}

export interface ConnectorSection {
  /** University-specific section/CRN identifier */
  sourceIdentifier: string
  courseCode: string
  courseName?: string
  sectionNumber: string
  instructors: string[]
  meetings: ConnectorMeeting[]
  capacity?: number
  enrolled?: number
  seatsRemaining?: number
  status: SectionStatus
  credits?: number
  location?: string
  /** Name of the connector that produced this data */
  sourceConnector: string
  /** Was this data inferred from historical records? */
  historicalInference: boolean
  /** 0.0–1.0 completeness of available fields */
  completenessScore: number
  dataQualityStatus: DataQualityStatus
  /** Confidence in the professor assignment */
  professorConfidence: 'CONFIRMED' | 'INFERRED'
}

export interface ConnectorResult {
  universitySlug: string
  termCode: string    // e.g. "SPRING-2025"
  sections: ConnectorSection[]
  fetchedAt: Date
  /** If true, data was partially available (some sections may be missing) */
  isPartial: boolean
  errors: string[]
}

export interface ConnectorConfig {
  universitySlug: string
  termCode?: string
  /** Maximum concurrent requests */
  concurrency?: number
  /** Request timeout in ms */
  timeoutMs?: number
}

/**
 * Base interface every university connector must implement.
 */
export interface UniversityConnector {
  readonly name: string
  readonly universitySlug: string
  fetch(config: ConnectorConfig): Promise<ConnectorResult>
}

/** Compute a completeness score for a ConnectorSection */
export function scoreCompleteness(s: Partial<ConnectorSection>): number {
  const fields: Array<keyof ConnectorSection> = [
    'sourceIdentifier', 'courseCode', 'sectionNumber',
    'instructors', 'meetings', 'capacity', 'enrolled',
    'seatsRemaining', 'status', 'location',
  ]
  let filled = 0
  for (const f of fields) {
    const v = s[f]
    if (v !== undefined && v !== null) {
      if (Array.isArray(v) ? v.length > 0 : true) filled++
    }
  }
  return Math.round((filled / fields.length) * 100) / 100
}

export function qualityFromScore(score: number): DataQualityStatus {
  if (score >= 0.85) return 'COMPLETE'
  if (score >= 0.5)  return 'PARTIAL'
  return 'MINIMAL'
}
