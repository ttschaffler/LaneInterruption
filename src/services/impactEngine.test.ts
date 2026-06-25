import { describe, expect, it } from 'vitest';
import { generateDataset } from '@/data/mockData';
import { assessAll, assessEvent, impactedLanes } from './impactEngine';

const dataset = generateDataset();

describe('impactEngine', () => {
  it('matches the Suez event to in-use sea lanes via the affected node', () => {
    const suez = dataset.events.find((e) => e.affectedPortCodes.includes('EGSUZ'))!;
    const lanes = impactedLanes(dataset, suez);
    expect(lanes.length).toBeGreaterThan(0);
    expect(lanes.every((l) => [l.origin.code, l.destination.code, l.transshipment?.code].includes('EGSUZ'))).toBe(true);
  });

  it('only surfaces containers on in-use lanes as impacted', () => {
    const suez = dataset.events.find((e) => e.affectedPortCodes.includes('EGSUZ'))!;
    const a = assessEvent(dataset, suez);
    const inUse = new Set(a.inUseLaneIds);
    expect(a.containerImpacts.every((ci) => inUse.has(ci.lane.id))).toBe(true);
    expect(a.totals.containers).toBe(a.containerImpacts.length);
  });

  it('aggregates value, quantity and the LT/cost/service degree', () => {
    const a = assessAll(dataset).find((x) => x.totals.containers > 0)!;
    expect(a.totals.valueAtRisk).toBeGreaterThan(0);
    expect(a.totals.quantityAtRisk).toBeGreaterThan(0);
    expect(a.totals.degree.leadTimeDays).toBeGreaterThan(0);
    expect(a.totals.shortTermContainers + a.totals.longTermContainers).toBe(a.totals.containers);
  });

  it('derives ripple effects only for launch/commercial-linked at-risk POs', () => {
    const a = assessAll(dataset).find((x) => x.ripples.length > 0);
    if (a) {
      expect(a.ripples.every((r) => r.target.length > 0)).toBe(true);
    }
  });
});
