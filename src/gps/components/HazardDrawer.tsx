import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Droplets,
  Plus,
  Waves,
} from 'lucide-react';
import { HazardDistanceResult } from '../types';

interface HazardDrawerProps {
  holeNumber: number;
  hazards: HazardDistanceResult[];
  selectedHazardId: string | null;
  currentHoleScore: number | null;
  currentHolePar: number;
  runningToPar: string | null;
  holesPlayed: number;
  onSelectHazard: (id: string | null) => void;
  onOpenScoreEntry: () => void;
  onOpenScorecard: () => void;
}

export const HazardDrawer: React.FC<HazardDrawerProps> = ({
  holeNumber,
  hazards,
  selectedHazardId,
  currentHoleScore,
  currentHolePar,
  runningToPar,
  holesPlayed,
  onSelectHazard,
  onOpenScoreEntry,
  onOpenScorecard,
}) => {
  const [expanded, setExpanded] = useState(true);

  const aheadCount = hazards.filter((h) => h.isAhead).length;
  const passedCount = hazards.filter((h) => h.isPassed).length;

  const isUnderPar =
    currentHoleScore !== null && currentHoleScore < currentHolePar;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto">
        {/* Drawer Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#143F27]/92 backdrop-blur-md border border-white/15 text-white text-xs font-semibold shadow-lg shrink-0"
          >
            <span>
              Hazards:{' '}
              <strong className="font-mono text-[#F4E4C1]">{aheadCount}</strong>{' '}
              ahead
              {passedCount > 0 ? (
                <span className="text-white/60"> · {passedCount} behind</span>
              ) : null}
            </span>
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-emerald-200" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-emerald-200" />
            )}
          </button>

          {/* Score + Scorecard Pill Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenScoreEntry}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full backdrop-blur-md border text-xs font-bold shadow-lg transition-colors ${
                currentHoleScore !== null
                  ? isUnderPar
                    ? 'bg-[#D4AF37]/25 border-[#D4AF37] text-[#F4E4C1]'
                    : 'bg-[#2E8B57]/90 border-emerald-300/60 text-white'
                  : 'bg-[#143F27]/92 border-[#D4AF37]/60 text-[#F4E4C1] hover:bg-[#1E5E3A]'
              }`}
              aria-label={`Enter score for Hole ${holeNumber}`}
            >
              {currentHoleScore !== null ? (
                <span className="font-mono">
                  Score: {currentHoleScore}
                  {runningToPar ? ` · ${runningToPar}` : ''}
                </span>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span className="font-mono">
                    Score{holesPlayed > 0 && runningToPar ? ` · ${runningToPar}` : ''}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenScorecard}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#143F27]/92 backdrop-blur-md border border-white/20 text-white hover:bg-[#1E5E3A] text-xs font-bold shadow-lg transition-colors"
              aria-label="Open full scorecard"
            >
              <ClipboardList className="w-3.5 h-3.5 text-[#F4E4C1]" />
              <span>Card</span>
            </button>
          </div>
        </div>

        {/* Horizontal Hazard Cards */}
        {expanded && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {hazards.length === 0 ? (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#143F27]/88 backdrop-blur-md border border-white/15 text-xs text-emerald-100/80 shadow-lg">
                No bunkers or water hazards mapped on Hole {holeNumber} · Tap map to measure layups
              </div>
            ) : (
              hazards.map((item) => {
                const isSelected = selectedHazardId === item.hazard.id;
                const isWater = item.hazard.type === 'water';
                const isCreek = item.hazard.type === 'creek';

                return (
                  <button
                    key={item.hazard.id}
                    type="button"
                    onClick={() =>
                      onSelectHazard(isSelected ? null : item.hazard.id)
                    }
                    className={`shrink-0 min-w-[146px] rounded-xl px-3 py-2 border text-left backdrop-blur-md transition-all shadow-lg ${
                      isSelected
                        ? 'bg-[#143F27]/96 border-[#D4AF37] ring-2 ring-[#D4AF37]/80'
                        : 'bg-[#143F27]/88 border-white/15 hover:border-white/35'
                    } ${item.isPassed && !isSelected ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isCreek ? (
                          <Waves className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                        ) : isWater ? (
                          <Droplets className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-sm bg-[#F4E4C1] border border-[#D4AF37] shrink-0" />
                        )}
                        <span className="text-[11px] font-semibold text-white truncate">
                          {item.hazard.label}
                        </span>
                      </div>
                      {item.isPassed && (
                        <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-white/10 text-white/70 shrink-0">
                          Past
                        </span>
                      )}
                    </div>

                    {item.isCrossing ? (
                      <div className="font-mono text-xs font-bold text-sky-300">
                        Cross {item.frontYards}y
                      </div>
                    ) : (
                      <div className="font-mono text-xs font-bold flex items-center gap-2">
                        <span className="text-emerald-200">
                          F {item.frontYards}y
                        </span>
                        <span className="text-white/30">·</span>
                        <span className="text-[#F4E4C1]">
                          C {item.carryYards}y
                        </span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
