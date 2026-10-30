import { CashFlowSchedule, Investment, InvestmentActivity } from '../types';

export function getInvestmentMetrics(
  investment: Investment,
  activities: InvestmentActivity[]
) {
  const active = activities
    .filter(activity => activity.investmentId === investment.id && !activity.reversedAt)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const openingBasis = Math.max(0, Number(investment.openingCostBasis ?? investment.amount) || 0);
  const openingUnits = Math.max(0, Number(investment.openingUnits ?? investment.units) || 0);
  const buys = active.filter(activity => activity.kind === 'buy');
  const sells = active.filter(activity => activity.kind === 'sell');
  const income = active.filter(activity => activity.kind === 'dividend' || activity.kind === 'interest');
  const purchaseCosts = buys.reduce((sum, activity) => sum + Number(activity.amount || 0) +
    Number(activity.fees || 0) + Number(activity.tax || 0), 0);
  const costBasisRemoved = sells.reduce((sum, activity) => sum + Number(activity.costBasisRemoved || 0), 0);
  const costBasis = Math.max(0, openingBasis + purchaseCosts - costBasisRemoved);
  const totalContributed = openingBasis + purchaseCosts;
  const realizedGain = sells.reduce((sum, activity) => sum + Number(activity.amount || 0) -
    Number(activity.costBasisRemoved || 0) - Number(activity.fees || 0) - Number(activity.tax || 0), 0);
  const netIncome = income.reduce((sum, activity) => sum + Number(activity.amount || 0) -
    Number(activity.fees || 0) - Number(activity.tax || 0), 0);
  const separatelyPaidCosts = active
    .filter(activity => activity.kind === 'fee' || activity.kind === 'tax')
    .reduce((sum, activity) => sum + Number(activity.amount || 0), 0);
  const units = Math.max(0, openingUnits +
    buys.reduce((sum, activity) => sum + Number(activity.quantity || 0), 0) -
    sells.reduce((sum, activity) => sum + Number(activity.quantity || 0), 0));
  const valuations = active.filter(activity => activity.kind === 'valuation');
  const recordedValue = valuations.length
    ? valuations[valuations.length - 1].amount
    : (Number(investment.currentValue ?? investment.amount) || 0);
  const hasPosition = investment.openingCostBasis === undefined || openingBasis > 0 || units > 0 || buys.length > 0;
  const currentValue = hasPosition ? recordedValue : 0;
  const unrealizedGain = currentValue - costBasis;
  const totalGain = realizedGain + netIncome + unrealizedGain - separatelyPaidCosts;
  const contributedForRoi = totalContributed + active
    .filter(activity => activity.kind === 'fee' || activity.kind === 'tax')
    .reduce((sum, activity) => sum + Number(activity.amount || 0), 0);
  return {
    activities: active,
    currentValue,
    costBasis,
    totalContributed,
    realizedGain,
    netIncome,
    unrealizedGain,
    totalGain,
    roi: contributedForRoi > 0 ? totalGain / contributedForRoi * 100 : 0,
    units
  };
}

export function addSchedulePeriod(
  date: string,
  frequency: CashFlowSchedule['frequency'],
  anchorDay?: number
): string {
  if (frequency === 'once') return date;
  const [year, month, day] = date.split('-').map(Number);
  const base = new Date(year, month - 1, day);
  if (frequency === 'weekly') base.setDate(base.getDate() + 7);
  else if (frequency === 'biweekly') base.setDate(base.getDate() + 14);
  else {
    const months = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12;
    const targetMonth = base.getMonth() + months;
    const targetYear = base.getFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const targetDay = Math.min(anchorDay || day, new Date(targetYear, normalizedMonth + 1, 0).getDate());
    return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  }
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

export function advanceSchedule(schedule: CashFlowSchedule, settledDate = schedule.nextDueDate): CashFlowSchedule {
  const settledDates = Array.from(new Set([...(schedule.settledDates || []), settledDate])).sort();
  if (schedule.frequency === 'once') {
    return { ...schedule, settledDates, status: 'completed', updatedAt: Date.now() };
  }
  let nextDueDate = schedule.startDate || schedule.nextDueDate;
  for (let count = 0; count < 10_000 && settledDates.includes(nextDueDate); count++) {
    nextDueDate = addSchedulePeriod(nextDueDate, schedule.frequency, schedule.anchorDay);
  }
  return {
    ...schedule,
    settledDates,
    nextDueDate,
    updatedAt: Date.now()
  };
}

export function restoreScheduleOccurrence(schedule: CashFlowSchedule, occurrenceDate: string): CashFlowSchedule {
  const settledDates = (schedule.settledDates || []).filter(date => date !== occurrenceDate);
  let nextDueDate = schedule.startDate || schedule.nextDueDate;
  if (schedule.frequency !== 'once') {
    for (let count = 0; count < 10_000 && settledDates.includes(nextDueDate); count++) {
      nextDueDate = addSchedulePeriod(nextDueDate, schedule.frequency, schedule.anchorDay);
    }
  }
  return {
    ...schedule,
    settledDates,
    nextDueDate,
    status: schedule.frequency === 'once' ? 'active' : schedule.status === 'completed' ? 'active' : schedule.status,
    updatedAt: Date.now()
  };
}
