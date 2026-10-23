import { useEffect, useState } from 'react';
import {
  AnalysisSnapshot,
  JalanBetaStoreState,
  MarkovMatrix4x4,
  RoadRuas,
  RoadSegment,
  SavedScenario,
  UnitCostConfig,
  ViewRoute,
} from './types/jalan';
import { createInitialStoreState, sanitizeStoreSvgUrls } from './data/initialData';
import { buildAnalysisSnapshot } from './utils/calculations';
import { AppShell } from './components/ui/Primitives';
import { RuasView } from './components/views/RuasView';
import { InputView } from './components/views/InputView';
import { KelengkapanView } from './components/views/KelengkapanView';
import { AnalisisView } from './components/views/AnalisisView';
import { HasilView } from './components/views/HasilView';
import { SimulasiView } from './components/views/SimulasiView';
import { LaporanView } from './components/views/LaporanView';

const STORAGE_KEY = 'jalan_beta_state_v1';

const VALID_VIEWS: ViewRoute[] = [
  'ruas',
  'input',
  'kelengkapan',
  'analisis',
  'hasil',
  'simulasi',
  'laporan',
];

function parseInitialViewFromLocation(): ViewRoute {
  if (typeof window === 'undefined') return 'ruas';

  // Check hash e.g. #/input or #input
  const hashClean = window.location.hash.replace(/^#\/?/, '').split('?')[0].toLowerCase();
  if (VALID_VIEWS.includes(hashClean as ViewRoute)) {
    return hashClean as ViewRoute;
  }

  // Check query ?view=input
  const params = new URLSearchParams(window.location.search);
  const queryView = params.get('view')?.toLowerCase();
  if (queryView && VALID_VIEWS.includes(queryView as ViewRoute)) {
    return queryView as ViewRoute;
  }

  // Check pathname e.g. /input
  const pathClean = window.location.pathname.replace(/^\/+/, '').split('/')[0].toLowerCase();
  if (VALID_VIEWS.includes(pathClean as ViewRoute)) {
    return pathClean as ViewRoute;
  }

  return 'ruas';
}

function loadStoreState(): JalanBetaStoreState {
  if (typeof window === 'undefined') {
    return createInitialStoreState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createInitialStoreState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as JalanBetaStoreState;
    if (!parsed || !Array.isArray(parsed.ruasList) || parsed.ruasList.length === 0) {
      const seed = createInitialStoreState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const sanitized = sanitizeStoreSvgUrls(parsed);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch {
    return createInitialStoreState();
  }
}

export default function App() {
  const [store, setStore] = useState<JalanBetaStoreState>(() => loadStoreState());
  const [activeView, setActiveView] = useState<ViewRoute>(() =>
    parseInitialViewFromLocation()
  );

  // Persist store changes to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignore storage quota errors
    }
  }, [store]);

  // Listen to hash/popstate changes
  useEffect(() => {
    const handleRouteSync = () => {
      const nextView = parseInitialViewFromLocation();
      setActiveView(nextView);
    };
    window.addEventListener('hashchange', handleRouteSync);
    window.addEventListener('popstate', handleRouteSync);
    return () => {
      window.removeEventListener('hashchange', handleRouteSync);
      window.removeEventListener('popstate', handleRouteSync);
    };
  }, []);

  const handleNavigate = (view: ViewRoute) => {
    setActiveView(view);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#/${view}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Resolve active Ruas, Segment, and AnalysisSnapshot
  const activeRuas =
    store.ruasList.find((r) => r.id === store.activeRuasId) || store.ruasList[0];

  const activeSegment =
    activeRuas.segments.find((s) => s.id === store.activeSegmentId) ||
    activeRuas.segments[0];

  const activeSnapshot =
    store.analysisHistory.find((a) => a.id === store.activeAnalysisId) ||
    store.analysisHistory.find((a) => a.ruasId === activeRuas.id) ||
    store.analysisHistory[0];

  const handleSelectRuas = (ruasId: string) => {
    const targetRuas = store.ruasList.find((r) => r.id === ruasId);
    if (!targetRuas) return;

    const matchingAnalysis = store.analysisHistory.find((a) => a.ruasId === ruasId);
    setStore((prev) => ({
      ...prev,
      activeRuasId: targetRuas.id,
      activeSegmentId: targetRuas.segments[0]?.id || '',
      activeAnalysisId: matchingAnalysis ? matchingAnalysis.id : prev.activeAnalysisId,
    }));
  };

  const handleSelectRuasAndNavigate = (
    ruasId: string,
    targetView: ViewRoute,
    segmentId?: string
  ) => {
    const targetRuas = store.ruasList.find((r) => r.id === ruasId);
    if (!targetRuas) return;

    let matchingAnalysis = store.analysisHistory.find((a) => a.ruasId === ruasId);
    let nextHistory = store.analysisHistory;

    // If user clicks "Lihat Hasil" on a newly added Ruas that doesn't have a snapshot yet, generate its initial snapshot
    if (!matchingAnalysis && targetView === 'hasil') {
      const nextNum = store.analysisHistory.length + 1;
      matchingAnalysis = buildAnalysisSnapshot({
        id: `ANL-${targetRuas.surveyPeriod}-${String(nextNum).padStart(3, '0')}`,
        revision: 1,
        ruas: targetRuas,
        baseYear: Number(targetRuas.surveyPeriod) || 2026,
        horizonYears: 5,
        markovMatrix: store.defaultMarkovMatrix,
        unitCosts: store.defaultUnitCosts,
      });
      nextHistory = [matchingAnalysis, ...store.analysisHistory];
    }

    setStore((prev) => ({
      ...prev,
      ruasList: prev.ruasList,
      analysisHistory: nextHistory,
      activeRuasId: targetRuas.id,
      activeSegmentId: segmentId || targetRuas.segments[0]?.id || '',
      activeAnalysisId: matchingAnalysis ? matchingAnalysis.id : prev.activeAnalysisId,
    }));

    handleNavigate(targetView);
  };

  const handleAddRuas = (newRuas: RoadRuas) => {
    const nextNum = store.analysisHistory.length + 1;
    const initialSnapshotForNewRuas = buildAnalysisSnapshot({
      id: `ANL-${newRuas.surveyPeriod}-${String(nextNum).padStart(3, '0')}`,
      revision: 1,
      ruas: newRuas,
      baseYear: Number(newRuas.surveyPeriod) || 2026,
      horizonYears: 5,
      markovMatrix: store.defaultMarkovMatrix,
      unitCosts: store.defaultUnitCosts,
    });

    setStore((prev) => ({
      ...prev,
      ruasList: [...prev.ruasList, newRuas],
      activeRuasId: newRuas.id,
      activeSegmentId: newRuas.segments[0]?.id || '',
      activeAnalysisId: initialSnapshotForNewRuas.id,
      analysisHistory: [initialSnapshotForNewRuas, ...prev.analysisHistory],
    }));
  };

  const handleUpdateSegment = (updatedSegment: RoadSegment) => {
    setStore((prev) => {
      const nextRuasList = prev.ruasList.map((r) => {
        if (r.id !== updatedSegment.ruasId) return r;
        return {
          ...r,
          segments: r.segments.map((s) =>
            s.id === updatedSegment.id ? updatedSegment : s
          ),
        };
      });
      return {
        ...prev,
        ruasList: nextRuasList,
      };
    });
  };

  const handleBatchUpdateSegments = (updatedSegments: RoadSegment[]) => {
    setStore((prev) => {
      const nextRuasList = prev.ruasList.map((r) => {
        if (r.id !== activeRuas.id) return r;
        return {
          ...r,
          segments: updatedSegments,
        };
      });
      return {
        ...prev,
        ruasList: nextRuasList,
      };
    });
  };

  const handleSaveSnapshotAndOpenHasil = (
    snapshot: AnalysisSnapshot,
    markovMatrix: MarkovMatrix4x4,
    unitCosts: UnitCostConfig
  ) => {
    setStore((prev) => ({
      ...prev,
      activeAnalysisId: snapshot.id,
      analysisHistory: [snapshot, ...prev.analysisHistory],
      defaultMarkovMatrix: markovMatrix,
      defaultUnitCosts: unitCosts,
    }));
    handleNavigate('hasil');
  };

  const handleOpenExistingSnapshot = (analysisId: string) => {
    const snap = store.analysisHistory.find((a) => a.id === analysisId);
    if (!snap) return;
    setStore((prev) => ({
      ...prev,
      activeRuasId: snap.ruasId,
      activeAnalysisId: snap.id,
    }));
    handleNavigate('hasil');
  };

  const handleSaveScenario = (scenario: SavedScenario) => {
    setStore((prev) => ({
      ...prev,
      savedScenarios: [scenario, ...prev.savedScenarios],
    }));
  };

  return (
    <AppShell
      activeView={activeView}
      onNavigate={handleNavigate}
      activeRuas={activeRuas}
      activeSegment={activeSegment}
      ruasList={store.ruasList}
      onSelectRuas={handleSelectRuas}
    >
      {activeView === 'ruas' && (
        <RuasView
          store={store}
          onAddRuas={handleAddRuas}
          onSelectRuasAndNavigate={handleSelectRuasAndNavigate}
          onImportStoreBackup={(nextStore) => setStore(nextStore)}
        />
      )}

      {activeView === 'input' && (
        <InputView
          activeRuas={activeRuas}
          activeSegment={activeSegment}
          onSelectSegment={(segId) =>
            setStore((prev) => ({ ...prev, activeSegmentId: segId }))
          }
          onUpdateSegment={handleUpdateSegment}
        />
      )}

      {activeView === 'kelengkapan' && (
        <KelengkapanView
          activeRuas={activeRuas}
          onOpenSegmentInput={(segId) => {
            setStore((prev) => ({ ...prev, activeSegmentId: segId }));
            handleNavigate('input');
          }}
          onBatchUpdateSegments={handleBatchUpdateSegments}
          onNavigateToAnalisis={() => handleNavigate('analisis')}
        />
      )}

      {activeView === 'analisis' && (
        <AnalisisView
          store={store}
          activeRuas={activeRuas}
          onSelectRuas={handleSelectRuas}
          onSaveSnapshotAndOpenHasil={handleSaveSnapshotAndOpenHasil}
          onOpenExistingSnapshot={handleOpenExistingSnapshot}
        />
      )}

      {activeView === 'hasil' && activeSnapshot && (
        <HasilView
          snapshot={activeSnapshot}
          allSnapshots={store.analysisHistory}
          onSelectSnapshot={(analysisId) =>
            setStore((prev) => ({ ...prev, activeAnalysisId: analysisId }))
          }
          onNavigateToSimulasi={() => handleNavigate('simulasi')}
          onNavigateToLaporan={() => handleNavigate('laporan')}
          onInspectSegmentInInput={(ruasId, segmentId) =>
            handleSelectRuasAndNavigate(ruasId, 'input', segmentId)
          }
        />
      )}

      {activeView === 'simulasi' && activeSnapshot && (
        <SimulasiView
          baselineSnapshot={activeSnapshot}
          savedScenarios={store.savedScenarios}
          onSaveScenario={handleSaveScenario}
        />
      )}

      {activeView === 'laporan' && activeSnapshot && (
        <LaporanView
          snapshot={activeSnapshot}
          allSnapshots={store.analysisHistory}
          savedScenarios={store.savedScenarios}
          onSelectSnapshot={(analysisId) =>
            setStore((prev) => ({ ...prev, activeAnalysisId: analysisId }))
          }
        />
      )}
    </AppShell>
  );
}
