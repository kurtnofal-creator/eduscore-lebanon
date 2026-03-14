/**
 * EduScore Lebanon – Post-Sync Database Integrity Checker (Part 2)
 *
 * Runs after a sync job completes to catch anomalies that the connector
 * health check cannot detect (e.g. orphaned records, data drift, skew between
 * source counts and DB counts).
 *
 * Call checkDBIntegrity() in engine.ts after completeSyncJob().
 */

import { prisma } from '@/lib/db'

export interface DBIntegrityResult {
  universityId: string
  termId: string
  totalSections: number
  sectionsNoMeetings: number
  sectionsNoProfessors: number
  staleSections: number
  confirmedRate: number        // 0.0–1.0
  crnCoverageRate: number      // 0.0–1.0 (fraction of sections with a CRN)
  healthScore: number          // 0–100 composite score
  passed: boolean
  warnings: string[]
  criticals: string[]
}

export async function checkDBIntegrity(
  universityId: string,
  termId: string,
): Promise<DBIntegrityResult> {
  const warnings: string[] = []
  const criticals: string[] = []

  // ── Count sections for this university + term ────────────────────────────
  const total = await prisma.section.count({
    where: {
      termId,
      isActive: true,
      course: { department: { faculty: { universityId } } },
    },
  })

  if (total === 0) {
    criticals.push(`No active sections found for term ${termId}. Sync may have failed silently.`)
    return {
      universityId, termId,
      totalSections: 0, sectionsNoMeetings: 0, sectionsNoProfessors: 0,
      staleSections: 0, confirmedRate: 0, crnCoverageRate: 0,
      healthScore: 0, passed: false, warnings, criticals,
    }
  }

  // ── Sections with no meeting times ───────────────────────────────────────
  const noMeetings = await prisma.section.count({
    where: {
      termId,
      isActive: true,
      meetings: { none: {} },
      course: { department: { faculty: { universityId } } },
    },
  })
  const noMeetingsPct = noMeetings / total
  if (noMeetingsPct > 0.5) {
    criticals.push(
      `${(noMeetingsPct * 100).toFixed(1)}% of sections have no meeting times (${noMeetings}/${total}). ` +
      `Connector may not be extracting schedule data correctly.`
    )
  } else if (noMeetingsPct > 0.3) {
    warnings.push(
      `${(noMeetingsPct * 100).toFixed(1)}% of sections have no meeting times — expected for TBA/online but higher than usual.`
    )
  }

  // ── Sections with no professor assignments ──────────────────────────────
  const noProfessors = await prisma.section.count({
    where: {
      termId,
      isActive: true,
      professors: { none: {} },
      course: { department: { faculty: { universityId } } },
    },
  })
  const noProfPct = noProfessors / total
  if (noProfPct > 0.5) {
    criticals.push(
      `${(noProfPct * 100).toFixed(1)}% of sections have no professor assigned (${noProfessors}/${total}). ` +
      `Professor extraction may be broken.`
    )
  } else if (noProfPct > 0.3) {
    warnings.push(
      `${(noProfPct * 100).toFixed(1)}% of sections have no professor — instructor column may be partially unavailable.`
    )
  }

  // ── Stale section ratio ──────────────────────────────────────────────────
  const stale = await prisma.section.count({
    where: {
      termId,
      isActive: true,
      isStale: true,
      course: { department: { faculty: { universityId } } },
    },
  })
  const stalePct = stale / total
  if (stalePct > 0.3) {
    warnings.push(
      `${(stalePct * 100).toFixed(1)}% of sections are stale (${stale}/${total}). ` +
      `Consider triggering a fresh sync.`
    )
  }

  // ── CONFIRMED professor rate ─────────────────────────────────────────────
  const confirmedAssignments = await prisma.sectionProfessor.count({
    where: {
      confidence: 'CONFIRMED',
      section: {
        termId,
        isActive: true,
        course: { department: { faculty: { universityId } } },
      },
    },
  })
  const totalAssignments = await prisma.sectionProfessor.count({
    where: {
      section: {
        termId,
        isActive: true,
        course: { department: { faculty: { universityId } } },
      },
    },
  })
  const confirmedRate = totalAssignments > 0 ? confirmedAssignments / totalAssignments : 0
  if (totalAssignments > 50 && confirmedRate < 0.7) {
    warnings.push(
      `Professor confirmation rate ${(confirmedRate * 100).toFixed(1)}% is low. ` +
      `Instructor column may not be parsing correctly for this university.`
    )
  }

  // ── CRN coverage rate ───────────────────────────────────────────────────
  const withCrn = await prisma.section.count({
    where: {
      termId,
      isActive: true,
      crn: { not: null },
      course: { department: { faculty: { universityId } } },
    },
  })
  const crnRate = withCrn / total
  if (crnRate < 0.5 && total > 20) {
    warnings.push(
      `CRN coverage is ${(crnRate * 100).toFixed(1)}% (${withCrn}/${total}). ` +
      `CRN extraction may be incomplete — students won't be able to register without CRNs.`
    )
  }

  // ── Health score (0–100) ─────────────────────────────────────────────────
  // Deductions for each problem category
  let score = 100
  score -= noMeetingsPct > 0.5 ? 30 : noMeetingsPct > 0.3 ? 10 : 0
  score -= noProfPct > 0.5 ? 25 : noProfPct > 0.3 ? 10 : 0
  score -= stalePct > 0.3 ? 15 : stalePct > 0.1 ? 5 : 0
  score -= totalAssignments > 50 && confirmedRate < 0.7 ? 10 : 0
  score -= crnRate < 0.5 && total > 20 ? 10 : 0
  score -= criticals.length * 15
  score = Math.max(0, Math.min(100, score))

  return {
    universityId,
    termId,
    totalSections: total,
    sectionsNoMeetings: noMeetings,
    sectionsNoProfessors: noProfessors,
    staleSections: stale,
    confirmedRate,
    crnCoverageRate: crnRate,
    healthScore: Math.round(score),
    passed: criticals.length === 0,
    warnings,
    criticals,
  }
}

/**
 * Detect and auto-correct orphaned/duplicate records after sync.
 * Returns the number of records corrected.
 */
export async function autoCorrectOrphans(termId: string): Promise<{ deactivatedOrphans: number }> {
  // Deactivate sections whose course is inactive
  const result = await prisma.section.updateMany({
    where: {
      termId,
      isActive: true,
      course: { isActive: false },
    },
    data: { isActive: false },
  })

  return { deactivatedOrphans: result.count }
}
