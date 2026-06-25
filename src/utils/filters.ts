import type { ContainerImpact, ImpactHorizon, ModeOfTransport, Priority } from '@/types';

export interface FilterState {
  priority: Priority | 'all';
  mot: ModeOfTransport | 'all';
  horizon: ImpactHorizon | 'all';
  /** Minimum container value-at-risk. */
  minValue: number;
  /** Minimum blended margin across the container's POs. */
  minMargin: number;
}

export const DEFAULT_FILTERS: FilterState = {
  priority: 'all',
  mot: 'all',
  horizon: 'all',
  minValue: 0,
  minMargin: 0,
};

function containerMargin(ci: ContainerImpact): number {
  return ci.purchaseOrders.reduce((s, p) => s + p.margin, 0);
}

export function applyFilters(impacts: ContainerImpact[], f: FilterState): ContainerImpact[] {
  return impacts.filter((ci) => {
    if (f.mot !== 'all' && ci.container.mot !== f.mot) return false;
    if (f.horizon !== 'all' && ci.container.horizon !== f.horizon) return false;
    if (f.priority !== 'all' && !ci.purchaseOrders.some((p) => p.priority === f.priority)) return false;
    if (ci.valueAtRisk < f.minValue) return false;
    if (containerMargin(ci) < f.minMargin) return false;
    return true;
  });
}

/** Sort keys offered in the drill-down (proximity to KPI breach, value, margin). */
export type SortKey = 'kpi' | 'value' | 'service' | 'margin';

export function sortImpacts(impacts: ContainerImpact[], key: SortKey): ContainerImpact[] {
  const copy = [...impacts];
  switch (key) {
    case 'kpi':
      return copy.sort((a, b) => a.container.kpi.daysRemaining - b.container.kpi.daysRemaining);
    case 'value':
      return copy.sort((a, b) => b.valueAtRisk - a.valueAtRisk);
    case 'service':
      return copy.sort((a, b) => b.degree.service - a.degree.service);
    case 'margin':
      return copy.sort((a, b) => containerMargin(b) - containerMargin(a));
  }
}
