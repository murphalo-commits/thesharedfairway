import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Satellite,
  Settings,
  X,
  Check,
  MapPin,
} from 'lucide-react';
import {
  CourseGpsData,
  GpsMode,
  HoleGpsData,
  SatelliteSource,
  TeeName,
} from '../types';
import { GpsStatus } from '../hooks/useGolfGps';

interface HoleSelectorBarProps {
  course: CourseGpsData;
  hole: HoleGpsData;
  selectedTee: TeeName;
  gpsMode: GpsMode;
  gpsStatus: GpsStatus;
  accuracyYards: number | null;
  wakeLockActive: boolean;
  satelliteSource: SatelliteSource;
  showArcs: boolean;
  detectedHole: { holeNumber: number; distanceYards: number } | null;
  dismissedAutoHole: number | null;
  onSelectHole: (holeNumber: number) => void;
  onSelectTee: (tee: TeeName) => void;
  onSelectSatelliteSource: (src: SatelliteSource) => void;
  onToggleArcs: () => void;
  onSwitchToLive: () => void;
  onSwitchToPreview: () => void;
  onResetPreviewToTee: () => void;
  onDismissAutoHole: (holeNumber: number) => void;
}

const TEE_ORDER: TeeName[] = ['black', 'blue', 'white', 'gold', 'forward'];

