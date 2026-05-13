/**
 * Pure helpers for the per-site-integration audit schedule.
 *
 * The schedule is stored on `site_integrations` as four columns:
 *   - schedule_frequency:    'off' | 'daily' | 'weekly' | 'monthly'
 *   - schedule_hour:         0–23 (UTC)
 *   - schedule_day_of_week:  0–6 (Sunday = 0), used for 'weekly' only
 *   - schedule_day_of_month: 1–28 (capped at 28 so every month is valid),
 *                            used for 'monthly' only
 *
 * `computeNextRun()` returns the next firing instant from `now`. Used:
 *   - in the API when the admin saves a schedule
 *   - in the cron worker after each successful run, to schedule the
 *     next firing.
 *
 * This module is safe to import from client components — the server-
 * only loader lives in `./schedule-loader.ts`.
 */

export type ScheduleFrequency = 'off' | 'daily' | 'weekly' | 'monthly'

export interface ScheduleInput {
  frequency:     ScheduleFrequency
  hour?:         number | null
  day_of_week?:  number | null
  day_of_month?: number | null
}

export interface SchedulePersisted extends ScheduleInput {
  last_run_at?: string | null
  next_run_at?: string | null
}

export interface ScheduleValidation {
  ok:    boolean
  error?: string
  value?: {
    frequency:     ScheduleFrequency
    hour:          number | null
    day_of_week:   number | null
    day_of_month:  number | null
  }
}

export function validateSchedule(input: ScheduleInput): ScheduleValidation {
  const frequency = input.frequency
  if (
    frequency !== 'off' &&
    frequency !== 'daily' &&
    frequency !== 'weekly' &&
    frequency !== 'monthly'
  ) {
    return { ok: false, error: 'Invalid frequency.' }
  }

  if (frequency === 'off') {
    return {
      ok: true,
      value: {
        frequency,
        hour:         null,
        day_of_week:  null,
        day_of_month: null,
      },
    }
  }

  const hour = numeric(input.hour)
  if (hour === null || hour < 0 || hour > 23) {
    return { ok: false, error: 'Hour must be between 0 and 23.' }
  }

  let dow: number | null = null
  let dom: number | null = null

  if (frequency === 'weekly') {
    dow = numeric(input.day_of_week)
    if (dow === null || dow < 0 || dow > 6) {
      return { ok: false, error: 'Day of week must be between 0 (Sun) and 6 (Sat).' }
    }
  }
  if (frequency === 'monthly') {
    dom = numeric(input.day_of_month)
    if (dom === null || dom < 1 || dom > 28) {
      return { ok: false, error: 'Day of month must be between 1 and 28.' }
    }
  }

  return { ok: true, value: { frequency, hour, day_of_week: dow, day_of_month: dom } }
}

/**
 * Compute the next firing instant for the given schedule, strictly
 * AFTER `now`. Returns `null` if the schedule is off or incomplete.
 *
 * All computations are in UTC — the `hour`/`day_of_week`/
 * `day_of_month` are interpreted as UTC values to match how the cron
 * worker compares against `NOW()` from Postgres.
 */
export function computeNextRun(
  schedule: ScheduleInput,
  now:      Date = new Date(),
): Date | null {
  const v = validateSchedule(schedule).value
  if (!v || v.frequency === 'off') return null

  const hour = v.hour ?? 0

  if (v.frequency === 'daily') {
    const candidate = setUtc(now, hour)
    return candidate > now ? candidate : addDays(candidate, 1)
  }

  if (v.frequency === 'weekly' && v.day_of_week !== null) {
    const today = setUtc(now, hour)
    const diff  = (v.day_of_week - today.getUTCDay() + 7) % 7
    let candidate = addDays(today, diff)
    if (candidate <= now) candidate = addDays(candidate, 7)
    return candidate
  }

  if (v.frequency === 'monthly' && v.day_of_month !== null) {
    const candidate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      v.day_of_month,
      hour, 0, 0, 0,
    ))
    if (candidate > now) return candidate
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      v.day_of_month,
      hour, 0, 0, 0,
    ))
  }

  return null
}

/** Human-readable summary used in the admin Services UI. */
export function describeSchedule(s: SchedulePersisted): string {
  const v = validateSchedule(s).value
  if (!v || v.frequency === 'off') return 'Not scheduled'

  const hourLabel = v.hour !== null
    ? `${String(v.hour).padStart(2, '0')}:00 UTC`
    : '00:00 UTC'

  if (v.frequency === 'daily') return `Daily at ${hourLabel}`
  if (v.frequency === 'weekly' && v.day_of_week !== null) {
    return `Weekly on ${DAY_NAMES[v.day_of_week]} at ${hourLabel}`
  }
  if (v.frequency === 'monthly' && v.day_of_month !== null) {
    return `Monthly on day ${v.day_of_month} at ${hourLabel}`
  }
  return 'Not scheduled'
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function setUtc(now: Date, hour: number): Date {
  const d = new Date(now)
  d.setUTCHours(hour, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000)
}

function numeric(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.trunc(value)
}
