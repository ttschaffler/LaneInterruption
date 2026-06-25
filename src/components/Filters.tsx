import { useStore } from '@/state/store';
import type { ImpactHorizon, ModeOfTransport, Priority } from '@/types';
import type { SortKey } from '@/utils/filters';

export function Filters() {
  const { filters, setFilters, sortKey, setSortKey } = useStore();

  return (
    <div className="filters">
      <label>
        Priority
        <select
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value as Priority | 'all' })}
        >
          <option value="all">All</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label>
        MOT
        <select
          value={filters.mot}
          onChange={(e) => setFilters({ ...filters, mot: e.target.value as ModeOfTransport | 'all' })}
        >
          <option value="all">All</option>
          <option value="sea">Sea</option>
          <option value="air">Air</option>
          <option value="sea-air">Sea-air</option>
          <option value="rail">Rail</option>
        </select>
      </label>
      <label>
        Horizon
        <select
          value={filters.horizon}
          onChange={(e) => setFilters({ ...filters, horizon: e.target.value as ImpactHorizon | 'all' })}
        >
          <option value="all">All</option>
          <option value="short-term">Short-term</option>
          <option value="long-term">Long-term</option>
        </select>
      </label>
      <label>
        Min value ($k)
        <input
          type="number"
          min={0}
          step={50}
          value={filters.minValue / 1000}
          onChange={(e) => setFilters({ ...filters, minValue: Number(e.target.value) * 1000 })}
          style={{ width: 70 }}
        />
      </label>
      <label>
        Min margin ($k)
        <input
          type="number"
          min={0}
          step={25}
          value={filters.minMargin / 1000}
          onChange={(e) => setFilters({ ...filters, minMargin: Number(e.target.value) * 1000 })}
          style={{ width: 70 }}
        />
      </label>
      <label>
        Sort by
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="service">Service risk</option>
          <option value="kpi">KPI countdown</option>
          <option value="value">Value at risk</option>
          <option value="margin">Margin</option>
        </select>
      </label>
    </div>
  );
}
