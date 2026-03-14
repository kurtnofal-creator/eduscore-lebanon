/**
 * Connector registry — maps university slugs to connector instances.
 */

import { UniversityConnector } from './types'
import { AUBConnector } from './universities/aub'
import { LAUConnector } from './universities/lau'
import { createFlexibleConnector } from './universities/flexible'

const STRUCTURED_CONNECTORS: Record<string, () => UniversityConnector> = {
  aub: () => new AUBConnector(),
  lau: () => new LAUConnector(),
}

const FLEXIBLE_SLUGS = ['usj', 'ndu', 'liu', 'aust', 'aou', 'ua', 'usek', 'bau']

export function getConnector(universitySlug: string): UniversityConnector {
  const factory = STRUCTURED_CONNECTORS[universitySlug]
  if (factory) return factory()
  if (FLEXIBLE_SLUGS.includes(universitySlug)) return createFlexibleConnector(universitySlug)
  throw new Error(`No connector registered for university: ${universitySlug}`)
}

export function hasConnector(universitySlug: string): boolean {
  return universitySlug in STRUCTURED_CONNECTORS || FLEXIBLE_SLUGS.includes(universitySlug)
}

export * from './types'
export { AUBConnector } from './universities/aub'
export { LAUConnector } from './universities/lau'
export { FlexibleConnector, createFlexibleConnector } from './universities/flexible'
