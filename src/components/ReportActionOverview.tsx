import { useState } from 'react';
import { useStore } from '@/state/store';
import type { ActionStatus } from '@/types';

const STATUSES: ActionStatus[] = ['open', 'in-progress', 'resolved', 'dismissed'];

function ActionOverview() {
  const { actions, assessments, updateActionStatus } = useStore();
  const eventTitle = (id: string) => assessments.find((a) => a.event.id === id)?.event.title ?? id;

  if (actions.length === 0) return <div className="empty">No open actions. Add one from the Alternatives panel.</div>;

  return (
    <div>
      <div className="section-title">Corrective actions · {actions.length}</div>
      {actions.map((a) => (
        <div className="action-row" key={a.id}>
          <div className="title">{a.title}</div>
          <div className="desc muted" style={{ fontSize: 11, margin: '3px 0' }}>{a.description}</div>
          <div className="meta">
            <span className={`status-pill ${a.status}`}>{a.status}</span>
            <span>👤 {a.owner}</span>
            <span className="muted">↪ {eventTitle(a.eventId)}</span>
          </div>
          <div className="meta">
            {a.functionsToInvolve.map((f) => (
              <span className="fn-chip" key={f}>{f}</span>
            ))}
          </div>
          <div className="meta">
            {STATUSES.map((s) => (
              <button
                key={s}
                className={`btn sm ${s === a.status ? '' : 'ghost'}`}
                onClick={() => updateActionStatus(a.id, s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportView() {
  const { generateReport, selectedAssessment } = useStore();
  const [report, setReport] = useState<string>('');

  const copy = () => navigator.clipboard?.writeText(report).catch(() => {});
  const download = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disruption-${selectedAssessment?.event.id ?? 'report'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button className="btn" onClick={() => setReport(generateReport())}>
          Generate report
        </button>
        {report && (
          <>
            <button className="btn ghost" onClick={copy}>Copy</button>
            <button className="btn ghost" onClick={download}>Download .md</button>
          </>
        )}
      </div>
      {report ? <pre className="report">{report}</pre> : <div className="empty">One-click automated report for the selected event.</div>}
    </div>
  );
}

export function ReportActionOverview() {
  const [tab, setTab] = useState<'alts' | 'report' | 'actions'>('actions');
  // Note: alternatives live in their own panel; here we host report + actions.
  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab === 'actions' ? 'active' : ''}`} onClick={() => setTab('actions')}>
          Actions
        </button>
        <button className={`tab ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>
          Report
        </button>
      </div>
      {tab === 'actions' ? <ActionOverview /> : <ReportView />}
    </div>
  );
}
