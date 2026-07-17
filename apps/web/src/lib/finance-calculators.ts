export interface CompoundInterestPoint {
  month: number
  value: number
  contributed: number
}

export interface CompoundInterestResult {
  finalValue: number
  totalContributed: number
  interestEarned: number
  points: CompoundInterestPoint[]
}

// 100 anos: acima disso o gráfico trava a aba sem valor informativo
export const MAX_MONTHS = 1200

export function compoundInterest(
  principal: number,
  monthlyContribution: number,
  annualRatePercent: number,
  months: number,
): CompoundInterestResult {
  if (!Number.isFinite(principal)) principal = 0
  if (!Number.isFinite(monthlyContribution)) monthlyContribution = 0
  if (!Number.isFinite(annualRatePercent)) annualRatePercent = 0
  months = Number.isFinite(months) ? Math.min(Math.max(Math.floor(months), 0), MAX_MONTHS) : 0

  const monthlyRate = Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1
  const points: CompoundInterestPoint[] = []

  let value = principal
  let contributed = principal
  points.push({ month: 0, value, contributed })

  for (let m = 1; m <= months; m++) {
    value = value * (1 + monthlyRate) + monthlyContribution
    contributed += monthlyContribution
    points.push({ month: m, value, contributed })
  }

  return {
    finalValue: value,
    totalContributed: contributed,
    interestEarned: value - contributed,
    points,
  }
}

export interface EmergencyFundResult {
  idealValue: number
  missing: number
  monthsToReach: number | null
}

export function emergencyFund(
  monthlyExpenses: number,
  monthsCoverage: number,
  currentSaved: number,
  monthlySavings: number,
): EmergencyFundResult {
  const idealValue = monthlyExpenses * monthsCoverage
  const missing = Math.max(idealValue - currentSaved, 0)
  const monthsToReach = monthlySavings > 0 ? Math.ceil(missing / monthlySavings) : null

  return { idealValue, missing, monthsToReach }
}

export interface FinancialIndependenceResult {
  requiredNestEgg: number
  months: number | null
}

export function financialIndependence(
  monthlyExpenses: number,
  annualReturnPercent: number,
  monthlySavings: number,
): FinancialIndependenceResult {
  const requiredNestEgg = (monthlyExpenses * 12) / 0.04
  const monthlyRate = Math.pow(1 + annualReturnPercent / 100, 1 / 12) - 1

  let months: number | null = null
  if (monthlySavings > 0 && monthlyRate > 0) {
    const n = Math.log((requiredNestEgg * monthlyRate) / monthlySavings + 1) / Math.log(1 + monthlyRate)
    months = Number.isFinite(n) && n > 0 ? Math.ceil(n) : null
  }

  return { requiredNestEgg, months }
}
