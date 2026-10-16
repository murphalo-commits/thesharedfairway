import React, { useRef, useState } from 'react';
import {
  Trophy,
  History,
  ArrowRightLeft,
  Download,
  Upload,
  Trash2,
  Save,
  Swords,
  Crown,
  Sparkles,
  Award,
  CheckCircle2,
  Calendar,
  MapPin,
} from 'lucide-react';
import { HoleCalculationResult, HoleState, SavedRound } from '../types';
import { calculateMinimumSettlements } from '../utils/wolfEngine';
import { computeSeasonAnalytics } from '../utils/storage';

interface SeasonHistoryModalProps {
  currentCourseName: string;
  currentPlayerNames: string[];
  currentHoles: HoleState[];
  currentResults: HoleCalculationResult[];
  savedRounds: SavedRound[];
  onSaveCurrentRound: (notes?: string) => Promise<void>;
  onDeleteRound: (roundId: string) => Promise<void>;
  onImportRounds: (rounds: SavedRound[]) => Promise<void>;
}

export const SeasonHistoryView: React.FC<SeasonHistoryModalProps> = ({
  currentCourseName,
  currentPlayerNames,
  currentHoles,
  currentResults,
  savedRounds,
  onSaveCurrentRound,
  onDeleteRound,
  onImportRounds,
}) => {
  const [roundNotes, setRoundNotes] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const finalTotals =
    currentResults.length === 18
      ? currentResults[17].playerRunningTotals
      : [0, 0, 0, 0, 0];

  const completedHolesCount = currentResults.filter(
    (r) => r.status !== 'incomplete'
  ).length;

  const settlements = calculateMinimumSettlements(currentPlayerNames, finalTotals);
  const { playerStats, headToHead } = computeSeasonAnalytics(savedRounds);

  const handleSaveClick = async () => {
    await onSaveCurrentRound(roundNotes);
    setRoundNotes('');
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(savedRounds, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-shared-wolf-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (Array.isArray(parsed)) {
          await onImportRounds(parsed);
        }
      } catch (err) {
        alert('Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Current Round Settlement & Save to Database Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#2E8B57]/25 overflow-hidden">
        <div className="bg-gradient-to-r from-[#143F27] to-[#2E8B57] text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif font-bold text-lg flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[#F4E4C1]" />
              Current Round Payouts & Settlement
            </h2>
            <p className="text-xs text-[#E9F5EC]/85 mt-0.5">
              {currentCourseName} • {completedHolesCount} of 18 holes scored
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveClick}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F4E4C1] text-[#143F27] font-bold text-xs hover:bg-[#DFC690] active:scale-95 transition shadow-sm"
          >
            {justSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                Saved to Season Database!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Round to Season History
              </>
            )}
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Net Standing per Player */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Current Round Ledger
            </h3>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((idx) => {
                const name = currentPlayerNames[idx]?.trim() || `Player ${idx + 1}`;
                const net = finalTotals[idx];
                const strokes = currentHoles.reduce(
                  (acc, h) => acc + (h.players[idx].score ?? 0),
                  0
                );
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#E9F5EC]/50 border border-[#2E8B57]/15"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#143F27] text-[#F4E4C1] font-mono text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm text-slate-900">{name}</span>
                      {strokes > 0 && (
                        <span className="text-xs font-mono text-slate-500">
                          ({strokes} strokes)
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono font-extrabold text-sm ${
                        net > 0
                          ? 'text-emerald-700'
                          : net < 0
                          ? 'text-rose-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {net > 0 ? `+$${net}` : net < 0 ? `-$${Math.abs(net)}` : '$0'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3">
              <input
                type="text"
                value={roundNotes}
                onChange={(e) => setRoundNotes(e.target.value)}
                placeholder="Optional round note (e.g., 'Windy Saturday skin game')..."
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-[#2E8B57] focus:outline-none"
              />
            </div>
          </div>

          {/* Right: Who Owes Who (Minimum Transfers) */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Simplified Settlement (Who Pays Who)
            </h3>
            {settlements.length === 0 ? (
              <div className="h-40 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400 p-4 text-center">
                All players are currently even ($0) or no holes have been completed yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {settlements.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#F4E4C1]/40 border border-[#DFC690]"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-rose-700">{t.fromPlayer}</span>
                      <span className="text-xs text-slate-500 uppercase font-semibold px-1.5 py-0.5 bg-white rounded">
                        pays
                      </span>
                      <span className="font-bold text-emerald-800">{t.toPlayer}</span>
                    </div>
                    <span className="font-mono font-extrabold text-base text-[#143F27] bg-white px-3 py-1 rounded-lg border border-[#DFC690]">
                      ${t.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Season All-Time Leaderboard */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#2E8B57]/25 overflow-hidden">
        <div className="px-5 py-4 bg-[#E9F5EC] border-b border-[#2E8B57]/20 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif font-bold text-lg text-[#143F27] flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#2E8B57]" />
              All-Time Season Wolf Standings
            </h2>
            <p className="text-xs text-slate-600">
              Aggregated across {savedRounds.length} saved{' '}
              {savedRounds.length === 1 ? 'round' : 'rounds'} in your local database
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJSON}
              disabled={savedRounds.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Export Backup
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {playerStats.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No historical rounds saved yet. Tap{' '}
            <span className="font-bold text-[#143F27]">
              "Save Round to Season History"
            </span>{' '}
            above when you finish a round to track career Wolf winnings, Lone Wolf records,
            and head-to-head rivalries!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#143F27] text-white text-xs">
                  <th className="py-3 px-4 font-semibold">Player</th>
                  <th className="py-3 px-3 font-semibold text-center">Rounds</th>
                  <th className="py-3 px-3 font-semibold text-right">Total Net $</th>
                  <th className="py-3 px-3 font-semibold text-center">Best / Worst</th>
                  <th className="py-3 px-3 font-semibold text-center">
                    <span className="inline-flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-[#F4E4C1]" /> Wolf Win %
                    </span>
                  </th>
                  <th className="py-3 px-3 font-semibold text-center">🐺 Lone Wolf</th>
                  <th className="py-3 px-3 font-semibold text-center">Birdies / Greenies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {playerStats.map((ps, idx) => {
                  const wolfWinPct =
                    ps.timesAsWolf > 0
                      ? Math.round((ps.wolfWins / ps.timesAsWolf) * 100)
                      : 0;
                  return (
                    <tr
                      key={ps.name}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-[#E9F5EC]/30'}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#E9F5EC] text-[#143F27] font-mono text-[11px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        {ps.name}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {ps.roundsPlayed} ({ps.holesPlayed}h)
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono font-extrabold text-sm ${
                          ps.totalNetDollars > 0
                            ? 'text-emerald-700'
                            : ps.totalNetDollars < 0
                            ? 'text-rose-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {ps.totalNetDollars > 0
                          ? `+$${ps.totalNetDollars}`
                          : ps.totalNetDollars < 0
                          ? `-$${Math.abs(ps.totalNetDollars)}`
                          : '$0'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="text-emerald-700 font-semibold">
                          +${ Math.max(0, ps.bestRoundDollars) }
                        </span>{' '}
                        /{' '}
                        <span className="text-rose-600 font-semibold">
                          {ps.worstRoundDollars < 0
                            ? `-$${Math.abs(ps.worstRoundDollars)}`
                            : `$${ps.worstRoundDollars}`}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-[#143F27]">{wolfWinPct}%</span>{' '}
                        <span className="text-slate-400">
                          ({ps.wolfWins}/{ps.timesAsWolf})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold">{ps.loneWolfWins}W</span> /{' '}
                        {ps.timesAsLoneWolf} att
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="text-emerald-700 font-bold">{ps.birdies} B</span> •{' '}
                        <span className="text-lime-700 font-bold">{ps.greenies} G</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Head-to-Head Partnership & Rivalry Matrix */}
      {headToHead.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#2E8B57]/25 overflow-hidden">
          <div className="px-5 py-4 bg-[#E9F5EC] border-b border-[#2E8B57]/20">
            <h2 className="font-serif font-bold text-lg text-[#143F27] flex items-center gap-2">
              <Swords className="w-5 h-5 text-[#2E8B57]" />
              Head-to-Head Partnerships & Rivalries
            </h2>
            <p className="text-xs text-slate-600">
              How each pair performs when teamed up as Wolf + Partner vs. playing on
              opposite sides
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#143F27] text-white">
                  <th className="py-2.5 px-4 font-semibold">Matchup Pair</th>
                  <th className="py-2.5 px-3 font-semibold text-center">
                    As Partners (2v3)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-center">
                    Partner Win Rate
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-center">
                    As Opponents (H2H Record)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {headToHead.map((pair, idx) => {
                  const partnerPct =
                    pair.togetherHoles > 0
                      ? Math.round((pair.togetherWins / pair.togetherHoles) * 100)
                      : 0;
                  return (
                    <tr
                      key={`${pair.playerA}-${pair.playerB}`}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-[#E9F5EC]/30'}
                    >
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {pair.playerA} <span className="text-slate-400 font-normal">&</span>{' '}
                        {pair.playerB}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {pair.togetherHoles} holes ({pair.togetherWins} wins)
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-[#1E5E3A]">
                        {pair.togetherHoles > 0 ? `${partnerPct}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className="font-bold text-[#143F27]">
                          {pair.playerA} {pair.aBeatB}
                        </span>{' '}
                        –{' '}
                        <span className="font-bold text-amber-900">
                          {pair.bBeatA} {pair.playerB}
                        </span>
                        {pair.tiesAgainst > 0 && (
                          <span className="text-slate-400"> ({pair.tiesAgainst} ties)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Past Saved Rounds Log */}
      {savedRounds.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#2E8B57]/25 overflow-hidden">
          <div className="px-5 py-4 bg-[#E9F5EC] border-b border-[#2E8B57]/20">
            <h2 className="font-serif font-bold text-lg text-[#143F27] flex items-center gap-2">
              <History className="w-5 h-5 text-[#2E8B57]" />
              Saved Round Archive ({savedRounds.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-200">
            {savedRounds.map((r) => (
              <div
                key={r.id}
                className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#143F27] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#2E8B57]" />
                      {r.courseName}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(r.dateISO).toLocaleDateString()}
                    </span>
                    <span className="text-[11px] font-mono bg-[#E9F5EC] text-[#1E5E3A] px-2 py-0.5 rounded-full">
                      {r.holesCompleted} holes
                    </span>
                  </div>
                  {r.notes && (
                    <div className="text-xs italic text-slate-500 mt-0.5">
                      "{r.notes}"
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {r.playerNames.map((n, idx) => {
                      const disp = n?.trim() || `P${idx + 1}`;
                      const net = r.finalTotals[idx] ?? 0;
                      return (
                        <span
                          key={idx}
                          className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 border border-slate-200"
                        >
                          <strong className="font-sans">{disp}:</strong>{' '}
                          <span
                            className={
                              net > 0
                                ? 'text-emerald-700 font-bold'
                                : net < 0
                                ? 'text-rose-600 font-bold'
                                : 'text-slate-500'
                            }
                          >
                            {net > 0 ? `+$${net}` : net < 0 ? `-$${Math.abs(net)}` : '$0'}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteRound(r.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                  title="Delete Saved Round"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
