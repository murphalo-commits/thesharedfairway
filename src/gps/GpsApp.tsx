import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Crosshair,
  Flag,
  Layers,
  MapPin,
  Maximize2,
  Satellite,
} from 'lucide-react';
import { NORBECK_COURSE } from './data/norbeckCourse';
import {
  ActiveGpsRound,
  HoleScoreEntry,
  LatLng,
  MapOrientation,
  MapStyle,
  SavedGpsRound,
  TeeName,
} from './types';
import {
  computeGreenDistances,
  computeHazardDistances,
  computeLayupMeasurement,
  detectNearestHole,
  distanceYards,
} from './utils/geo';
import {
  buildSavedRoundRecord,
  computeRoundSummary,
  createEmptyHoleEntry,
  createEmptyRound,
  formatToPar,
} from './utils/scorecard';
import {
  deleteRoundFromHistory,
  loadActiveRound,
  loadHandicapIndex,
  loadRoundHistory,
  saveActiveRound,
  saveHandicapIndex,
  saveRoundToHistory,
} from './utils/gpsStorage';
import { useGolfGps } from './hooks/useGolfGps';
import {
  CameraCommand,
  SatelliteHoleMap,
} from './components/SatelliteHoleMap';
import { HoleSelectorBar } from './components/HoleSelectorBar';
import { YardageHud } from './components/YardageHud';
import { HazardDrawer } from './components/HazardDrawer';
import { ScoreEntrySheet } from './components/ScoreEntrySheet';
import {
  ScorecardModal,
  ScorecardModalTab,
} from './components/ScorecardModal';

const PREFS_STORAGE_KEY = 'tsf_norbeck_gps_prefs_v1';

interface StoredGpsPrefs {
  holeNumber: number;
  selectedTee: TeeName;
  mapStyle: MapStyle;
  orientation: MapOrientation;
  showArcs: boolean;
}

const DEFAULT_PREFS: StoredGpsPrefs = {
  holeNumber: 1,
  selectedTee: 'blue',
  mapStyle: 'digital',
  orientation: 'tee-up',
  showArcs: true,
};