export const HoleSelectorBar: React.FC<HoleSelectorBarProps> = ({
  course,
  hole,
  selectedTee,
  gpsMode,
  gpsStatus,
  accuracyYards,
  wakeLockActive,
  satelliteSource,
  showArcs,
  detectedHole,
  dismissedAutoHole,
  onSelectHole,
  onSelectTee,
  onSelectSatelliteSource,
  onToggleArcs,
  onSwitchToLive,
  onSwitchToPreview,
  onResetPreviewToTee,
  onDismissAutoHole,
}) => {
  const [showHoleGrid, setShowHoleGrid] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const prevHole = hole.holeNumber === 1 ? 18 : hole.holeNumber - 1;
  const nextHole = hole.holeNumber === 18 ? 1 : hole.holeNumber + 1;
  const currentTeeMeta = course.teeInfo[selectedTee];
  const currentHoleYards = hole.yardages[selectedTee];

  const showAutoSwitchPrompt =
    gpsMode === 'live' &&
    detectedHole &&
    detectedHole.holeNumber !== hole.holeNumber &&
    detectedHole.distanceYards <= 90 &&
    dismissedAutoHole !== detectedHole.holeNumber;

  const statusDescription = (() => {
    if (gpsMode === 'live') {
      return accuracyYards !== null
        ? `Live on course (±${accuracyYards} yds)`
        : 'Live GPS active';
    }
    switch (gpsStatus) {
      case 'acquiring':
        return 'Acquiring GPS signal… (Preview active)';
      case 'off-course':
        return 'Off-course preview — drag YOU pin or tap map';
      case 'denied':
        return 'Location permission denied — using Preview mode';
      case 'unavailable':
        return 'GPS unavailable — using Preview mode';
      case 'active':
        return 'On course (manually paused in Preview)';
      default:
        return 'Preview mode';
    }
  })();

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 px-3 pt-[max(0.65rem,env(safe-area-inset-top))] pointer-events-none">
        <div className="max-w-3xl mx-auto flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-center justify-between gap-2 bg-[#143F27]/92 backdrop-blur-md border border-white/15 rounded-2xl px-2 py-1.5 shadow-2xl">
            {/* Prev / Hole Summary / Next */}
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={() => onSelectHole(prevHole)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-emerald-100 hover:bg-white/10 active:bg-white/20 transition-colors shrink-0"
                aria-label={`Previous hole (${prevHole})`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSettings(false);
                  setShowHoleGrid(true);
                }}
                className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors min-w-0 text-left"
              >
                <div className="flex items-baseline gap-1.5 shrink-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
                    Hole
                  </span>
                  <span className="font-mono text-xl font-extrabold text-white leading-none">
                    {hole.holeNumber}
                  </span>
                </div>
                <div className="h-5 w-px bg-white/15 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white leading-tight">
                    <span>Par {hole.par}</span>
                    <span className="text-white/40">·</span>
                    <span className="font-mono text-[#F4E4C1]">{currentHoleYards}y</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-200/75 leading-tight truncate">
                    <span
                      className="w-2 h-2 rounded-full border border-white/40 inline-block shrink-0"
                      style={{ backgroundColor: currentTeeMeta.color }}
                    />
                    <span>{currentTeeMeta.label}</span>
                    <span className="text-white/40">·</span>
                    <span>HCP {hole.handicap}</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-200/70 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => onSelectHole(nextHole)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-emerald-100 hover:bg-white/10 active:bg-white/20 transition-colors shrink-0"
                aria-label={`Next hole (${nextHole})`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Right: GPS status pill + Settings */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowHoleGrid(false);
                  setShowSettings((prev) => !prev);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold tracking-wide flex items-center gap-1.5 border transition-colors ${
                  gpsMode === 'live'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-[#F4E4C1]/15 border-[#F4E4C1]/40 text-[#F4E4C1]'
                }`}
                aria-label="GPS Status and Settings"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    gpsMode === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-[#D4AF37]'
                  }`}
                />
                {gpsMode === 'live' ? (
                  <span className="font-mono">
                    LIVE{accuracyYards !== null ? ` ±${accuracyYards}y` : ''}
                  </span>
                ) : (
                  <span>PREVIEW</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowHoleGrid(false);
                  setShowSettings((prev) => !prev);
                }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  showSettings
                    ? 'bg-[#2E8B57] text-white'
                    : 'text-emerald-100 hover:bg-white/10 active:bg-white/20'
                }`}
                aria-label="Course Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Auto-hole detection prompt */}
          {showAutoSwitchPrompt && detectedHole && (
            <div className="self-center flex items-center gap-2 bg-[#143F27]/95 backdrop-blur-md border border-[#D4AF37]/60 text-white px-3 py-1.5 rounded-full shadow-xl text-xs">
              <Navigation className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>
                Near <strong>Hole {detectedHole.holeNumber}</strong> ({detectedHole.distanceYards}y)
              </span>
              <button
                type="button"
                onClick={() => onSelectHole(detectedHole.holeNumber)}
                className="px-2 py-0.5 rounded-full bg-[#2E8B57] hover:bg-[#2E8B57]/90 font-bold text-white"
              >
                Switch
              </button>
              <button
                type="button"
                onClick={() => onDismissAutoHole(detectedHole.holeNumber)}
                className="text-white/60 hover:text-white p-0.5"
                aria-label="Dismiss hole switch prompt"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Settings Popover */}
          {showSettings && (
            <div className="self-end w-full max-w-sm bg-[#143F27]/96 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl text-white space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-emerald-300/80 font-bold">
                    The Shared Fairway GPS
                  </div>
                  <div className="font-serif text-base font-bold text-white">
                    {course.name}
                  </div>
                  <div className="text-xs text-emerald-100/70">{course.address}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 rounded-lg text-white/65 hover:text-white hover:bg-white/10"
                  aria-label="Close settings"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tee Selection */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-emerald-200/75 font-semibold mb-1.5">
                  Tee Box ({currentTeeMeta.rating} / {currentTeeMeta.slope})
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {TEE_ORDER.map((teeKey) => {
                    const meta = course.teeInfo[teeKey];
                    const active = selectedTee === teeKey;
                    return (
                      <button
                        key={teeKey}
                        type="button"
                        onClick={() => onSelectTee(teeKey)}
                        className={`px-1.5 py-1.5 rounded-xl border text-center transition-all ${
                          active
                            ? 'bg-[#2E8B57] border-[#D4AF37] text-white shadow'
                            : 'bg-white/5 border-white/10 text-emerald-100/85 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                          <span
                            className="w-2 h-2 rounded-full border border-white/40"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span>{meta.label}</span>
                        </div>
                        <div className="font-mono text-[10px] text-white/75 mt-0.5">
                          {meta.yards}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Satellite Source & Arcs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-emerald-200/75 font-semibold mb-1.5 flex items-center gap-1">
                    <Satellite className="w-3 h-3" /> Imagery
                  </div>
                  <div className="grid grid-cols-2 gap-1 bg-black/25 p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => onSelectSatelliteSource('esri')}
                      className={`py-1 rounded-lg text-xs font-semibold transition-colors ${
                        satelliteSource === 'esri'
                          ? 'bg-[#2E8B57] text-white'
                          : 'text-emerald-100/70 hover:text-white'
                      }`}
                    >
                      Esri
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectSatelliteSource('usgs')}
                      className={`py-1 rounded-lg text-xs font-semibold transition-colors ${
                        satelliteSource === 'usgs'
                          ? 'bg-[#2E8B57] text-white'
                          : 'text-emerald-100/70 hover:text-white'
                      }`}
                    >
                      USGS
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wider text-emerald-200/75 font-semibold mb-1.5">
                    Yardage Arcs
                  </div>
                  <button
                    type="button"
                    onClick={onToggleArcs}
                    className={`w-full py-1.5 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors ${
                      showArcs
                        ? 'bg-[#2E8B57]/70 border-emerald-400/50 text-white'
                        : 'bg-white/5 border-white/10 text-emerald-100/75'
                    }`}
                  >
                    <span>100 / 150 / 200</span>
                    <span className="font-mono text-[11px]">
                      {showArcs ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>

              {/* GPS Mode */}
              <div className="bg-black/20 border border-white/10 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-100">GPS Mode</span>
                  <span className="text-[11px] text-emerald-200/80">
                    {wakeLockActive ? 'Screen Awake ON' : ''}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-100/75">{statusDescription}</div>
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={onSwitchToLive}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      gpsMode === 'live'
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-white/5 border-white/15 text-emerald-100 hover:bg-white/10'
                    }`}
                  >
                    Live GPS
                  </button>
                  <button
                    type="button"
                    onClick={onSwitchToPreview}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      gpsMode === 'preview'
                        ? 'bg-[#D4AF37]/25 border-[#D4AF37] text-[#F4E4C1]'
                        : 'bg-white/5 border-white/15 text-emerald-100 hover:bg-white/10'
                    }`}
                  >
                    Preview Mode
                  </button>
                  {gpsMode === 'preview' && (
                    <button
                      type="button"
                      onClick={() => {
                        onResetPreviewToTee();
                        setShowSettings(false);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1"
                      title="Reset virtual golfer to tee"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Tee
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 18-Hole Quick-Jump Modal */}
      {showHoleGrid && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          onClick={() => setShowHoleGrid(false)}
        >
          <div
            className="w-full max-w-lg bg-[#143F27] border border-white/20 rounded-2xl p-4 shadow-2xl text-white max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-serif text-lg font-bold text-white">
                  {course.name}
                </h2>
                <p className="text-xs text-emerald-200/80">
                  Par {course.parTotal} · {currentTeeMeta.label} Tees ({currentTeeMeta.yards.toLocaleString()} yds · {currentTeeMeta.rating}/{currentTeeMeta.slope})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHoleGrid(false)}
                className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                aria-label="Close hole selector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {[
              { title: 'Front 9 · Out 36', slice: course.holes.slice(0, 9) },
              { title: 'Back 9 · In 36', slice: course.holes.slice(9, 18) },
            ].map((nine) => {
              const nineYards = nine.slice.reduce(
                (s, h) => s + h.yardages[selectedTee],
                0
              );
              return (
                <div key={nine.title} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-200/80 mb-1.5 px-1">
                    <span>{nine.title}</span>
                    <span className="font-mono">{nineYards.toLocaleString()} yds</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {nine.slice.map((h) => {
                      const active = h.holeNumber === hole.holeNumber;
                      return (
                        <button
                          key={h.holeNumber}
                          type="button"
                          onClick={() => {
                            onSelectHole(h.holeNumber);
                            setShowHoleGrid(false);
                          }}
                          className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between ${
                            active
                              ? 'bg-[#2E8B57] border-[#D4AF37] text-white shadow-md'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-emerald-50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm font-extrabold">
                                #{h.holeNumber}
                              </span>
                              <span className="text-[11px] text-emerald-200/80">
                                P{h.par}
                              </span>
                            </div>
                            <div className="font-mono text-[11px] text-[#F4E4C1]">
                              {h.yardages[selectedTee]}y · H{h.handicap}
                            </div>
                          </div>
                          {active && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
