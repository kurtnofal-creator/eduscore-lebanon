/**
 * Connector health check — validates sync output against known baselines.
 *
 * If a source's structure changes or temporarily fails, counts will drop.
 * This module detects anomalies early so admins are alerted via SyncLog
 * instead of silently serving incomplete data.
 */

import type { ConnectorResult } from '@/connectors/types'

export interface HealthThresholds {
  /** Minimum sections expected for a full sync */
  minSections: number
  /** Minimum distinct subject prefixes expected */
  minSubjects: number
  /** Minimum distinct instructors expected */
  minProfessors: number
  /** Maximum tolerable error string count */
  maxErrors: number
}

export interface HealthCheckResult {
  passed: boolean
  sectionCount: number
  subjectCount: number
  professorCount: number
  confirmedCount: number
  warnings: string[]
  criticals: string[]
}

// Baselines established from last verified full sync (2026-03-12)
export const HEALTH_THRESHOLDS: Record<string, HealthThresholds> = {
  aub: {
    minSections:   2800,   // actual: 3435 — alert if drops >18%
    minSubjects:   70,     // actual: 96
    minProfessors: 600,    // actual: 809
    maxErrors:     50,     // confirmed rate check: 85% (some sections have no instructor in catalog)
  },
  lau: {
    minSections:   400,    // LAU returns ~600-800 sections typically
    minSubjects:   25,
    minProfessors: 100,
    maxErrors:     30,
  },
}

export function checkConnectorHealth(
  universitySlug: string,
  result: ConnectorResult,
): HealthCheckResult {
  const thresholds = HEALTH_THRESHOLDS[universitySlug]

  const sectionCount  = result.sections.length
  const subjectCount  = new Set(result.sections.map(s => s.courseCode.split(' ')[0])).size
  const professorCount = new Set(result.sections.flatMap(s => s.instructors).filter(Boolean)).size
  const confirmedCount = result.sections.filter(s => s.professorConfidence === 'CONFIRMED').length

  const warnings: string[] = []
  const criticals: string[] = []

  if (!thresholds) {
    return { passed: true, sectionCount, subjectCount, professorCount, confirmedCount, warnings, criticals }
  }

  if (sectionCount < thresholds.minSections) {
    criticals.push(
      `Section count ${sectionCount} is below minimum ${thresholds.minSections}. ` +
      `Source structure may have changed or term data not yet published.`
    )
  }

  if (subjectCount < thresholds.minSubjects) {
    criticals.push(
      `Subject prefix count ${subjectCount} is below minimum ${thresholds.minSubjects}. ` +
      `Some letter pages may have failed to load.`
    )
  }

  if (professorCount < thresholds.minProfessors) {
    warnings.push(
      `Professor count ${professorCount} is below minimum ${thresholds.minProfessors}. ` +
      `Instructor column parsing may be affected.`
    )
  }

  if (result.errors.length > thresholds.maxErrors) {
    warnings.push(
      `${result.errors.length} connector errors (threshold: ${thresholds.maxErrors}). ` +
      `Check SyncLog for details.`
    )
  }

  if (result.isPartial) {
    warnings.push('Connector returned isPartial=true — some sections may be missing.')
  }

  const confirmedRate = sectionCount > 0 ? confirmedCount / sectionCount : 0
  if (confirmedRate < 0.85 && thresholds.minProfessors > 0) {
    warnings.push(
      `Professor confirmation rate ${(confirmedRate * 100).toFixed(1)}% is unexpectedly low. ` +
      `Instructor column may not be parsing correctly.`
    )
  }

  return {
    passed: criticals.length === 0,
    sectionCount,
    subjectCount,
    professorCount,
    confirmedCount,
    warnings,
    criticals,
  }
}
