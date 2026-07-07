export interface HealthStatus {
  status: 'ok' | 'error'
  db: 'ok' | 'error'
  redis: 'ok' | 'error'
}
