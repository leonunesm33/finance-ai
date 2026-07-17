import type { ReactNode } from 'react'
import { Wallet } from 'lucide-react'

/**
 * Split-screen de autenticação: painel de marca à esquerda (lg+),
 * formulário à direita. O painel usa cores fixas da marca (verde-carvão),
 * independentes do tema ativo.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex lg:w-1/2"
        style={{ background: 'linear-gradient(160deg, #0c1210 0%, #10201a 55%, #142b22 100%)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(232, 196, 104, 0.08), transparent 70%)' }}
        />

        <div className="flex items-center gap-2 text-[#e6ece8]">
          <Wallet className="size-6 text-[#3ecf8e]" />
          <span className="font-display text-2xl font-medium tracking-tight">FinanceAI</span>
        </div>

        <div className="flex flex-col gap-8">
          <p
            aria-hidden
            className="font-display tnum text-[7rem] leading-none font-light text-[#3ecf8e]/15 select-none"
          >
            1,618
          </p>
          <div>
            <p className="font-display max-w-md text-3xl font-medium tracking-tight text-[#e6ece8]">
              Suas finanças, guardadas com critério.
            </p>
            <p className="mt-3 max-w-sm text-sm text-[#8ba298]">
              Contas, investimentos e metas em um só cofre — com inteligência para cada decisão.
            </p>
          </div>
        </div>

        <p className="text-xs text-[#8ba298]">© {new Date().getFullYear()} FinanceAI</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="mb-6 flex items-center gap-2 lg:hidden">
          <Wallet className="text-primary size-5" />
          <span className="font-display text-xl font-medium tracking-tight">FinanceAI</span>
        </div>
        {children}
      </div>
    </div>
  )
}
