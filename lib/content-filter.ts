/**
 * EduScore Lebanon – Content Moderation Filter
 *
 * Screens review text for policy violations before publishing.
 * Reviews that fail checks are queued for human moderation.
 */

// Patterns that trigger auto-rejection or moderation
const HARASSMENT_PATTERNS = [
  /\b(idiot|stupid|moron|dumb|incompetent|useless|trash|garbage|loser)\b/i,
  /\b(hate|despise|disgusting|pathetic)\s+(him|her|them|this professor)\b/i,
]

const PERSONAL_INFO_PATTERNS = [
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/,         // SSN-like
  /\b\d{10,}\b/,                                 // Long number strings (phone)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
  /\b\d{1,5}\s\w+\s(street|st|avenue|ave|road|rd|blvd)\b/i, // Street addresses
]

const POLITICAL_PATTERNS = [
  /\b(hezbollah|amal|lf|kataeb|tayyar|mustaqbal|PSP)\b/i,
  /\b(political party|sectarian|shiite|sunni|maronite|christian|druze)\s+(bias|agenda|prejudice)\b/i,
]

const RELIGIOUS_PATTERNS = [
  /\b(kafir|infidel|heretic)\b/i,
  /\b(religious|faith|prayer|mosque|church)\s+(bias|discrimination|problem)\b/i,
]

const ACCUSATION_PATTERNS = [
  /\b(corrupt|bribe|sexual\s+harassment|assault|abuse|steal|theft|fraud)\b/i,
  /\baccuse[sd]?\s+of\b/i,
  /\ballegedly\s+(did|committed|stole|abused)\b/i,
]

// Words commonly used in academic discourse that should NOT be flagged
const ACADEMIC_SAFE_LIST = new Set([
  'difficult', 'hard', 'challenging', 'strict', 'demanding', 'tough',
  'unfair', 'boring', 'confusing', 'unclear', 'disorganized',
  'excellent', 'amazing', 'wonderful', 'outstanding', 'brilliant',
])

export type FilterFlag =
  | 'HARASSMENT'
  | 'PERSONAL_INFO'
  | 'POLITICAL'
  | 'RELIGIOUS'
  | 'ACCUSATION'
  | 'TOO_SHORT'
  | 'SPAM'

export interface FilterResult {
  allowed: boolean          // true = publish immediately
  requiresModeration: boolean // true = queue for human review
  flags: FilterFlag[]
  cleanedText: string       // text with personal info redacted
}

/**
 * Run a review body through all content filters.
 */
export function filterReview(text: string): FilterResult {
  const flags: FilterFlag[] = []
  let cleanedText = text

  // Minimum length check
  if (text.trim().length < 20) {
    flags.push('TOO_SHORT')
  }

  // Spam detection: too many caps, repeated characters
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length
  if (capsRatio > 0.6 && text.length > 30) {
    flags.push('SPAM')
  }

  // Personal information
  for (const pattern of PERSONAL_INFO_PATTERNS) {
    if (pattern.test(cleanedText)) {
      flags.push('PERSONAL_INFO')
      cleanedText = cleanedText.replace(pattern, '[REDACTED]')
    }
  }

  // Harassment
  for (const pattern of HARASSMENT_PATTERNS) {
    if (pattern.test(text)) {
      flags.push('HARASSMENT')
      break
    }
  }

  // Political statements
  for (const pattern of POLITICAL_PATTERNS) {
    if (pattern.test(text)) {
      flags.push('POLITICAL')
      break
    }
  }

  // Religious commentary
  for (const pattern of RELIGIOUS_PATTERNS) {
    if (pattern.test(text)) {
      flags.push('RELIGIOUS')
      break
    }
  }

  // Accusations
  for (const pattern of ACCUSATION_PATTERNS) {
    if (pattern.test(text)) {
      flags.push('ACCUSATION')
      break
    }
  }

  // Determine outcome
  const hardBlockFlags: FilterFlag[] = ['HARASSMENT', 'PERSONAL_INFO', 'ACCUSATION', 'SPAM']
  const softFlags: FilterFlag[] = ['POLITICAL', 'RELIGIOUS']

  const hasHardBlock = flags.some(f => hardBlockFlags.includes(f))
  const hasSoftFlag = flags.some(f => softFlags.includes(f))
  const isTooShort = flags.includes('TOO_SHORT')

  return {
    allowed: !hasHardBlock && !hasSoftFlag && !isTooShort,
    requiresModeration: hasSoftFlag || isTooShort,
    flags,
    cleanedText,
  }
}

/**
 * Check if a review body is a likely duplicate of an existing review.
 * Uses simple similarity heuristic (Jaccard on word sets).
 */
export function isDuplicateReview(newText: string, existingTexts: string[]): boolean {
  const newWords = new Set(newText.toLowerCase().split(/\W+/).filter(w => w.length > 3))

  for (const existing of existingTexts) {
    const existingWords = new Set(existing.toLowerCase().split(/\W+/).filter(w => w.length > 3))
    const intersection = [...newWords].filter(w => existingWords.has(w)).length
    const union = new Set([...newWords, ...existingWords]).size
    const similarity = intersection / union

    if (similarity > 0.75) return true
  }

  return false
}

/**
 * Hash an IP address for privacy-preserving abuse detection.
 */
export async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + (process.env.AUTH_SECRET ?? 'eduscore-salt'))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}
