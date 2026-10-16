import React from 'react';
import { Crown, Users, Award, Sparkles, CheckCircle2 } from 'lucide-react';
import { HoleCalculationResult, HoleState } from '../types';

interface FullLedgerTableProps {
  holes: HoleState[];
  results: HoleCalculationResult[];
  playerNames: string[];
  activeHoleNumber: number;
  onPlayerNameChange: (index: number, name: string) => void;
  onSelectHole: (holeNumber: number) => void;
  onUpdateHole: (holeNumber: number, updater: (prev: HoleState) => HoleState) => void;
}

export const FullLedgerTable: React.FC<FullLedgerTableProps> = ({
  holes,
  results,
  playerNames,
  activeHoleNumber,
  onPlayerNameChange,
  onSelectHole,
  onUpdateHole,
}) => {
  const renderHoleRow = (hole: HoleState, idx: number) => {
    const res = results[idx];
    const canGreenie = hole.par === 3 || hole.par === 5;
    const isCurrent = hole.holeNumber === activeHoleNumber;

    return (
      <tr
        key={hole.holeNumber}
        className={`border-b border-[#2E8B57]/15 transition-colors ${
          isCurrent
            ? 'bg-[#F4E4C1]/35'
            : idx % 2 === 0
            ? 'bg-white'
            : 'bg-[#E9F5EC]/35'
        }`}
      >
        {/* Sticky Left Column: Hole / Par / HDCP */}
        <td
          onClick={() => onSelectHole(hole.holeNumber)}
          className="sticky left-0 z-10 bg-inherit border-r border-[#2E8B57]/20 px-2.5 py-2 cursor-pointer select-none shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-serif font-bold text-sm text-[#143F27]">
              #{hole.holeNumber}
            </span>
            <select
              value={hole.par}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                onUpdateHole(hole.holeNumber, (prev) => ({
                  ...prev,
                  par: Number(e.target.value) as 3 | 4 | 5,
                }))
              }
              className="text-[11px] font-mono font-bold bg-[#E9F5EC] text-[#143F27] rounded px-1 py-0.5 border border-[#2E8B57]/30 focus:outline-none"
              title="Hole Par"
            >
              <option value={3}>P3</option>
              <option value={4}>P4</option>
              <option value={5}>P5</option>
            </select>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center justify-between">
            <span>HDCP {hole.handicap}</span>
            {res.status === 'push' && (
              <span className="text-[9px] bg-[#F4E4C1] text-amber-900 font-bold px-1 rounded">
                PUSH
              </span>
            )}
          </div>
        </td>

        {/* Base Bet & Effective Stake Cell */}
        <td className="border-r border-[#2E8B57]/15 px-2 py-2 text-center align-middle min-w-[92px]">
          <div className="flex items-center justify-center gap-1">
            <span className="text-xs font-mono text-slate-500">$</span>
            <input
              type="number"
              min={1}
              max={100}
              value={hole.baseBet}
              onChange={(e) => {
                const v = Math.max(1, parseInt(e.target.value || '2', 10));
                onUpdateHole(hole.holeNumber, (prev) => ({ ...prev, baseBet: v }));
              }}
              className="w-11 text-center font-mono font-bold text-xs border border-slate-300 rounded py-0.5 bg-white focus:border-[#2E8B57] focus:outline-none"
              title="Base Hole Bet ($)"
            />
            <button
              type="button"
              onClick={() =>
                onUpdateHole(hole.holeNumber, (prev) => ({
                  ...prev,
                  baseBet: prev.baseBet * 2,
                }))
              }
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F4E4C1] text-[#143F27] hover:bg-[#DFC690]"
              title="Double Base Bet"
            >
              2×
            </button>
          </div>
          <div className="text-[10px] font-mono mt-1 flex flex-wrap items-center justify-center gap-1">
            <span className="font-bold text-[#1E5E3A]">
              Val: ${res.effectiveHoleValue}
            </span>
            {res.carryInDollars > 0 && (
              <span className="bg-[#F4E4C1] text-amber-950 px-1 rounded font-bold">
                +${res.carryInDollars}C
              </span>
            )}
          </div>
        </td>

        {/* 5 Player Columns */}
        {[0, 1, 2, 3, 4].map((pIdx) => {
          const pState = hole.players[pIdx];
          const effectiveWolfIdx = res.effectiveWolfIndex;
          const isWolf = effectiveWolfIdx === pIdx;
          const isPartner = !hole.isLoneWolf && hole.partnerPlayerIndex === pIdx && !isWolf;
          const net = res.playerNetDollars[pIdx];
          const isBirdie = res.birdiePlayerIndices.includes(pIdx);

          return (
            <td
              key={pIdx}
              className={`border-r border-[#2E8B57]/15 px-2 py-1.5 min-w-[138px] align-middle ${
                isWolf
                  ? 'bg-[#2E8B57]/10'
                  : isPartner
                  ? 'bg-[#E9F5EC]/70'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                {/* Role Checkboxes: W (Wolf) and P (Partner) */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateHole(hole.holeNumber, (prev) => {
                        const alreadyManualWolf = prev.wolfPlayerIndex === pIdx;
                        return {
                          ...prev,
                          wolfPlayerIndex: alreadyManualWolf ? null : pIdx,
                          partnerPlayerIndex:
                            prev.partnerPlayerIndex === pIdx
                              ? null
                              : prev.partnerPlayerIndex,
                        };
                      })
                    }
                    className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center transition ${
                      isWolf
                        ? 'bg-[#143F27] text-[#F4E4C1] shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    title={
                      isWolf && res.isAutoAssignedWolf
                        ? 'Auto-Assigned Low-Money Wolf (Tap to override)'
                        : 'Designate Wolf'
                    }
                  >
                    W
                  </button>

                  <button
                    type="button"
                    disabled={isWolf || effectiveWolfIdx === null}
                    onClick={() =>
                      onUpdateHole(hole.holeNumber, (prev) => {
                        if (effectiveWolfIdx === pIdx) return prev;
                        const alreadyPartner =
                          !prev.isLoneWolf && prev.partnerPlayerIndex === pIdx;
                        return {
                          ...prev,
                          isLoneWolf: false,
                          partnerPlayerIndex: alreadyPartner ? null : pIdx,
                        };
                      })
                    }
                    className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 ${
                      isPartner
                        ? 'bg-[#2E8B57] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    title="Designate Wolf's Partner"
                  >
                    P
                  </button>
                </div>

                {/* Stroke Score Input */}
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={pState.score ?? ''}
                  placeholder="—"
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    onUpdateHole(hole.holeNumber, (prev) => {
                      const nextPlayers = [...prev.players];
                      nextPlayers[pIdx] = {
                        ...nextPlayers[pIdx],
                        score: val && !isNaN(val) ? val : null,
                      };
                      return { ...prev, players: nextPlayers };
                    });
                  }}
                  className={`w-11 h-7 text-center font-mono font-bold text-xs rounded border focus:outline-none ${
                    isBirdie
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-400'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-[#2E8B57]'
                  }`}
                  title="Gross Stroke Score"
                />

                {/* Hole Dollar Payout */}
                <span
                  className={`font-mono font-bold text-xs min-w-[34px] text-right ${
                    net > 0
                      ? 'text-emerald-700'
                      : net < 0
                      ? 'text-rose-600'
                      : 'text-slate-400'
                  }`}
                >
                  {net > 0 ? `+$${net}` : net < 0 ? `-$${Math.abs(net)}` : '$0'}
                </span>
              </div>

              {/* Bottom Sub-row: Birdie & Greenie Checkboxes/Badges */}
              <div className="flex items-center justify-between mt-1 text-[10px]">
                <div className="flex items-center gap-1">
                  {/* Birdie Indicator / Toggle */}
                  <span
                    className={`px-1.5 py-0.2 rounded font-semibold ${
                      isBirdie
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'text-slate-400'
                    }`}
                    title="Auto-detected Birdie or better (score < Par)"
                  >
                    B{isBirdie ? '✓' : ''}
                  </span>

                  {/* Greenie Checkbox on Par 3 and Par 5 */}
                  {canGreenie && (
                    <label className="inline-flex items-center gap-0.5 cursor-pointer select-none text-slate-600 hover:text-[#143F27]">
                      <input
                        type="checkbox"
                        checked={pState.greenie}
                        onChange={() =>
                          onUpdateHole(hole.holeNumber, (prev) => {
                            const nextPlayers = [...prev.players];
                            nextPlayers[pIdx] = {
                              ...nextPlayers[pIdx],
                              greenie: !nextPlayers[pIdx].greenie,
                            };
                            return { ...prev, players: nextPlayers };
                          })
                        }
                        className="rounded border-slate-300 text-[#2E8B57] focus:ring-[#2E8B57] w-3 h-3"
                      />
                      <span
                        className={
                          pState.greenie ? 'font-bold text-lime-700' : 'text-slate-500'
                        }
                      >
                        G
                      </span>
                    </label>
                  )}
                </div>

                <span className="font-mono text-[10px] text-slate-400">
                  Σ{' '}
                  {res.playerRunningTotals[pIdx] >= 0
                    ? `+$${res.playerRunningTotals[pIdx]}`
                    : `-$${Math.abs(res.playerRunningTotals[pIdx])}`}
                </span>
              </div>
            </td>
          );
        })}

        {/* Zero-Sum Balance Check Column */}
        <td className="px-2 py-2 text-center font-mono text-xs">
          {res.status === 'incomplete' ? (
            <span className="text-slate-400 text-[11px]">—</span>
          ) : res.isBalanced ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E9F5EC] text-[#1E5E3A] font-bold text-[11px]">
              <CheckCircle2 className="w-3 h-3" /> $0
            </span>
          ) : (
            <span className="text-rose-600 font-bold">ERR</span>
          )}
        </td>
      </tr>
    );
  };

  const renderSubtotalRow = (label: string, startIdx: number, endIdx: number) => {
    const sliceHoles = holes.slice(startIdx, endIdx);
    const sliceResults = results.slice(startIdx, endIdx);
    const parSum = sliceHoles.reduce((acc, h) => acc + h.par, 0);

    return (
      <tr className="bg-[#143F27] text-white font-mono text-xs font-bold border-y-2 border-[#2E8B57]">
        <td className="sticky left-0 z-10 bg-[#143F27] px-2.5 py-2.5 border-r border-white/15">
          <div>{label}</div>
          <div className="text-[10px] text-[#F4E4C1] font-normal">Par {parSum}</div>
        </td>
        <td className="px-2 py-2.5 text-center border-r border-white/15 text-[#F4E4C1]">
          Net / Strokes
        </td>
        {[0, 1, 2, 3, 4].map((pIdx) => {
          const dollarSum = sliceResults.reduce(
            (acc, r) => acc + r.playerNetDollars[pIdx],
            0
          );
          const strokeSum = sliceHoles.reduce(
            (acc, h) => acc + (h.players[pIdx].score ?? 0),
            0
          );
          return (
            <td key={pIdx} className="px-2.5 py-2.5 border-r border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/75">{strokeSum || '—'} str</span>
                <span
                  className={`text-sm ${
                    dollarSum > 0
                      ? 'text-emerald-300'
                      : dollarSum < 0
                      ? 'text-rose-300'
                      : 'text-[#F4E4C1]'
                  }`}
                >
                  {dollarSum > 0
                    ? `+$${dollarSum}`
                    : dollarSum < 0
                    ? `-$${Math.abs(dollarSum)}`
                    : '$0'}
                </span>
              </div>
            </td>
          );
        })}
        <td className="px-2 py-2.5 text-center text-[#F4E4C1]">$0</td>
      </tr>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#2E8B57]/25 overflow-hidden">
      <div className="px-4 py-3 bg-[#E9F5EC] border-b border-[#2E8B57]/20 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium text-[#143F27]">
          <span className="font-bold">Ledger Legend:</span> Tap <kbd className="px-1.5 py-0.5 bg-[#143F27] text-[#F4E4C1] rounded text-[10px] font-bold">W</kbd> for Wolf, <kbd className="px-1.5 py-0.5 bg-[#2E8B57] text-white rounded text-[10px] font-bold">P</kbd> for Partner (leave P blank for Lone Wolf 1v4). <kbd className="px-1 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">B✓</kbd> auto-triggers on Birdie; check <kbd className="px-1 py-0.5 bg-white border rounded text-[10px] font-bold">G</kbd> for Greenies on Par 3s & 5s.
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#143F27] text-white border-b border-[#2E8B57]">
              <th className="sticky left-0 z-20 bg-[#143F27] px-2.5 py-3 text-xs font-serif tracking-wide border-r border-white/15 min-w-[78px]">
                Hole
              </th>
              <th className="px-2 py-3 text-xs font-semibold text-center border-r border-white/15 min-w-[92px]">
                Bet / Stake
              </th>
              {[0, 1, 2, 3, 4].map((pIdx) => (
                <th
                  key={pIdx}
                  className="px-2 py-2.5 border-r border-white/15 min-w-[142px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#F4E4C1] text-[#143F27] font-mono text-[11px] font-extrabold flex items-center justify-center shrink-0">
                      {pIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={playerNames[pIdx]}
                      onChange={(e) => onPlayerNameChange(pIdx, e.target.value)}
                      placeholder="Player Name..."
                      className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder:text-white/50 text-xs font-bold px-2 py-1 rounded border border-white/20 focus:border-[#F4E4C1] focus:outline-none"
                    />
                  </div>
                </th>
              ))}
              <th className="px-2 py-3 text-xs font-semibold text-center min-w-[64px]">
                Audit
              </th>
            </tr>
          </thead>
          <tbody>
            {holes.slice(0, 9).map((h, i) => renderHoleRow(h, i))}
            {renderSubtotalRow('OUT (1-9)', 0, 9)}
            {holes.slice(9, 18).map((h, i) => renderHoleRow(h, i + 9))}
            {renderSubtotalRow('IN (10-18)', 9, 18)}
            {renderSubtotalRow('TOTAL (18)', 0, 18)}
          </tbody>
        </table>
      </div>
    </div>
  );
};
