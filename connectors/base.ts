/**
 * Base connector with shared HTTP utilities and retry logic.
 */

import { ConnectorConfig, ConnectorResult, UniversityConnector } from './types'

export abstract class BaseConnector implements UniversityConnector {
  abstract readonly name: string
  abstract readonly universitySlug: string

  protected defaultConcurrency = 5
  protected defaultTimeoutMs = 15_000

  abstract fetch(config: ConnectorConfig): Promise<ConnectorResult>

  /** Fetch a URL with timeout + retry */
  protected async fetchUrl(
    url: string,
    options: RequestInit = {},
    timeoutMs = this.defaultTimeoutMs,
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...options, signal: controller.signal })
      return res
    } finally {
      clearTimeout(timer)
    }
  }

  protected async fetchText(url: string, options?: RequestInit): Promise<string> {
    const res = await this.fetchUrl(url, options)
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return res.text()
  }

  protected async fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await this.fetchUrl(url, options)
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return res.json() as Promise<T>
  }

  /** Normalize a day string to standard enum value */
  protected normalizeDay(raw: string): string {
    const map: Record<string, string> = {
      m: 'MONDAY', mo: 'MONDAY', mon: 'MONDAY', monday: 'MONDAY',
      t: 'TUESDAY', tu: 'TUESDAY', tue: 'TUESDAY', tuesday: 'TUESDAY',
      w: 'WEDNESDAY', we: 'WEDNESDAY', wed: 'WEDNESDAY', wednesday: 'WEDNESDAY',
      r: 'THURSDAY', th: 'THURSDAY', thu: 'THURSDAY', thursday: 'THURSDAY',
      f: 'FRIDAY', fr: 'FRIDAY', fri: 'FRIDAY', friday: 'FRIDAY',
      s: 'SATURDAY', sa: 'SATURDAY', sat: 'SATURDAY', saturday: 'SATURDAY',
      u: 'SUNDAY', su: 'SUNDAY', sun: 'SUNDAY', sunday: 'SUNDAY',
    }
    return map[raw.trim().toLowerCase()] ?? raw.toUpperCase()
  }

  /** Parse "10:30 AM" / "10:30" to "HH:MM" 24h */
  protected normalizeTime(raw: string): string {
    const s = raw.trim()
    const ampm = /(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(s)
    if (ampm) {
      let h = parseInt(ampm[1])
      const m = ampm[2]
      const period = ampm[3].toLowerCase()
      if (period === 'pm' && h !== 12) h += 12
      if (period === 'am' && h === 12) h = 0
      return `${String(h).padStart(2, '0')}:${m}`
    }
    const plain = /(\d{1,2}):(\d{2})/.exec(s)
    if (plain) return `${String(parseInt(plain[1])).padStart(2, '0')}:${plain[2]}`
    return s
  }
}
