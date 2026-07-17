/** Configuração pública do app (feature flags) — GET /api/v1/config, sem auth. */
export interface AppConfig {
  app_name: string
  open_finance_enabled: boolean
  ai_enabled: boolean
}
