export type IncidentSeverity = 'info' | 'warning' | 'critical'
export type IncidentStatus   = 'open' | 'resolved' | 'dismissed'
export type AlertStatus      = 'open' | 'resolved'
export type CommentRole      = 'admin' | 'customer'

export interface Incident {
  id:              string
  site_id:         string
  integration_key: string
  rule_key:        string
  title:           string
  description:     string
  severity:        IncidentSeverity
  status:          IncidentStatus
  dismiss_reason:  string | null
  created_at:      string
  updated_at:      string
  resolved_at:     string | null
  resolved_by:     string | null
}

export interface IncidentComment {
  id:          string
  incident_id: string
  author_id:   string
  author_role: CommentRole
  body:        string
  created_at:  string
}

export interface Alert {
  id:              string
  site_id:         string
  integration_key: string
  rule_key:        string
  title:           string
  description:     string | null
  severity:        IncidentSeverity
  status:          AlertStatus
  created_at:      string
  resolved_at:     string | null
}

/** Passed to raiseIncident() / raiseAlert() by each rule evaluator. */
export interface IncidentInput {
  site_id:         string
  integration_key: string
  rule_key:        string
  title:           string
  description:     string
  severity:        IncidentSeverity
}

export interface AlertInput {
  site_id:         string
  integration_key: string
  rule_key:        string
  title:           string
  description?:    string
  severity:        IncidentSeverity
}
