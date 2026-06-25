import { describe, expect, it } from 'vitest';
import { generateDataset } from '@/data/mockData';
import { assessEvent } from './impactEngine';
import { buildAlternatives } from './alternativesEngine';
import { createMockLLM } from './llm/mockLLM';

const dataset = generateDataset();
const llm = createMockLLM();
const finder = (mot: string, includeOutsidePool: boolean) =>
  dataset.carriers.filter((c) => c.modes.includes(mot as never) && (includeOutsidePool || c.inPool));

describe('alternativesEngine', () => {
  it('produces ranked options with LT, cost and capacity feasibility', async () => {
    const suez = dataset.events.find((e) => e.affectedPortCodes.includes('EGSUZ'))!;
    const a = assessEvent(dataset, suez);
    const laneId = a.inUseLaneIds[0];
    const lane = a.impactedLanes.find((l) => l.id === laneId)!;
    const impacts = a.containerImpacts.filter((c) => c.lane.id === laneId);

    const res = await buildAlternatives(dataset, suez, lane, impacts, llm, finder);

    expect(res.options.length).toBeGreaterThan(0);
    // Sorted descending by score.
    for (let i = 1; i < res.options.length; i++) {
      expect(res.options[i - 1].score).toBeGreaterThanOrEqual(res.options[i].score);
    }
    // Every option carries the three decision dimensions.
    expect(res.options.every((o) => typeof o.leadTimeDeltaDays === 'number')).toBe(true);
    expect(res.options.every((o) => typeof o.costDelta === 'number')).toBe(true);
    expect(res.options.every((o) => typeof o.capacityFeasible === 'boolean')).toBe(true);
  });

  it('answers "can I switch carriers and avoid this entirely?" as a boolean', async () => {
    const suez = dataset.events.find((e) => e.affectedPortCodes.includes('EGSUZ'))!;
    const a = assessEvent(dataset, suez);
    const laneId = a.inUseLaneIds[0];
    const lane = a.impactedLanes.find((l) => l.id === laneId)!;
    const impacts = a.containerImpacts.filter((c) => c.lane.id === laneId);

    const res = await buildAlternatives(dataset, suez, lane, impacts, llm, finder);
    expect(typeof res.canSwitchCarrierToAvoid).toBe('boolean');
    if (res.canSwitchCarrierToAvoid) {
      expect(res.switchCarrierOption?.avoidsDisruption).toBe(true);
    }
  });

  it('includes LLM-suggested and outside-pool carrier options', async () => {
    const suez = dataset.events.find((e) => e.affectedPortCodes.includes('EGSUZ'))!;
    const a = assessEvent(dataset, suez);
    const laneId = a.inUseLaneIds[0];
    const lane = a.impactedLanes.find((l) => l.id === laneId)!;
    const impacts = a.containerImpacts.filter((c) => c.lane.id === laneId);

    const res = await buildAlternatives(dataset, suez, lane, impacts, llm, finder);
    expect(res.options.some((o) => o.fromGeneralMarket)).toBe(true);
  });
});
