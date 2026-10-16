import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Users,
  DollarSign,
  Award,
  Sparkles,
  CheckCircle2,
  Scale,
  RotateCcw,
} from 'lucide-react';
import { HoleCalculationResult, HoleState } from '../types';

interface HoleCaddieCardProps {
  hole: HoleState;
  result: HoleCalculationResult;
  playerNames: string[];
  onPlayerNameChange: (index: number, name: string) => void;
  onSelectHole: (holeNumber: number) => void;
  onUpdateHole: (updater: (prev: HoleState) => HoleState) => void;
  allResults: HoleCalculationResult[];
}

export const HoleCaddieCard: React.FC<HoleCaddieCardProps> = ({
  hole,
  result,
  playerNames,
  onPlayerNameChange,
  onSelectHole,
  onUpdateHole,
  allResults,
}) => {
  const canGreenie = hole.par === 3 || hole.par === 5;
  const effectiveWolfIdx = result.effectiveWolfIndex;
  const latestTotals =
    allResults.length === 18 ? allResults[17].playerRunningTotals : [0, 0, 0, 0, 0];

  const handleSetWolf = (playerIdx: number) => {
    onUpdateHole((prev) => {
      const isCurrentlyManualWolf = prev.wolfPlayerIndex === playerIdx;
      if (isCurrentlyManualWolf) {
        return { ...prev, wolfPlayerIndex: null, partnerPlayerIndex: null, isLoneWolf: false };
      }
      const nextPartner =
        prev.partnerPlayerIndex === playerIdx ? null : prev.partnerPlayerIndex;
      return {
        ...prev,
        wolfPlayerIndex: playerIdx,
        partnerPlayerIndex: nextPartner,
      };
    });
  };

  const handleSetPartner = (playerIdx: number) => {
    onUpdateHole((prev) => {
      if (effectiveWolfIdx === playerIdx) return prev;
      const isAlreadyPartner = !prev.isLoneWolf && prev.partnerPlayerIndex === playerIdx;
      return {
        ...prev,
        isLoneWolf: false,
        partnerPlayerIndex: isAlreadyPartner ? null : playerIdx,
      };
    });
  };

  const handleToggleLoneWolf = () => {
    onUpdateHole((prev) => ({
      ...prev,
      isLoneWolf: !prev.isLoneWolf,
      partnerPlayerIndex: !prev.isLoneWolf ? null : prev.partnerPlayerIndex,
    }));
  };

  const handleSetScore = (playerIdx: number, score: number | null) => {
    onUpdateHole((prev) => {
      const nextPlayers = [...prev.players];
      nextPlayers[playerIdx] = {
        ...nextPlayers[playerIdx],
        score: nextPlayers[playerIdx].score === score ? null : score,
      };
      return { ...prev, players: nextPlayers };
    });
  };

  const handleToggleGreenie = (playerIdx: number) => {
    onUpdateHole((prev) => {
      const nextPlayers = [...prev.players];
      nextPlayers[playerIdx] = {
        ...nextPlayers[playerIdx],
        greenie: !nextPlayers[playerIdx].greenie,
      };
      return { ...prev, players: nextPlayers };
    });
  };

  const handleBaseBetChange = (newBet: number) => {
    onUpdateHole((prev) => ({
      ...prev,
      baseBet: Math.max(1, newBet),
    }));
  };

  const handleParChange = (newPar: 3 | 4 | 5) => {
    onUpdateHole((prev) => ({
      ...prev,
      par: newPar,
    }));
  };

  const quickScoreOptions = [
    hole.par - 2,
    hole.par - 1,
    hole.par,
    hole.par + 1,
    hole.par + 2,
    hole.par + 3,
  ].filter((s) => s >= 1);

  return (
    <div className="space-y-4">
      {/* Hole Navigation Pill Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#2E8B57]/20 p-3">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <button
            type="button"
            onClick={() => onSelectHole(Math.max(1, hole.holeNumber - 1))}
            disabled={hole.holeNumber === 1}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#E9F5EC] text-[#1E5E3A] font-semibold text-sm disabled:opacity-40 active:scale-95 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="font-serif font-bold text-xl text-[#143F27]">
                Hole {hole.holeNumber}
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-[#F4E4C1] text-[#143F27]">
                HDCP {hole.handicap}
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              {([3, 4, 5] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleParChange(p)}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition ${
                    hole.par === p
                      ? 'bg-[#2E8B57] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Par {p}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectHole(Math.min(18, hole.holeNumber + 1))}
            disabled={hole.holeNumber === 18}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#2E8B57] text-white font-semibold text-sm disabled:opacity-40 active:scale-95 transition"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mini 1-18 Scrubber */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {allResults.map((r) => {
            const isCurrent = r.holeNumber === hole.holeNumber;
            const hasResult = r.status !== 'incomplete';
            return (
              <button
                key={r.holeNumber}
                type="button"
                onClick={() => onSelectHole(r.holeNumber)}
                className={`min-w-[32px] h-8 rounded-lg font-mono text-xs font-bold flex flex-col items-center justify-center transition shrink-0 ${
                  isCurrent
                    ? 'bg-[#143F27] text-white ring-2 ring-[#2E8B57] ring-offset-1'
                    : r.status === 'push'
                    ? 'bg-[#F4E4C1] text-amber-900 border border-amber-300'
                    : hasResult
                    ? 'bg-[#E9F5EC] text-[#1E5E3A] border border-[#2E8B57]/30'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span>{r.holeNumber}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hole Stakes & Live Pot Banner */}
      <div className="bg-gradient-to-r from-[#143F27] to-[#2E8B57] text-white rounded-2xl p-4 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#E9F5EC]/80 font-semibold">
              Effective Hole Stake
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-mono font-extrabold text-[#F4E4C1]">
                ${result.effectiveHoleValue}
              </span>
              <span className="text-xs text-[#E9F5EC]/90">
                per losing player
                {result.totalPot > 0 ? ` • Total Pot: $${result.totalPot}` : ''}
              </span>
            </div>
            {/* Breakdown pills */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] bg-white/15 px-2 py-0.5 rounded-full font-mono">
                Base: ${hole.baseBet}
              </span>
              {result.carryInDollars > 0 && (
                <span className="text-[11px] bg-[#F4E4C1] text-[#143F27] font-bold px-2 py-0.5 rounded-full font-mono">
                  +${result.carryInDollars} Carry-Over
                </span>
              )}
              {result.birdieBonusDollars > 0 && (
                <span className="text-[11px] bg-emerald-300 text-[#143F27] font-bold px-2 py-0.5 rounded-full font-mono">
                  +$1 Birdie Bonus
                </span>
              )}
              {result.greenieBonusDollars > 0 && (
                <span className="text-[11px] bg-lime-300 text-[#143F27] font-bold px-2 py-0.5 rounded-full font-mono">
                  +$1 Greenie Bonus
                </span>
              )}
            </div>
          </div>

          {/* Base Bet & Double Controls */}
          <div className="flex items-center gap-1.5 bg-black/20 p-1.5 rounded-xl">
            <button
              type="button"
              onClick={() => handleBaseBetChange(hole.baseBet - 1)}
              className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 font-mono font-bold text-sm flex items-center justify-center active:scale-95"
              title="Decrease Base Bet"
            >
              -
            </button>
            <div className="px-2 text-center">
              <div className="text-[10px] uppercase opacity-75">Base</div>
              <div className="font-mono font-bold text-sm">${hole.baseBet}</div>
            </div>
            <button
              type="button"
              onClick={() => handleBaseBetChange(hole.baseBet + 1)}
              className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 font-mono font-bold text-sm flex items-center justify-center active:scale-95"
              title="Increase Base Bet"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => handleBaseBetChange(hole.baseBet * 2)}
              className="px-2.5 py-1.5 rounded-lg bg-[#F4E4C1] text-[#143F27] font-bold text-xs hover:bg-[#DFC690] active:scale-95 transition"
              title="Double Base Bet"
            >
              2× Press
            </button>
            {hole.baseBet !== 2 && (
              <button
                type="button"
                onClick={() => handleBaseBetChange(2)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
                title="Reset to $2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Live Matchup Status Bar */}
        <div className="mt-3 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {result.status === 'incomplete' && (
              <span className="text-[#F4E4C1] font-medium">
                Select Wolf & enter at least 1 score per side to calculate payouts
              </span>
            )}
            {result.status === 'wolf_win' && (
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                Wolf Team Wins ({result.wolfTeamBestScore} vs {result.nonWolfTeamBestScore})
              </span>
            )}
            {result.status === 'non_wolf_win' && (
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-200">
                <CheckCircle2 className="w-4 h-4" />
                Pack (Non-Wolf) Wins ({result.nonWolfTeamBestScore} vs {result.wolfTeamBestScore})
              </span>
            )}
            {result.status === 'push' && (
              <span className="inline-flex items-center gap-1.5 font-bold text-[#F4E4C1]">
                Push ({result.wolfTeamBestScore} tied {result.nonWolfTeamBestScore}) — +$1 Carries to Hole{' '}
                {Math.min(18, hole.holeNumber + 1)}!
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] bg-white/10 px-2.5 py-1 rounded-full">
            <Scale className="w-3.5 h-3.5 text-[#F4E4C1]" />
            <span>Ledger Balanced ($0 Net)</span>
          </div>
        </div>
      </div>

      {/* Holes 16-18 Low-Money Auto-Wolf Banner & Lone Wolf Quick Toggle */}
      {effectiveWolfIdx !== null ? (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F4E4C1]/60 border border-[#DFC690] rounded-xl px-3.5 py-2.5">
          <div className="text-xs font-medium text-slate-800">
            {hole.holeNumber >= 16 && result.isAutoAssignedWolf && (
              <span className="inline-block mr-1.5 px-2 py-0.5 rounded bg-[#143F27] text-[#F4E4C1] font-mono text-[10px] font-bold uppercase tracking-wide">
                Auto Low-Money Wolf (Hole {hole.holeNumber})
              </span>
            )}
            <span className="font-bold text-[#143F27]">
              {playerNames[effectiveWolfIdx]?.trim() ||
                `Player ${effectiveWolfIdx + 1}`}
            </span>{' '}
            is the Wolf on Hole {hole.holeNumber}.{' '}
            {hole.isLoneWolf || hole.partnerPlayerIndex === null ? (
              <span className="font-semibold text-amber-900">
                Currently 1 vs 4 (Lone Wolf — $4V pot)
              </span>
            ) : (
              <span className="font-semibold text-[#1E5E3A]">
                Partnered with{' '}
                {playerNames[hole.partnerPlayerIndex]?.trim() ||
                  `Player ${hole.partnerPlayerIndex + 1}`}{' '}
                (2 vs 3 — $3V pot, Wolf gets odd $)
              </span>
            )}
            {hole.holeNumber >= 16 && result.tiedForLowMoneyIndices.length > 1 && (
              <div className="text-[11px] text-amber-900 mt-1">
                Note: Tied for lowest money entering Hole {hole.holeNumber} (
                {result.tiedForLowMoneyIndices
                  .map((idx) => playerNames[idx]?.trim() || `Player ${idx + 1}`)
                  .join(' & ')}
                ). Tap "Wolf" on another tied player if they won the tiebreaker.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleToggleLoneWolf}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
              hole.isLoneWolf || hole.partnerPlayerIndex === null
                ? 'bg-[#143F27] text-[#F4E4C1] shadow-sm'
                : 'bg-white text-slate-700 border border-slate-300'
            }`}
          >
            {hole.isLoneWolf || hole.partnerPlayerIndex === null
              ? '🐺 Lone Wolf Active'
              : 'Go Lone Wolf'}
          </button>
        </div>
      ) : (
        hole.holeNumber >= 16 && (
          <div className="bg-[#F4E4C1]/60 border border-[#DFC690] rounded-xl px-3.5 py-2.5 text-xs text-amber-950 font-medium">
            🐺 <strong>Hole {hole.holeNumber} Low-Money Wolf Rule:</strong> Whoever is
            losing the most money entering Hole {hole.holeNumber} will automatically
            become the Wolf as soon as prior holes are scored (or tap <strong>Wolf</strong>{' '}
            below to assign manually).
          </div>
        )
      )}

      {/* 5 Player Cards */}
      <div className="space-y-2.5">
        {[0, 1, 2, 3, 4].map((pIdx) => {
          const pState = hole.players[pIdx];
          const isWolf = effectiveWolfIdx === pIdx;
          const isPartner = !hole.isLoneWolf && hole.partnerPlayerIndex === pIdx && !isWolf;
          const isOnWolfTeam = isWolf || isPartner;
          const holeNet = result.playerNetDollars[pIdx];
          const runningTotal = latestTotals[pIdx];
          const isBirdie = result.birdiePlayerIndices.includes(pIdx);
          const isEagle = result.eaglePlayerIndices.includes(pIdx);

          return (
            <div
              key={pIdx}
              className={`rounded-2xl border transition-all p-3.5 bg-white shadow-sm ${
                isWolf
                  ? 'border-[#2E8B57] ring-2 ring-[#2E8B57]/20 bg-[#E9F5EC]/30'
                  : isPartner
                  ? 'border-[#2E8B57]/60 bg-[#E9F5EC]/15'
                  : 'border-slate-200'
              }`}
            >
              {/* Top Row: Player Name Input + Team Role Buttons + Hole Payout */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-[#143F27] text-[#F4E4C1] font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    {pIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={playerNames[pIdx]}
                    onChange={(e) => onPlayerNameChange(pIdx, e.target.value)}
                    placeholder={`Enter Player ${pIdx + 1} Name...`}
                    className="w-full min-w-0 bg-transparent border-b border-dashed border-slate-300 focus:border-[#2E8B57] focus:outline-none font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal text-sm py-0.5"
                  />
                </div>

                {/* Role Toggles: Wolf or Partner */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSetWolf(pIdx)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition active:scale-95 ${
                      isWolf
                        ? 'bg-[#143F27] text-[#F4E4C1] shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    {isWolf && result.isAutoAssignedWolf ? 'Auto Wolf' : 'Wolf'}
                  </button>

                  {!isWolf && effectiveWolfIdx !== null && (
                    <button
                      type="button"
                      onClick={() => handleSetPartner(pIdx)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition active:scale-95 ${
                        isPartner
                          ? 'bg-[#2E8B57] text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      Partner
                    </button>
                  )}
                </div>

                {/* Live Hole Net & Running Total */}
                <div className="text-right shrink-0 min-w-[74px]">
                  <div
                    className={`font-mono font-extrabold text-base leading-tight ${
                      holeNet > 0
                        ? 'text-emerald-700'
                        : holeNet < 0
                        ? 'text-rose-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {holeNet > 0 ? `+$${holeNet}` : holeNet < 0 ? `-$${Math.abs(holeNet)}` : '$0'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    Tot:{' '}
                    <span
                      className={
                        runningTotal > 0
                          ? 'text-emerald-700 font-bold'
                          : runningTotal < 0
                          ? 'text-rose-600 font-bold'
                          : 'font-semibold'
                      }
                    >
                      {runningTotal > 0
                        ? `+$${runningTotal}`
                        : runningTotal < 0
                        ? `-$${Math.abs(runningTotal)}`
                        : '$0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Tap Score Buttons + Greenie / Birdie Indicators */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {quickScoreOptions.map((scoreOpt) => {
                    const isSelected = pState.score === scoreOpt;
                    const diff = scoreOpt - hole.par;
                    return (
                      <button
                        key={scoreOpt}
                        type="button"
                        onClick={() => handleSetScore(pIdx, scoreOpt)}
                        className={`w-10 h-10 rounded-xl font-mono font-bold text-sm flex flex-col items-center justify-center transition active:scale-95 ${
                          isSelected
                            ? diff < 0
                              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600 ring-offset-1'
                              : diff === 0
                              ? 'bg-[#143F27] text-white shadow-sm ring-2 ring-[#143F27] ring-offset-1'
                              : 'bg-amber-700 text-white shadow-sm ring-2 ring-amber-700 ring-offset-1'
                            : 'bg-[#E9F5EC]/70 text-slate-800 hover:bg-[#E9F5EC] border border-[#2E8B57]/20'
                        }`}
                      >
                        <span>{scoreOpt}</span>
                        <span className="text-[9px] leading-none opacity-75">
                          {diff === -2
                            ? 'EAG'
                            : diff === -1
                            ? 'BRD'
                            : diff === 0
                            ? 'PAR'
                            : `+${diff}`}
                        </span>
                      </button>
                    );
                  })}

                  {/* Direct custom score input for high numbers */}
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={pState.score ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
                      onUpdateHole((prev) => {
                        const nextPlayers = [...prev.players];
                        nextPlayers[pIdx] = {
                          ...nextPlayers[pIdx],
                          score: val && !isNaN(val) ? val : null,
                        };
                        return { ...prev, players: nextPlayers };
                      });
                    }}
                    placeholder="#"
                    className="w-11 h-10 rounded-xl border border-slate-200 text-center font-mono font-bold text-sm focus:border-[#2E8B57] focus:outline-none bg-slate-50"
                    title="Custom Stroke Score"
                  />
                </div>

                {/* Badges & Par 3/5 Greenie Toggle */}
                <div className="flex items-center gap-1.5">
                  {isBirdie && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      {isEagle ? 'Eagle!' : 'Birdie'} (+$1)
                    </span>
                  )}

                  {canGreenie && (
                    <button
                      type="button"
                      onClick={() => handleToggleGreenie(pIdx)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition active:scale-95 border ${
                        pState.greenie
                          ? 'bg-lime-600 text-white border-lime-700 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                      title="Greenie (Par 3 / Par 5 GIR + Par)"
                    >
                      <Award className="w-3.5 h-3.5" />
                      Greenie
                    </button>
                  )}

                  {effectiveWolfIdx !== null && (
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
                        isOnWolfTeam
                          ? 'bg-[#E9F5EC] text-[#1E5E3A]'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isWolf ? 'Wolf' : isPartner ? 'Team Wolf' : 'Pack'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
