import { useStore } from '@/state/store';
import { formatCurrency } from '@/utils/format';

function Dim({ cls, k, children }: { cls: string; k: string; children: React.ReactNode }) {
  return (
    <span className={`dim ${cls}`}>
      <span className="k">{k}</span>
      <span className="v">{children}</span>
    </span>
  );
}

export function ImpactSummary() {
  const { selectedAssessment } = useStore();
  if (!selectedAssessment) return null;
  const t = selectedAssessment.totals;

  return (
    <div>
      <div className="summary-grid">
        <div className="stat">
          <div className="v">{t.containers}</div>
          <div className="k">Containers at risk</div>
        </div>
        <div className="stat">
          <div className="v">{t.purchaseOrders}</div>
          <div className="k">POs at risk</div>
        </div>
        <div className="stat">
          <div className="v">{formatCurrency(t.valueAtRisk)}</div>
          <div className="k">Value at risk</div>
        </div>
        <div className="stat">
          <div className="v">{t.quantityAtRisk.toLocaleString()}</div>
          <div className="k">Units at risk</div>
        </div>
      </div>

      <div className="dim-badges" style={{ marginBottom: 12 }}>
        <Dim cls="lt" k="Lead time">+{t.degree.leadTimeDays}d avg</Dim>
        <Dim cls="cost" k="Cost">{formatCurrency(t.degree.cost)}</Dim>
        <Dim cls="service" k="Service risk">{(t.degree.service * 100).toFixed(0)}%</Dim>
        <span className="dim">
          <span className="k">Short-term</span>
          <span className="v">{t.shortTermContainers}</span>
        </span>
        <span className="dim">
          <span className="k">Long-term</span>
          <span className="v">{t.longTermContainers}</span>
        </span>
      </div>

      <div className="section-title">Functions to involve</div>
      <div className="fn-chips" style={{ marginBottom: 12 }}>
        {selectedAssessment.functionsToInvolve.map((f) => (
          <span className="fn-chip" key={f}>{f}</span>
        ))}
      </div>

      {selectedAssessment.ripples.length > 0 && (
        <>
          <div className="section-title">Ripple effects (indirect) · {selectedAssessment.ripples.length}</div>
          {selectedAssessment.ripples.slice(0, 5).map((r, i) => (
            <div className="ripple" key={i}>
              <span className={`badge ${r.severity}`}>{r.severity}</span> {r.description}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
