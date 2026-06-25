import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { EventFeed } from './components/EventFeed';
import { ImpactSummary } from './components/ImpactSummary';
import { Filters } from './components/Filters';
import { LaneView } from './components/LaneView';
import { DrillDownPanel } from './components/DrillDownPanel';
import { AlternativesPanel } from './components/AlternativesPanel';
import { ReportActionOverview } from './components/ReportActionOverview';

export function App() {
  const { selectedAssessment } = useStore();
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);

  // Reset / default the selected lane when the event changes.
  useEffect(() => {
    setSelectedLaneId(selectedAssessment?.inUseLaneIds[0] ?? null);
  }, [selectedAssessment]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Lane Disruption Intelligence</h1>
        <span className="sub">What is disrupted · what does it cost · what do I do about it</span>
        <span className="spacer" />
        <span className="sub">Visibility horizon +6 weeks · mock data</span>
      </header>

      <div className="layout">
        <aside className="col left">
          <EventFeed />
        </aside>

        <main className="col center">
          {selectedAssessment ? (
            <>
              <ImpactSummary />
              <LaneView selectedLaneId={selectedLaneId} onSelectLane={setSelectedLaneId} />
              <div style={{ height: 12 }} />
              <Filters />
              <DrillDownPanel selectedLaneId={selectedLaneId} onSelectLane={setSelectedLaneId} />
            </>
          ) : (
            <div className="empty">No event selected.</div>
          )}
        </main>

        <aside className="col right">
          <AlternativesPanel selectedLaneId={selectedLaneId} />
          <div style={{ height: 16 }} />
          <ReportActionOverview />
        </aside>
      </div>
    </div>
  );
}
