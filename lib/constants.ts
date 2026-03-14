/**
 * String constant objects that replace Prisma enums.
 * SQLite does not support native enums, so we use String fields in the schema
 * and these typed const objects for type-safe comparisons and assignments.
 */

export const UserRole = {
  STUDENT:   'STUDENT',
  MODERATOR: 'MODERATOR',
  ADMIN:     'ADMIN',
} as const
export type UserRole = typeof UserRole[keyof typeof UserRole]

export const ReviewStatus = {
  PENDING:  'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FLAGGED:  'FLAGGED',
} as const
export type ReviewStatus = typeof ReviewStatus[keyof typeof ReviewStatus]

export const SyncType = {
  FULL:        'FULL',
  INCREMENTAL: 'INCREMENTAL',
  MANUAL:      'MANUAL',
} as const
export type SyncType = typeof SyncType[keyof typeof SyncType]

export const SyncStatus = {
  PENDING:   'PENDING',
  RUNNING:   'RUNNING',
  COMPLETED: 'COMPLETED',
  RETRYING:  'RETRYING',
  FAILED:    'FAILED',
} as const
export type SyncStatus = typeof SyncStatus[keyof typeof SyncStatus]

export const LogLevel = {
  INFO:  'INFO',
  WARN:  'WARN',
  ERROR: 'ERROR',
  DEBUG: 'DEBUG',
} as const
export type LogLevel = typeof LogLevel[keyof typeof LogLevel]

export const ReportReason = {
  SPAM:          'SPAM',
  INAPPROPRIATE: 'INAPPROPRIATE',
  OFFENSIVE:     'OFFENSIVE',
  FAKE:          'FAKE',
  OTHER:         'OTHER',
} as const
export type ReportReason = typeof ReportReason[keyof typeof ReportReason]
