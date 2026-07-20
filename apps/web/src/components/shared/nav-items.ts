import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Calculator,
  Landmark,
  LayoutDashboard,
  LineChart,
  MessageCircle,
  Settings,
  Shield,
  Target,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** Quando true, o item só aparece para usuários com role === 'admin'. */
  adminOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Contas', path: '/accounts', icon: Landmark },
  { label: 'Transações', path: '/transactions', icon: ArrowLeftRight },
  { label: 'Metas', path: '/goals', icon: Target },
  { label: 'Relatórios', path: '/reports', icon: BarChart3 },
  { label: 'Calculadoras', path: '/calculators', icon: Calculator },
  { label: 'Investimentos', path: '/investments', icon: LineChart },
  { label: 'Chat IA', path: '/chat', icon: MessageCircle },
  { label: 'Configurações', path: '/settings', icon: Settings },
  { label: 'Status da API', path: '/health', icon: Activity },
  { label: 'Administração', path: '/admin/users', icon: Shield, adminOnly: true },
]
