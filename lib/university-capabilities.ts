/**
 * University data capability metadata.
 *
 * AUB and LAU have live official-source connectors that scrape public schedule
 * endpoints and return CONFIRMED professor assignments. All other universities
 * currently use structured historical fallback data.
 *
 * This is intentionally a static config (not DB-stored) because it reflects
 * the connector implementation tier, not runtime state.
 */

export type ScheduleBuilderMode = 'FULL' | 'LIMITED' | 'FALLBACK'
export type DataSourceType = 'LIVE_SCRAPE' | 'STRUCTURED_FALLBACK'

export interface UniversityCapability {
  /** True if we have a working live scraper against the university's public endpoint */
  liveDataSupported: boolean
  /** True if the data originates from an official university system */
  officialSourceSupported: boolean
  /** True if real-time seat/enrollment counts are available */
  seatDataAvailable: boolean
  /** How the schedule data is sourced */
  sourceType: DataSourceType
  /** How the schedule builder behaves for this university */
  scheduleBuilderMode: ScheduleBuilderMode
  /** Short human-readable tier label for UI display */
  dataLabel: string
  /** One-line description of the data source for transparency notices */
  sourceDescription: string
  /** URL or name of the upstream source */
  officialSourceName: string
}

const LIVE: Omit<UniversityCapability, 'officialSourceName' | 'sourceDescription'> = {
  liveDataSupported:      true,
  officialSourceSupported: true,
  seatDataAvailable:      false, // seat data requires per-section requests; not implemented
  sourceType:             'LIVE_SCRAPE',
  scheduleBuilderMode:    'FULL',
  dataLabel:              'Live Data',
}

const FALLBACK: Omit<UniversityCapability, 'officialSourceName' | 'sourceDescription'> = {
  liveDataSupported:      false,
  officialSourceSupported: false,
  seatDataAvailable:      false,
  sourceType:             'STRUCTURED_FALLBACK',
  scheduleBuilderMode:    'FALLBACK',
  dataLabel:              'Limited Data',
}

export const UNIVERSITY_CAPABILITIES: Record<string, UniversityCapability> = {
  aub: {
    ...LIVE,
    officialSourceName: 'AUB Public Catalog (www-banner.aub.edu.lb)',
    sourceDescription:  'Section data is fetched live from AUB\'s official public course catalog. Professor assignments are confirmed from the current term schedule.',
  },
  lau: {
    ...LIVE,
    officialSourceName: 'LAU Banner 8 Public Schedule (banweb.lau.edu.lb)',
    sourceDescription:  'Section data is fetched live from LAU\'s official Banner 8 public class schedule endpoint. Professor assignments are confirmed from the current term.',
  },
  usj: {
    ...FALLBACK,
    officialSourceName: 'Structured historical catalog',
    sourceDescription:  'Section data is based on representative historical schedule patterns. Professor assignments are inferred and have not been confirmed for the current term.',
  },
  liu: {
    ...FALLBACK,
    officialSourceName: 'Structured historical catalog',
    sourceDescription:  'Section data is based on representative historical schedule patterns. Professor assignments are inferred and have not been confirmed for the current term.',
  },
  ndu: {
    ...FALLBACK,
    officialSourceName: 'Structured historical catalog',
    sourceDescription:  'Section data is based on representative historical schedule patterns. Professor assignments are inferred and have not been confirmed for the current term.',
  },
  bau: {
    ...FALLBACK,
    officialSourceName: 'Structured historical catalog',
    sourceDescription:  'Section data is based on representative historical schedule patterns. Professor assignments are inferred and have not been confirmed for the current term.',
  },
  usek: {
    ...FALLBACK,
    officialSourceName: 'Structured historical catalog',
    sourceDescription:  'Section data is based on representative historical schedule patterns. Professor assignments are inferred and have not been confirmed for the current term.',
  },
  ua: {
    ...FALLBACK,
    officialSourceName: 'Structured historical catalog',
    sourceDescription:  'Section data is based on representative historical schedule patterns. Professor assignments are inferred and have not been confirmed for the current term.',
  },
  aust: {
    ...FALLBACK,
    officialSourceName: 'Structured historical catalog',
    sourceDescription:  'Section data is based on representative historical schedule patterns. Professor assignments are inferred and have not been confirmed for the current term.',
  },
  aou: {
    ...FALLBACK,
    officialSourceName: 'Structured historical catalog',
    sourceDescription:  'Section data is based on representative historical schedule patterns. Professor assignments are inferred and have not been confirmed for the current term.',
  },
}

/** Returns capability for a slug, defaulting to FALLBACK if unknown. */
export function getCapability(slug: string): UniversityCapability {
  return UNIVERSITY_CAPABILITIES[slug.toLowerCase()] ?? {
    ...FALLBACK,
    officialSourceName: 'Structured historical catalog',
    sourceDescription:  'Section data is based on representative historical schedule patterns.',
  }
}
