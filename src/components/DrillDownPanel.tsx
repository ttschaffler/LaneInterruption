import { useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import type { ContainerImpact, Lane, PurchaseOrder } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';

function countdownClass(days: number): string {
  if (days < 0) return 'countdown bad';
  if (days < 7) return 'countdown warn';
  return 'countdown';
}

function ProductTable({ po }: { po: PurchaseOrder }) {
  return (
    <table className="detail">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Product</th>
          <th>Category</th>
          <th>Qty</th>
          <th>Unit value</th>
          <th>Unit margin</th>
          <th>Launch</th>
        </tr>
      </thead>
      <tbody>
        {po.lines.map((l, i) => (
          <tr key={i}>
            <td>{l.product.sku}</td>
            <td>{l.product.name}</td>
            <td className="muted">{l.product.category}</td>
            <td>{l.quantity.toLocaleString()}</td>
            <td>${l.product.unitValue}</td>
            <td>${l.product.unitMargin}</td>
            <td className="muted">{l.product.launchLink ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PONode({ po }: { po: PurchaseOrder }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tree-node">
      <div className="node-row" onClick={() => setOpen((o) => !o)}>
        <span className="caret">{open ? '▾' : '▸'}</span>
        <span className="node-label">{po.poNumber}</span>
        <span className={`badge ${po.priority === 'high' ? 'high' : 'ghost'}`}>{po.priority}</span>
        <span className="badge ghost">{po.supplierTier}</span>
        <span className="node-meta">
          <span>{po.supplier}</span>
          <span>{formatCurrency(po.value)}</span>
          <span>margin {formatCurrency(po.margin)}</span>
          {po.commercialLink && <span className="muted">↪ {po.commercialLink}</span>}
        </span>
      </div>
      {open && <ProductTable po={po} />}
    </div>
  );
}

function ContainerNode({ ci }: { ci: ContainerImpact }) {
  const [open, setOpen] = useState(false);
  const c = ci.container;
  const milestone = c.milestones[c.currentMilestoneIndex];
  return (
    <div className="tree-node">
      <div className="node-row" onClick={() => setOpen((o) => !o)}>
        <span className="caret">{open ? '▾' : '▸'}</span>
        <span className="node-label">{c.containerNo}</span>
        <span className="mot">{c.mot}</span>
        <span className="badge ghost">{c.horizon}</span>
        <span className="node-meta">
          <span>{c.purchaseOrderIds.length} PO</span>
          <span>{formatCurrency(ci.valueAtRisk)}</span>
          <span>@ {milestone?.name ?? '—'}</span>
          <span>ETA {formatDate(c.eta)}</span>
          <span className={countdownClass(c.kpi.daysRemaining)}>OTD {c.kpi.daysRemaining}d</span>
          <span className="dim service"><span className="v">+{ci.degree.leadTimeDays}d</span></span>
        </span>
      </div>
      {open && ci.purchaseOrders.map((po) => <PONode key={po.id} po={po} />)}
    </div>
  );
}

function LaneNode({
  lane,
  impacts,
  selected,
  onSelect,
}: {
  lane: Lane;
  impacts: ContainerImpact[];
  selected: boolean;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(true);
  const value = impacts.reduce((s, c) => s + c.valueAtRisk, 0);
  return (
    <div className="tree-node">
      <div
        className={`node-row ${selected ? 'selected' : ''}`}
        onClick={() => {
          setOpen((o) => !o);
          onSelect();
        }}
      >
        <span className="caret">{open ? '▾' : '▸'}</span>
        <span className="node-label">
          {lane.origin.name} → {lane.destination.name}
        </span>
        <span className="mot">{lane.mot}</span>
        {lane.inUse ? <span className="badge inuse">in use</span> : <span className="badge ghost">idle</span>}
        <span className="node-meta">
          <span>{impacts.length} containers</span>
          <span>{formatCurrency(value)}</span>
          {lane.transshipment && <span className="muted">via {lane.transshipment.name}</span>}
        </span>
      </div>
      {open && impacts.map((ci) => <ContainerNode key={ci.container.id} ci={ci} />)}
    </div>
  );
}

export function DrillDownPanel({
  selectedLaneId,
  onSelectLane,
}: {
  selectedLaneId: string | null;
  onSelectLane: (id: string) => void;
}) {
  const { selectedAssessment, visibleImpacts } = useStore();

  const byLane = useMemo(() => {
    const map = new Map<string, ContainerImpact[]>();
    for (const ci of visibleImpacts) {
      const arr = map.get(ci.lane.id) ?? [];
      arr.push(ci);
      map.set(ci.lane.id, arr);
    }
    return map;
  }, [visibleImpacts]);

  if (!selectedAssessment) return <div className="empty">Select an event.</div>;
  if (visibleImpacts.length === 0)
    return <div className="empty">No impacted containers match the current filters.</div>;

  return (
    <div>
      <div className="section-title">
        Drill-down · Event → Lane → Container → PO → Product
      </div>
      {[...byLane.entries()].map(([laneId, impacts]) => (
        <LaneNode
          key={laneId}
          lane={impacts[0].lane}
          impacts={impacts}
          selected={laneId === selectedLaneId}
          onSelect={() => onSelectLane(laneId)}
        />
      ))}
    </div>
  );
}