function loadPrefs(): StoredGpsPrefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<StoredGpsPrefs>;
    const holeNumber =
      typeof parsed.holeNumber === 'number' &&
      parsed.holeNumber >= 1 &&
      parsed.holeNumber <= 18
        ? parsed.holeNumber
        : DEFAULT_PREFS.holeNumber;
    const validTees: TeeName[] = ['black', 'blue', 'white', 'gold', 'forward'];
    const selectedTee =
      parsed.selectedTee && validTees.includes(parsed.selectedTee)
        ? parsed.selectedTee
        : DEFAULT_PREFS.selectedTee;
    const mapStyle: MapStyle =
      parsed.mapStyle === 'esri' ||
      parsed.mapStyle === 'usgs' ||
      parsed.mapStyle === 'digital'
        ? parsed.mapStyle
        : DEFAULT_PREFS.mapStyle;
    const orientation =
      parsed.orientation === 'north-up' ? 'north-up' : 'tee-up';
    const showArcs =
      typeof parsed.showArcs === 'boolean'
        ? parsed.showArcs
        : DEFAULT_PREFS.showArcs;
    return { holeNumber, selectedTee, mapStyle, orientation, showArcs };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function GpsApp() {
  const [prefs, setPrefs] = useState<StoredGpsPrefs>(() => loadPrefs());
  const [activeRound, setActiveRound] = useState<ActiveGpsRound>(() =>
    loadActiveRound(prefs.selectedTee)
  );
  const [handicapIndex, setHandicapIndex] = useState<number | null>(() =>
    loadHandicapIndex()
  );
  const [roundHistory, setRoundHistory] = useState<SavedGpsRound[]>(() =>
    loadRoundHistory()
  );
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const [scorecardModalTab, setScorecardModalTab] =
    useState<ScorecardModalTab | null>(null);

  const activeHole = useMemo(
    () =>
      NORBECK_COURSE.holes.find((h) => h.holeNumber === prefs.holeNumber) ||
      NORBECK_COURSE.holes[0],
    [prefs.holeNumber]
  );

  const [targetPosition, setTargetPosition] = useState<LatLng | null>(
    activeHole.defaultTarget
  );
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);
  const [dismissedAutoHole, setDismissedAutoHole] = useState<number | null>(null);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>({
    type: 'fit-hole',
    nonce: 0,
  });

  const gps = useGolfGps(NORBECK_COURSE, activeHole);

  // Persist user preferences
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [prefs]);

  // Persist active round & handicap index
  useEffect(() => {
    saveActiveRound(activeRound);
  }, [activeRound]);

  useEffect(() => {
    saveHandicapIndex(handicapIndex);
  }, [handicapIndex]);

  const handleSelectHole = useCallback((holeNumber: number) => {
    const nextHole =
      NORBECK_COURSE.holes.find((h) => h.holeNumber === holeNumber) ||
      NORBECK_COURSE.holes[0];
    setPrefs((prev) => ({ ...prev, holeNumber: nextHole.holeNumber }));
    setTargetPosition(nextHole.defaultTarget);
    setSelectedHazardId(null);
    setDismissedAutoHole(null);
  }, []);

  const handleSelectTee = useCallback((selectedTee: TeeName) => {
    setPrefs((prev) => ({ ...prev, selectedTee }));
    setActiveRound((prev) => ({ ...prev, tee: selectedTee }));
  }, []);

  const greenDistances = useMemo(
    () => computeGreenDistances(gps.activePosition, activeHole.green),
    [gps.activePosition, activeHole.green]
  );

  const hazardDistances = useMemo(
    () => computeHazardDistances(gps.activePosition, activeHole),
    [gps.activePosition, activeHole]
  );

  const selectedHazard = useMemo(
    () =>
      selectedHazardId
        ? hazardDistances.find((h) => h.hazard.id === selectedHazardId) || null
        : null,
    [hazardDistances, selectedHazardId]
  );

  const layupMeasurement = useMemo(() => {
    if (!targetPosition) return null;
    return computeLayupMeasurement(
      gps.activePosition,
      targetPosition,
      activeHole.green.center
    );
  }, [gps.activePosition, targetPosition, activeHole.green.center]);

  const detectedHole = useMemo(() => {
    if (gps.gpsMode !== 'live' || !gps.rawPosition) return null;
    return detectNearestHole(gps.rawPosition, NORBECK_COURSE);
  }, [gps.gpsMode, gps.rawPosition]);

  const roundSummary = useMemo(
    () => computeRoundSummary(activeRound, NORBECK_COURSE, handicapIndex),
    [activeRound, handicapIndex]
  );

  const activeHoleSummary = roundSummary.holes[activeHole.holeNumber - 1];
  const activeHoleEntry =
    activeRound.holes[activeHole.holeNumber] ||
    createEmptyHoleEntry(activeHole.holeNumber);

  const handleUpdateActiveHoleEntry = useCallback(
    (updater: (prev: HoleScoreEntry) => HoleScoreEntry) => {
      setActiveRound((prev) => {
        const current =
          prev.holes[activeHole.holeNumber] ||
          createEmptyHoleEntry(activeHole.holeNumber);
        return {
          ...prev,
          holes: {
            ...prev.holes,
            [activeHole.holeNumber]: updater(current),
          },
        };
      });
    },
    [activeHole.holeNumber]
  );

  const handleClearActiveHole = useCallback(() => {
    setActiveRound((prev) => ({
      ...prev,
      holes: {
        ...prev.holes,
        [activeHole.holeNumber]: createEmptyHoleEntry(activeHole.holeNumber),
      },
    }));
  }, [activeHole.holeNumber]);

  const handleNextOrFinish = useCallback(() => {
    setShowScoreSheet(false);
    if (activeHole.holeNumber < 18) {
      handleSelectHole(activeHole.holeNumber + 1);
    } else {
      setScorecardModalTab('ghin');
    }
  }, [activeHole.holeNumber, handleSelectHole]);

  const handleSaveRound = useCallback(() => {
    if (roundSummary.holesPlayed === 0) return;
    const record = buildSavedRoundRecord(
      activeRound,
      roundSummary,
      handicapIndex
    );
    setRoundHistory(saveRoundToHistory(record));
  }, [activeRound, roundSummary, handicapIndex]);

  const handleResetRound = useCallback(() => {
    setActiveRound(createEmptyRound('norbeck-cc', prefs.selectedTee));
    setScorecardModalTab(null);
    handleSelectHole(1);
  }, [prefs.selectedTee, handleSelectHole]);

  const handleDeleteHistoryRound = useCallback((id: string) => {
    setRoundHistory(deleteRoundFromHistory(id));
  }, []);

  const showPreviewTeeReset =
    gps.gpsMode === 'preview' &&
    distanceYards(gps.activePosition, activeHole.tee) > 3;

  const toggleTargetPin = useCallback(() => {
    setTargetPosition((prev) => {
      if (prev) return null;
      if (activeHole.defaultTarget) return activeHole.defaultTarget;
      return {
        lat: (gps.activePosition.lat + activeHole.green.center.lat) / 2,
        lng: (gps.activePosition.lng + activeHole.green.center.lng) / 2,
      };
    });
  }, [activeHole.defaultTarget, activeHole.green.center, gps.activePosition]);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0D2B1A] select-none">
      {/* Full-screen interactive course map */}
      <SatelliteHoleMap
        hole={activeHole}
        courseVectors={NORBECK_COURSE.vectors}
        playerPosition={gps.activePosition}
        gpsMode={gps.gpsMode}
        accuracyYards={gps.accuracyYards}
        targetPosition={targetPosition}
        greenDistances={greenDistances}
        layupMeasurement={layupMeasurement}
        selectedHazard={selectedHazard}
        orientation={prefs.orientation}
        mapStyle={prefs.mapStyle}
        showArcs={prefs.showArcs}
        cameraCommand={cameraCommand}
        onTargetChange={setTargetPosition}
        onPreviewPlayerChange={gps.setPreviewPosition}
        onSelectHazard={setSelectedHazardId}
      />

      {/* Top Floating Hole Selector & Settings */}
      <HoleSelectorBar
        course={NORBECK_COURSE}
        hole={activeHole}
        selectedTee={prefs.selectedTee}
        gpsMode={gps.gpsMode}
        gpsStatus={gps.status}
        accuracyYards={gps.accuracyYards}
        wakeLockActive={gps.wakeLockActive}
        mapStyle={prefs.mapStyle}
        showArcs={prefs.showArcs}
        detectedHole={detectedHole}
        dismissedAutoHole={dismissedAutoHole}
        onSelectHole={handleSelectHole}
        onSelectTee={handleSelectTee}
        onSelectMapStyle={(mapStyle) =>
          setPrefs((prev) => ({ ...prev, mapStyle }))
        }
        onToggleArcs={() =>
          setPrefs((prev) => ({ ...prev, showArcs: !prev.showArcs }))
        }
        onSwitchToLive={gps.switchToLive}
        onSwitchToPreview={gps.switchToPreview}
        onResetPreviewToTee={() => gps.resetPreviewToTee(activeHole)}
        onDismissAutoHole={setDismissedAutoHole}
      />

      {/* Left Floating Front / Center / Back Yardage HUD */}
      <YardageHud
        greenDistances={greenDistances}
        layupMeasurement={layupMeasurement}
        onClearTarget={() => setTargetPosition(null)}
      />

      {/* Right Floating Map Action Buttons */}
      <div className="fixed right-3 top-[calc(max(0.65rem,env(safe-area-inset-top))+62px)] z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={() =>
            setCameraCommand((prev) => ({
              type: 'fit-hole',
              nonce: prev.nonce + 1,
            }))
          }
          className="w-10 h-10 rounded-xl bg-[#143F27]/90 backdrop-blur-md border border-white/20 text-white hover:bg-[#1E5E3A] active:scale-95 transition-all shadow-xl flex items-center justify-center"
          title="Fit full hole"
          aria-label="Fit full hole"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() =>
            setCameraCommand((prev) => ({
              type: 'zoom-green',
              nonce: prev.nonce + 1,
            }))
          }
          className="w-10 h-10 rounded-xl bg-[#143F27]/90 backdrop-blur-md border border-white/20 text-emerald-300 hover:bg-[#1E5E3A] active:scale-95 transition-all shadow-xl flex items-center justify-center"
          title="Zoom to green"
          aria-label="Zoom to green"
        >
          <Flag className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() =>
            setPrefs((prev) => ({
              ...prev,
              orientation: prev.orientation === 'tee-up' ? 'north-up' : 'tee-up',
            }))
          }
          className="w-10 h-10 rounded-xl bg-[#143F27]/90 backdrop-blur-md border border-white/20 text-white hover:bg-[#1E5E3A] active:scale-95 transition-all shadow-xl flex flex-col items-center justify-center"
          title={
            prefs.orientation === 'tee-up'
              ? 'Orientation: Tee-to-Green Up (tap for North Up)'
              : 'Orientation: North Up (tap for Tee-to-Green)'
          }
          aria-label="Toggle map orientation"
        >
          <Compass className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span className="text-[8px] font-mono font-bold leading-none mt-0.5">
            {prefs.orientation === 'tee-up' ? 'TEE↑' : 'N↑'}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setPrefs((prev) => ({
              ...prev,
              mapStyle: prev.mapStyle === 'digital' ? 'esri' : 'digital',
            }))
          }
          className={`w-10 h-10 rounded-xl backdrop-blur-md border active:scale-95 transition-all shadow-xl flex flex-col items-center justify-center ${
            prefs.mapStyle === 'digital'
              ? 'bg-[#2E8B57]/90 border-emerald-300/60 text-white'
              : 'bg-[#143F27]/90 border-white/20 text-[#F4E4C1] hover:bg-[#1E5E3A]'
          }`}
          title={
            prefs.mapStyle === 'digital'
              ? 'Digital Course View (tap for Satellite)'
              : 'Satellite View (tap for Digital Course)'
          }
          aria-label="Toggle Digital or Satellite map view"
        >
          {prefs.mapStyle === 'digital' ? (
            <Layers className="w-3.5 h-3.5" />
          ) : (
            <Satellite className="w-3.5 h-3.5" />
          )}
          <span className="text-[8px] font-mono font-bold leading-none mt-0.5">
            {prefs.mapStyle === 'digital' ? 'DIG' : 'SAT'}
          </span>
        </button>

        <button
          type="button"
          onClick={toggleTargetPin}
          className={`w-10 h-10 rounded-xl backdrop-blur-md border active:scale-95 transition-all shadow-xl flex items-center justify-center ${
            targetPosition
              ? 'bg-[#2E8B57]/90 border-[#D4AF37] text-[#F4E4C1]'
              : 'bg-[#143F27]/90 border-white/20 text-white/75 hover:bg-[#1E5E3A]'
          }`}
          title={targetPosition ? 'Hide target pin' : 'Drop target pin'}
          aria-label="Toggle target pin"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {showPreviewTeeReset && (
          <button
            type="button"
            onClick={() => gps.resetPreviewToTee(activeHole)}
            className="w-10 h-10 rounded-xl bg-[#143F27]/90 backdrop-blur-md border border-[#F4E4C1]/50 text-[#F4E4C1] hover:bg-[#1E5E3A] active:scale-95 transition-all shadow-xl flex flex-col items-center justify-center"
            title="Reset preview golfer to tee"
            aria-label="Reset preview golfer to tee"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="text-[8px] font-mono font-bold leading-none mt-0.5">
              TEE
            </span>
          </button>
        )}
      </div>

      {/* Bottom Interactive Hazard & Score Drawer */}
      <HazardDrawer
        holeNumber={activeHole.holeNumber}
        hazards={hazardDistances}
        selectedHazardId={selectedHazardId}
        currentHoleScore={activeHoleEntry.gross}
        currentHolePar={activeHole.par}
        runningToPar={
          roundSummary.holesPlayed > 0 ? formatToPar(roundSummary.toPar) : null
        }
        holesPlayed={roundSummary.holesPlayed}
        onSelectHazard={setSelectedHazardId}
        onOpenScoreEntry={() => setShowScoreSheet(true)}
        onOpenScorecard={() => setScorecardModalTab('scorecard')}
      />

      {/* Slide-up Quick Hole Score Entry Sheet */}
      <ScoreEntrySheet
        isOpen={showScoreSheet}
        hole={activeHole}
        entry={activeHoleEntry}
        strokesReceived={activeHoleSummary?.strokes ?? null}
        ndbMax={activeHoleSummary?.ndbMax ?? activeHole.par + 5}
        hasHandicap={roundSummary.hasHandicap}
        runningToPar={roundSummary.toPar}
        holesPlayed={roundSummary.holesPlayed}
        onUpdateEntry={handleUpdateActiveHoleEntry}
        onClearHole={handleClearActiveHole}
        onOpenScorecard={() => {
          setShowScoreSheet(false);
          setScorecardModalTab('scorecard');
        }}
        onNextOrFinish={handleNextOrFinish}
        onClose={() => setShowScoreSheet(false)}
      />

      {/* 3-Tab Scorecard, GHIN Summary & Round History Modal */}
      <ScorecardModal
        isOpen={scorecardModalTab !== null}
        initialTab={scorecardModalTab || 'scorecard'}
        course={NORBECK_COURSE}
        activeRound={activeRound}
        summary={roundSummary}
        handicapIndex={handicapIndex}
        roundHistory={roundHistory}
        onChangeHandicapIndex={setHandicapIndex}
        onJumpToHoleScore={(holeNum) => {
          setScorecardModalTab(null);
          handleSelectHole(holeNum);
          setShowScoreSheet(true);
        }}
        onSaveRound={handleSaveRound}
        onResetRound={handleResetRound}
        onDeleteHistoryRound={handleDeleteHistoryRound}
        onClose={() => setScorecardModalTab(null)}
      />
    </main>
  );
}
