import type { LucideIcon } from 'lucide-react'
import { Activity, Landmark, LayoutDashboard, Settings } from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Contas', path: '/accounts', icon: Landmark },
  { label: 'Configurações', path: '/settings', icon: Settings },
  { label: 'Status da API', path: '/health', icon: Activity },
]
