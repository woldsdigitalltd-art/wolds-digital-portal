export type UptimeHistoryRange = 'day' | 'week' | 'month'

export interface UptimeHistoryBucket {
  label:            string
  start:            string   // ISO timestamp of bucket start
  availability:     number   // 0-100
  downtime_seconds: number
  incidents:        number
  has_data:         boolean
}

export interface UptimeHistoryResponse {
  range:   UptimeHistoryRange
  buckets: UptimeHistoryBucket[]
  overall: {
    availability:   number
    total_downtime: number
    incidents:      number
  }
}
