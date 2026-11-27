import React from 'react';
import {
  ArrowRight,
  Check,
  ClipboardList,
  Flag,
  Minus,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { FairwayResult, HoleGpsData, HoleScoreEntry } from '../types';
import { computeGirAuto, formatToPar } from '../utils/scorecard';

interface ScoreEntrySheetProps {
  isOpen: boolean;
  hole: HoleGpsData;
  entry: HoleScoreEntry;
  strokesReceived: number | null;
  ndbMax: number;
  hasHandicap: boolean;
  runningToPar: number;
  holesPlayed: number;
  onUpdateEntry: (updater: (prev: HoleScoreEntry) => HoleScoreEntry) => void;
  onClearHole: () => void;
  onOpenScorecard: () => void;
  onNextOrFinish: () => void;
  onClose: () => void;
}

function getScoreBadgeClasses(gross: number | null, par: number): string {
  if (gross === null) {
    return 'bg-white/10 border-white/20 text-white/50';
  }
  const diff = gross - par;
  if (diff <= -2) {
    return 'bg-[#D4AF37]/30 border-[#D4AF37] text-[#F4E4C1] ring-2 ring-[#D4AF37]/50';
  }
  if (diff === -1) {
    return 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#F4E4C1]';
  }
  if (diff === 0) {
    return 'bg-[#2E8B57]/40 border-emerald-400/70 text-white';
  }
  if (diff === 1) {
    return 'bg-amber-500/20 border-amber-400/60 text-amber-200';
  }
  return 'bg-rose-500/20 border-rose-400/60 text-rose-200';
}

function getScoreLabel(gross: number | null, par: number): string {
  if (gross === null) return 'Tap to score';
  const diff = gross - par;
  if (diff <= -3) return 'Albatross';
  if (diff === -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double';
  return `+${diff}`;
}

export const ScoreEntrySheet: React.FC<ScoreEntrySheetProps> = ({
  isOpen,
  hole,
  entry,
  strokesReceived,
  ndbMax,
  hasHandicap,
  runningToPar,
  holesPlayed,
  onUpdateEntry,
  onClearHole,
  onOpenScorecard,
  onNextOrFinish,
  onClose,
}) => {
  if (!isOpen) return null;

  const setGross = (nextGross: number | null) => {
    const clamped = nextGross === null ? null : Math.max(1, Math.min(18, nextGross));
    onUpdateEntry((prev) => ({
      ...prev,
      gross: clamped,
      gir: prev.girManual
        ? prev.gir
        : computeGirAuto(hole.par, clamped, prev.putts),
    }));
  };

  const setPutts = (val: number) => {
    onUpdateEntry((prev) => {
      const nextPutts = prev.putts === val ? null : val;
      return {
        ...prev,
        putts: nextPutts,
        gir: prev.girManual
          ? prev.gir
          : computeGirAuto(hole.par, prev.gross, nextPutts),
      };
    });
  };

  const setFairway = (val: FairwayResult) => {
    onUpdateEntry((prev) => ({
      ...prev,
      fairway: prev.fairway === val ? null : val,
    }));
  };

  const setGirManual = (val: boolean) => {
    onUpdateEntry((prev) => {
      if (prev.girManual && prev.gir === val) {
        return {
          ...prev,
          girManual: false,
          gir: computeGirAuto(hole.par, prev.gross, prev.putts),
        };
      }
      return {
        ...prev,
        girManual: true,
        gir: val,
      };
    });
  };

  const isNdbCapped =
    hasHandicap && entry.gross !== null && entry.gross > ndbMax;

  const quickChips = [
    { label: 'Birdie', score: Math.max(1, hole.par - 1) },
    { label: 'Par', score: hole.par },
    { label: 'Bogey', score: hole.par + 1 },
    { label: 'Double', score: hole.par + 2 },
  ];

  const effectiveGir =
    entry.gir !== null
      ? entry.gir
      : computeGirAuto(hole.par, entry.gross, entry.putts);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#143F27]/98 border-t sm:border border-white/20 rounded-t-3xl sm:rounded-3xl sm:mb-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl text-white space-y-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-extrabold text-white">
                Hole {hole.holeNumber}
              </span>
              <span className="text-xs font-semibold text-emerald-200">
                Par {hole.par} · HCP {hole.handicap}
              </span>
              {holesPlayed > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] font-bold text-[#F4E4C1]">
                  Round {formatToPar(runningToPar)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-emerald-100/75">
              {strokesReceived !== null && strokesReceived > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#F4E4C1] font-semibold">
                  {'•'.repeat(strokesReceived)} {strokesReceived}{' '}
                  {strokesReceived === 1 ? 'stroke' : 'strokes'}
                </span>
              )}
              {strokesReceived !== null && strokesReceived < 0 && (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-emerald-200 font-semibold">
                  Plus Hcp ({strokesReceived})
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-black/25 border border-white/10 font-mono">
                NDB Max: {ndbMax}
                {!hasHandicap ? ' (Par+5)' : ''}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
            aria-label="Close score entry"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gross Score Stepper & 1-Tap Chips */}
        <div className="bg-black/25 border border-white/10 rounded-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setGross(
                  entry.gross === null ? Math.max(1, hole.par - 1) : entry.gross - 1
                )
              }
              className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white border border-white/15"
              aria-label="Decrease score"
            >
              <Minus className="w-6 h-6" />
            </button>

            <div className="flex flex-col items-center">
              <div
                className={`min-w-[74px] h-14 px-4 rounded-2xl border-2 flex items-center justify-center font-mono text-4xl font-extrabold transition-colors ${getScoreBadgeClasses(
                  entry.gross,
                  hole.par
                )}`}
              >
                {entry.gross ?? '—'}
              </div>
              <span className="text-[11px] font-semibold text-emerald-100/80 mt-1">
                {getScoreLabel(entry.gross, hole.par)}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setGross(entry.gross === null ? hole.par : entry.gross + 1)
              }
              className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white border border-white/15"
              aria-label="Increase score"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {quickChips.map((chip) => {
              const active = entry.gross === chip.score;
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setGross(chip.score)}
                  className={`py-1.5 rounded-xl border text-center transition-all ${
                    active
                      ? 'bg-[#2E8B57] border-[#D4AF37] text-white shadow'
                      : 'bg-white/5 border-white/10 text-emerald-100/85 hover:bg-white/10'
                  }`}
                >
                  <div className="text-[10px] font-semibold">{chip.label}</div>
                  <div className="font-mono text-xs font-bold">{chip.score}</div>
                </button>
              );
            })}
          </div>

          {isNdbCapped && (
            <div className="text-center text-[11px] font-semibold text-amber-200 bg-amber-500/15 border border-amber-400/35 rounded-xl py-1 px-2">
              GHIN NDB cap: {ndbMax} (Adjusted Gross for handicap)
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="space-y-2.5">
          {/* Putts & GIR Row */}
          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-7">
              <div className="text-[10px] uppercase tracking-wider text-emerald-200/75 font-semibold mb-1">
                Putts
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[0, 1, 2, 3, 4].map((p) => {
                  const active =
                    p === 4
                      ? entry.putts !== null && entry.putts >= 4
                      : entry.putts === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPutts(p)}
                      className={`py-1.5 rounded-xl border font-mono text-xs font-bold transition-colors ${
                        active
                          ? 'bg-[#2E8B57] border-[#D4AF37] text-white'
                          : 'bg-white/5 border-white/10 text-emerald-100/80 hover:bg-white/10'
                      }`}
                    >
                      {p === 4 ? '4+' : p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="col-span-5">
              <div className="text-[10px] uppercase tracking-wider text-emerald-200/75 font-semibold mb-1 flex items-center gap-1">
                <Flag className="w-3 h-3" /> GIR
              </div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { label: 'Yes', val: true },
                  { label: 'No', val: false },
                ].map((opt) => {
                  const active = effectiveGir === opt.val;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setGirManual(opt.val)}
                      className={`py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                        active
                          ? opt.val
                            ? 'bg-[#2E8B57] border-emerald-300 text-white'
                            : 'bg-rose-500/30 border-rose-400/60 text-rose-100'
                          : 'bg-white/5 border-white/10 text-emerald-100/80 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Fairway (Par 4/5) & Extras */}
          <div className="grid grid-cols-12 gap-2 items-end">
            {hole.par >= 4 ? (
              <div className="col-span-6">
                <div className="text-[10px] uppercase tracking-wider text-emerald-200/75 font-semibold mb-1">
                  Fairway
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      ['left', '← L'],
                      ['hit', '✓ Hit'],
                      ['right', 'R →'],
                    ] as const
                  ).map(([key, label]) => {
                    const active = entry.fairway === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFairway(key)}
                        className={`py-1.5 rounded-xl border text-[11px] font-bold transition-colors ${
                          active
                            ? key === 'hit'
                              ? 'bg-[#2E8B57] border-emerald-300 text-white'
                              : 'bg-amber-500/25 border-amber-400/60 text-amber-100'
                            : 'bg-white/5 border-white/10 text-emerald-100/80 hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="col-span-6 text-[11px] text-emerald-200/60 pb-2">
                Par 3 — FIR not tracked
              </div>
            )}

            <div className="col-span-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-200/75 font-semibold mb-1">
                Sand
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateEntry((prev) => ({ ...prev, sand: !prev.sand }))
                }
                className={`w-full py-1.5 rounded-xl border text-[11px] font-bold transition-colors ${
                  entry.sand
                    ? 'bg-[#F4E4C1]/25 border-[#F4E4C1] text-[#F4E4C1]'
                    : 'bg-white/5 border-white/10 text-emerald-100/80 hover:bg-white/10'
                }`}
              >
                {entry.sand ? '✓ Sand' : 'Sand'}
              </button>
            </div>

            <div className="col-span-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-200/75 font-semibold mb-1">
                Penalty
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateEntry((prev) => ({
                    ...prev,
                    penalties: prev.penalties >= 2 ? 0 : prev.penalties + 1,
                  }))
                }
                className={`w-full py-1.5 rounded-xl border font-mono text-[11px] font-bold transition-colors ${
                  entry.penalties > 0
                    ? 'bg-rose-500/25 border-rose-400/70 text-rose-100'
                    : 'bg-white/5 border-white/10 text-emerald-100/80 hover:bg-white/10'
                }`}
              >
                {entry.penalties > 0 ? `+${entry.penalties}` : '0'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClearHole}
            className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/75 flex items-center gap-1"
            title="Clear hole entry"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>

          <button
            type="button"
            onClick={onOpenScorecard}
            className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5"
          >
            <ClipboardList className="w-4 h-4 text-[#F4E4C1]" /> Card
          </button>

          <button
            type="button"
            onClick={onNextOrFinish}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#2E8B57] hover:bg-[#2E8B57]/90 border border-emerald-300/50 text-xs font-extrabold text-white flex items-center justify-center gap-1.5 shadow-lg"
          >
            {hole.holeNumber < 18 ? (
              <>
                <span>Next Hole</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-[#F4E4C1]" />
                <span>GHIN Summary</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
