import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  ExternalLink,
  History,
  RotateCcw,
  Save,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  ActiveGpsRound,
  CourseGpsData,
  HoleComputedSummary,
  RoundComputedSummary,
  SavedGpsRound,
} from '../types';
import { formatGhinClipboardText, formatToPar } from '../utils/scorecard';

export type ScorecardModalTab = 'scorecard' | 'ghin' | 'history';

interface ScorecardModalProps {
  isOpen: boolean;
  initialTab: ScorecardModalTab;
  course: CourseGpsData;
  activeRound: ActiveGpsRound;
  summary: RoundComputedSummary;
  handicapIndex: number | null;
  roundHistory: SavedGpsRound[];
  onChangeHandicapIndex: (idx: number | null) => void;
  onJumpToHoleScore: (holeNumber: number) => void;
  onSaveRound: () => void;
  onResetRound: () => void;
  onDeleteHistoryRound: (id: string) => void;
  onClose: () => void;
}

function formatIndexValue(idx: number | null): string {
  if (idx === null) return '';
  if (idx < 0) return `+${Math.abs(idx)}`;
  return String(idx);
}

function renderGrossCell(item: HoleComputedSummary): React.ReactNode {
  const gross = item.entry.gross;
  if (gross === null) {
    return <span className="text-white/35">—</span>;
  }
  const diff = gross - item.par;
  let badgeClass = 'text-white';
  if (diff <= -2) {
    badgeClass =
      'w-6 h-6 rounded-full border-2 border-[#D4AF37] bg-[#D4AF37]/25 text-[#F4E4C1] ring-1 ring-[#D4AF37]/60';
  } else if (diff === -1) {
    badgeClass =
      'w-6 h-6 rounded-full border border-[#D4AF37] bg-[#D4AF37]/15 text-[#F4E4C1]';
  } else if (diff === 1) {
    badgeClass =
      'w-6 h-6 rounded-md border border-amber-400/70 bg-amber-500/15 text-amber-200';
  } else if (diff >= 2) {
    badgeClass =
      'w-6 h-6 rounded-md border-2 border-rose-400/80 bg-rose-500/20 text-rose-200';
  }

  return (
    <span className={`inline-flex items-center justify-center font-mono text-xs font-extrabold ${badgeClass}`}>
      {gross}
    </span>
  );
}

export const ScorecardModal: React.FC<ScorecardModalProps> = ({
  isOpen,
  initialTab,
  course,
  activeRound,
  summary,
  handicapIndex,
  roundHistory,
  onChangeHandicapIndex,
  onJumpToHoleScore,
  onSaveRound,
  onResetRound,
  onDeleteHistoryRound,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ScorecardModalTab>(initialTab);
  const [hcpText, setHcpText] = useState<string>(() =>
    formatIndexValue(handicapIndex)
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setHcpText(formatIndexValue(handicapIndex));
      setConfirmReset(false);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleHcpChange = (raw: string) => {
    setHcpText(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      onChangeHandicapIndex(null);
      return;
    }
    const normalized = trimmed.startsWith('+')
      ? `-${trimmed.slice(1)}`
      : trimmed;
    if (normalized === '-' || normalized === '.' || normalized === '-.') return;
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed) && parsed >= -10 && parsed <= 54) {
      onChangeHandicapIndex(Math.round(parsed * 10) / 10);
    }
  };

  const handleSave = () => {
    if (summary.holesPlayed === 0) return;
    onSaveRound();
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleResetClick = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3500);
      return;
    }
    setConfirmReset(false);
    onResetRound();
  };

  const handleCopyGhin = async () => {
    const text = formatGhinClipboardText(
      activeRound,
      course,
      summary,
      handicapIndex
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    } catch {
      // Clipboard blocked on non-secure context; ignore gracefully
    }
  };

  // Compute Norbeck History averages
  const complete18Rounds = roundHistory.filter((r) => r.holesPlayed === 18);
  const bestGross =
    complete18Rounds.length > 0
      ? Math.min(...complete18Rounds.map((r) => r.grossTotal))
      : null;
  const avgGross =
    complete18Rounds.length > 0
      ? (
          complete18Rounds.reduce((s, r) => s + r.grossTotal, 0) /
          complete18Rounds.length
        ).toFixed(1)
      : null;
  const roundsWithPutts = roundHistory.filter((r) => r.puttsTotal !== null && r.holesPlayed >= 9);
  const avgPutts =
    roundsWithPutts.length > 0
      ? (
          roundsWithPutts.reduce((s, r) => s + (r.puttsTotal || 0), 0) /
          roundsWithPutts.length
        ).toFixed(1)
      : null;
  const totalFirHit = roundHistory.reduce((s, r) => s + r.firHit, 0);
  const totalFirTracked = roundHistory.reduce((s, r) => s + r.firTracked, 0);
  const totalGirHit = roundHistory.reduce((s, r) => s + r.girHit, 0);
  const totalGirTracked = roundHistory.reduce((s, r) => s + r.girTracked, 0);
  const roundsWithDiff = roundHistory.filter((r) => r.differential !== null);
  const avgDiff =
    roundsWithDiff.length > 0
      ? (
          roundsWithDiff.reduce((s, r) => s + (r.differential || 0), 0) /
          roundsWithDiff.length
        ).toFixed(1)
      : null;

  const renderNineTable = (
    title: string,
    items: HoleComputedSummary[],
    nineSummary: RoundComputedSummary['frontNine'],
    totalLabel: string
  ) => (
    <div className="bg-black/25 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 flex items-center justify-between text-[11px] font-bold text-emerald-200">
        <span>{title}</span>
        <span className="font-mono text-white/80">
          Par {nineSummary.parTotal}
          {nineSummary.holesPlayed > 0 ? ` · ${nineSummary.grossTotal}` : ''}
        </span>
      </div>
      <table className="w-full text-center text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-emerald-200/65 border-b border-white/10">
            <th className="py-1.5 px-2 text-left">Hole</th>
            <th className="py-1.5 px-1">Par</th>
            <th className="py-1.5 px-1">HCP</th>
            <th className="py-1.5 px-1">Gross</th>
            <th className="py-1.5 px-1">Net</th>
            <th className="py-1.5 px-1">Putts</th>
            <th className="py-1.5 px-2 text-right">F / G</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {items.map((item) => (
            <tr
              key={item.holeNumber}
              onClick={() => onJumpToHoleScore(item.holeNumber)}
              className="hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors"
            >
              <td className="py-1.5 px-2 text-left font-mono font-bold text-white">
                <div className="flex items-center gap-1">
                  <span>{item.holeNumber}</span>
                  {item.strokes !== null && item.strokes > 0 && (
                    <span className="text-[#D4AF37] text-[10px]" title={`${item.strokes} handicap stroke(s)`}>
                      {'•'.repeat(item.strokes)}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-1.5 px-1 font-mono text-emerald-100/80">{item.par}</td>
              <td className="py-1.5 px-1 font-mono text-[11px] text-white/55">{item.handicap}</td>
              <td className="py-1.5 px-1">{renderGrossCell(item)}</td>
              <td className="py-1.5 px-1 font-mono text-emerald-200">
                {item.net !== null ? item.net : <span className="text-white/25">—</span>}
              </td>
              <td className="py-1.5 px-1 font-mono text-white/80">
                {item.entry.putts !== null ? item.entry.putts : <span className="text-white/25">—</span>}
              </td>
              <td className="py-1.5 px-2 text-right">
                <div className="inline-flex items-center gap-1 text-[10px] font-mono">
                  {item.par >= 4 ? (
                    item.entry.fairway === 'hit' ? (
                      <span className="px-1 rounded bg-emerald-500/25 text-emerald-200">✓</span>
                    ) : item.entry.fairway ? (
                      <span className="px-1 rounded bg-amber-500/20 text-amber-200">
                        {item.entry.fairway === 'left' ? 'L' : 'R'}
                      </span>
                    ) : (
                      <span className="text-white/25">·</span>
                    )
                  ) : (
                    <span className="text-white/20">—</span>
                  )}
                  <span className="text-white/25">/</span>
                  {item.girEffective === true ? (
                    <span className="px-1 rounded bg-emerald-500/25 text-emerald-200">G</span>
                  ) : item.girEffective === false ? (
                    <span className="px-1 rounded bg-rose-500/20 text-rose-200">×</span>
                  ) : (
                    <span className="text-white/25">·</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
          <tr className="bg-white/10 font-mono font-bold text-white">
            <td className="py-2 px-2 text-left text-[11px]">{totalLabel}</td>
            <td className="py-2 px-1 text-emerald-100">{nineSummary.parTotal}</td>
            <td className="py-2 px-1 text-white/40">—</td>
            <td className="py-2 px-1 text-[#F4E4C1]">
              {nineSummary.holesPlayed > 0 ? nineSummary.grossTotal : '—'}
            </td>
            <td className="py-2 px-1 text-emerald-300">
              {nineSummary.netTotal !== null ? nineSummary.netTotal : '—'}
            </td>
            <td className="py-2 px-1">
              {nineSummary.puttsTotal !== null ? nineSummary.puttsTotal : '—'}
            </td>
            <td className="py-2 px-2 text-right text-[10px] text-white/60">
              {nineSummary.holesPlayed}/9
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#143F27] border border-white/20 rounded-3xl shadow-2xl text-white flex flex-col max-h-[90dvh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header + Tabs */}
        <div className="px-4 pt-3.5 pb-2.5 border-b border-white/15 shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-serif text-lg font-bold leading-tight">
                {course.name}
              </div>
              <div className="text-[11px] text-emerald-200/80 flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full border border-white/40 inline-block"
                  style={{ backgroundColor: summary.teeMeta.color }}
                />
                <span>
                  {summary.teeMeta.label} Tees ({summary.teeMeta.rating} / {summary.teeMeta.slope})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
              aria-label="Close scorecard modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-black/25 p-1 rounded-xl border border-white/10">
            {(
              [
                ['scorecard', 'Scorecard', ClipboardCheck],
                ['ghin', 'GHIN Summary', Trophy],
                ['history', `History (${roundHistory.length})`, History],
              ] as const
            ).map(([tabKey, label, Icon]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === tabKey
                    ? 'bg-[#2E8B57] text-white shadow'
                    : 'text-emerald-100/75 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
          {activeTab === 'scorecard' && (
            <>
              {/* Handicap Index + Live Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-black/20 border border-white/10 rounded-2xl p-3">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="ghin-hcp-input"
                    className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80"
                  >
                    Hcp Index
                  </label>
                  <input
                    id="ghin-hcp-input"
                    type="text"
                    inputMode="decimal"
                    value={hcpText}
                    onChange={(e) => handleHcpChange(e.target.value)}
                    placeholder="e.g. 8.4"
                    className="w-20 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white font-mono text-xs font-bold text-center placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]"
                  />
                  {summary.courseHandicap !== null && (
                    <span className="px-2 py-0.5 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/50 font-mono text-[11px] font-bold text-[#F4E4C1]">
                      CH {summary.courseHandicap}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <div>
                    <span className="text-white/60">Thru </span>
                    <strong className="text-white">{summary.holesPlayed}</strong>
                  </div>
                  <div>
                    <span className="text-white/60">Gross </span>
                    <strong className="text-[#F4E4C1]">
                      {summary.holesPlayed > 0
                        ? `${summary.grossTotal} (${formatToPar(summary.toPar)})`
                        : '—'}
                    </strong>
                  </div>
                  {summary.netTotal !== null && (
                    <div>
                      <span className="text-white/60">Net </span>
                      <strong className="text-emerald-300">{summary.netTotal}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Compact Stats Strip */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-black/20 border border-white/10 rounded-xl py-1.5 px-2">
                  <div className="text-[10px] text-emerald-200/70 uppercase">Putts</div>
                  <div className="font-mono text-sm font-bold">
                    {summary.puttsTotal ?? '—'}
                  </div>
                </div>
                <div className="bg-black/20 border border-white/10 rounded-xl py-1.5 px-2">
                  <div className="text-[10px] text-emerald-200/70 uppercase">FIR</div>
                  <div className="font-mono text-sm font-bold">
                    {summary.firTracked > 0
                      ? `${summary.firHit}/${summary.firTracked}`
                      : '—'}
                  </div>
                </div>
                <div className="bg-black/20 border border-white/10 rounded-xl py-1.5 px-2">
                  <div className="text-[10px] text-emerald-200/70 uppercase">GIR</div>
                  <div className="font-mono text-sm font-bold">
                    {summary.girTracked > 0
                      ? `${summary.girHit}/${summary.girTracked}`
                      : '—'}
                  </div>
                </div>
                <div className="bg-black/20 border border-white/10 rounded-xl py-1.5 px-2">
                  <div className="text-[10px] text-emerald-200/70 uppercase">AGS</div>
                  <div className="font-mono text-sm font-bold text-[#F4E4C1]">
                    {summary.holesPlayed > 0 ? summary.adjustedGrossTotal : '—'}
                  </div>
                </div>
              </div>

              {/* Front 9 & Back 9 Tables */}
              {renderNineTable(
                'Front 9 · Out',
                summary.holes.slice(0, 9),
                summary.frontNine,
                'OUT'
              )}
              {renderNineTable(
                'Back 9 · In',
                summary.holes.slice(9, 18),
                summary.backNine,
                'IN'
              )}
            </>
          )}

          {activeTab === 'ghin' && (
            <>
              <div className="bg-[#2E8B57]/25 border border-emerald-400/35 rounded-2xl p-3 text-xs text-emerald-100 leading-relaxed">
                <strong className="text-white">GHIN-Ready WHS Posting Summary:</strong>{' '}
                All USGA World Handicap System adjustments (Course Handicap, stroke allocation, Net Double Bogey caps, and Score Differential) are pre-calculated for fast entry in the official GHIN app.
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-black/25 border border-white/10 rounded-2xl p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-200/70">
                    Tee & Rating
                  </div>
                  <div className="font-semibold text-sm text-white mt-0.5">
                    {summary.teeMeta.label}
                  </div>
                  <div className="font-mono text-[11px] text-[#F4E4C1]">
                    {summary.teeMeta.rating} / {summary.teeMeta.slope}
                  </div>
                </div>

                <div className="bg-black/25 border border-white/10 rounded-2xl p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-200/70">
                    Course Hcp
                  </div>
                  <div className="font-mono text-xl font-extrabold text-white mt-0.5">
                    {summary.courseHandicap !== null ? summary.courseHandicap : '—'}
                  </div>
                  <div className="text-[10px] text-emerald-200/70">
                    {handicapIndex !== null
                      ? `Index ${formatIndexValue(handicapIndex)}`
                      : 'Set Index in Card'}
                  </div>
                </div>

                <div className="bg-black/25 border border-white/10 rounded-2xl p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-200/70">
                    Adjusted Gross
                  </div>
                  <div className="font-mono text-xl font-extrabold text-[#F4E4C1] mt-0.5">
                    {summary.holesPlayed > 0 ? summary.adjustedGrossTotal : '—'}
                  </div>
                  <div className="text-[10px] text-emerald-200/70">
                    {summary.holesPlayed > 0
                      ? `Gross ${summary.grossTotal} (${formatToPar(summary.toPar)})`
                      : 'No scores yet'}
                  </div>
                </div>

                <div className="bg-black/25 border border-white/10 rounded-2xl p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-200/70">
                    Score Diff.
                  </div>
                  <div className="font-mono text-xl font-extrabold text-emerald-300 mt-0.5">
                    {summary.differential !== null
                      ? summary.differential.toFixed(1)
                      : '—'}
                  </div>
                  <div className="text-[10px] text-emerald-200/70">
                    {summary.holesPlayed === 18
                      ? '18H WHS Differential'
                      : summary.isNineHoleComplete
                      ? '9H ready in GHIN'
                      : `${summary.holesPlayed}/18 holes`}
                  </div>
                </div>
              </div>

              {summary.holesPlayed > 0 && summary.holesPlayed < 18 && (
                <div className="text-[11px] text-amber-200/90 bg-amber-500/15 border border-amber-400/35 rounded-xl px-3 py-2">
                  Complete all 18 holes for an 18-hole Score Differential (9-hole rounds can be posted directly as 9 holes in GHIN).
                </div>
              )}

              {summary.ndbCappedHoles.length > 0 && (
                <div className="bg-black/25 border border-amber-400/35 rounded-2xl p-3 space-y-1.5">
                  <div className="text-xs font-bold text-[#F4E4C1]">
                    Net Double Bogey (NDB) Adjustments
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.ndbCappedHoles.map((h) => (
                      <span
                        key={h.holeNumber}
                        className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 font-mono text-[11px] text-amber-100"
                      >
                        Hole {h.holeNumber}: {h.entry.gross} → {h.adjustedGross}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Hole-by-hole posting grid */}
              <div className="bg-black/25 border border-white/10 rounded-2xl p-3 space-y-2.5">
                <div className="text-xs font-bold text-emerald-200">
                  Hole-by-Hole Posting Reference
                </div>
                {[
                  { label: 'OUT (1–9)', slice: summary.holes.slice(0, 9), nine: summary.frontNine },
                  { label: 'IN (10–18)', slice: summary.holes.slice(9, 18), nine: summary.backNine },
                ].map((half) => (
                  <div key={half.label} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-white/75 font-semibold">
                      <span>{half.label}</span>
                      <span className="font-mono">
                        Gross {half.nine.grossTotal} · AGS {half.nine.adjustedGrossTotal}
                      </span>
                    </div>
                    <div className="grid grid-cols-9 gap-1 text-center">
                      {half.slice.map((h) => (
                        <div
                          key={h.holeNumber}
                          className="rounded-lg bg-white/5 border border-white/10 py-1 px-0.5"
                        >
                          <div className="text-[9px] text-white/50 font-mono">
                            {h.holeNumber}
                          </div>
                          <div className="font-mono text-xs font-bold text-white">
                            {h.entry.gross ?? '—'}
                          </div>
                          {h.ndbCapped && (
                            <div className="font-mono text-[9px] text-amber-300">
                              ({h.adjustedGross})
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-emerald-100">
                  <span>
                    FIR: {summary.firTracked > 0 ? `${summary.firHit}/${summary.firTracked}` : '—'}
                  </span>
                  <span>
                    GIR: {summary.girTracked > 0 ? `${summary.girHit}/${summary.girTracked}` : '—'}
                  </span>
                  <span>Putts: {summary.puttsTotal ?? '—'}</span>
                  <span>Sand: {summary.sandCount}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyGhin}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#2E8B57] hover:bg-[#2E8B57]/90 border border-emerald-300/50 text-xs font-extrabold text-white flex items-center justify-center gap-1.5 shadow"
                >
                  {copiedFeedback ? (
                    <>
                      <Check className="w-4 h-4 text-[#F4E4C1]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy GHIN Summary</span>
                    </>
                  )}
                </button>

                <a
                  href="https://www.ghin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-[#F4E4C1] flex items-center gap-1.5"
                >
                  <span>Open GHIN</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <>
              {roundHistory.length > 0 && (
                <div className="bg-black/25 border border-white/10 rounded-2xl p-3 space-y-2">
                  <div className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                    Norbeck Averages
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-white/60">Rounds</div>
                      <div className="font-mono text-sm font-bold">{roundHistory.length}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/60">Best 18</div>
                      <div className="font-mono text-sm font-bold text-[#F4E4C1]">
                        {bestGross ?? '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/60">Avg 18</div>
                      <div className="font-mono text-sm font-bold">{avgGross ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/60">Avg Diff</div>
                      <div className="font-mono text-sm font-bold text-emerald-300">
                        {avgDiff ?? '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/60">FIR %</div>
                      <div className="font-mono text-sm font-bold">
                        {totalFirTracked > 0
                          ? `${Math.round((totalFirHit / totalFirTracked) * 100)}%`
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/60">GIR %</div>
                      <div className="font-mono text-sm font-bold">
                        {totalGirTracked > 0
                          ? `${Math.round((totalGirHit / totalGirTracked) * 100)}%`
                          : '—'}
                      </div>
                    </div>
                  </div>
                  {avgPutts && (
                    <div className="text-[11px] text-center text-emerald-100/75 pt-1 border-t border-white/10 font-mono">
                      Avg Putts / Round: {avgPutts}
                    </div>
                  )}
                </div>
              )}

              {roundHistory.length === 0 ? (
                <div className="text-center py-10 px-4 bg-black/20 border border-white/10 rounded-2xl text-sm text-emerald-100/75">
                  No saved Norbeck rounds yet. Score holes during your round and tap{' '}
                  <strong className="text-white">Save Round</strong> to build your history.
                </div>
              ) : (
                <div className="space-y-2">
                  {roundHistory.map((item) => {
                    const isExpanded = expandedRoundId === item.id;
                    const teeLabel = course.teeInfo[item.tee]?.label || item.tee;
                    const dateStr = new Date(item.completedAt).toLocaleDateString(
                      'en-US',
                      { month: 'short', day: 'numeric', year: 'numeric' }
                    );

                    return (
                      <div
                        key={item.id}
                        className="bg-black/25 border border-white/10 rounded-2xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRoundId(isExpanded ? null : item.id)
                            }
                            className="flex-1 text-left flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-2">
                                <span>{dateStr}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-emerald-200">
                                  {teeLabel} · {item.holesPlayed}H
                                </span>
                              </div>
                              <div className="text-[11px] text-emerald-100/70 font-mono mt-0.5">
                                AGS {item.adjustedGrossTotal}
                                {item.differential !== null
                                  ? ` · Diff ${item.differential.toFixed(1)}`
                                  : ''}
                                {item.puttsTotal !== null
                                  ? ` · ${item.puttsTotal} putts`
                                  : ''}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-right font-mono">
                                <div className="text-lg font-extrabold text-[#F4E4C1] leading-none">
                                  {item.grossTotal}
                                </div>
                                <div className="text-[10px] text-emerald-200">
                                  {formatToPar(item.toPar)}
                                </div>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-white/60" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-white/60" />
                              )}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirmDeleteId === item.id) {
                                onDeleteHistoryRound(item.id);
                                setConfirmDeleteId(null);
                              } else {
                                setConfirmDeleteId(item.id);
                                setTimeout(() => setConfirmDeleteId(null), 3000);
                              }
                            }}
                            className={`p-2 rounded-xl border transition-colors ${
                              confirmDeleteId === item.id
                                ? 'bg-rose-600 border-rose-400 text-white'
                                : 'bg-white/5 border-white/10 text-white/55 hover:text-rose-200'
                            }`}
                            title={
                              confirmDeleteId === item.id
                                ? 'Tap again to delete'
                                : 'Delete round'
                            }
                            aria-label="Delete saved round"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="pt-2 border-t border-white/10 space-y-1.5">
                            {[
                              { label: 'OUT', start: 1, end: 9 },
                              { label: 'IN', start: 10, end: 18 },
                            ].map((nine) => (
                              <div
                                key={nine.label}
                                className="grid grid-cols-10 gap-1 text-center font-mono text-[11px]"
                              >
                                <div className="py-1 text-[9px] font-bold text-emerald-200 flex items-center justify-center">
                                  {nine.label}
                                </div>
                                {Array.from({ length: 9 }, (_, i) => {
                                  const hNum = nine.start + i;
                                  const score = item.holes[hNum]?.gross;
                                  return (
                                    <div
                                      key={hNum}
                                      className="rounded bg-white/5 py-1 text-white"
                                    >
                                      {score ?? '—'}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Persistent Round Actions (Scorecard & GHIN tabs) */}
        {activeTab !== 'history' && (
          <div className="px-4 py-3 border-t border-white/15 bg-black/20 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetClick}
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                confirmReset
                  ? 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{confirmReset ? 'Tap again to reset' : 'New Round'}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={summary.holesPlayed === 0}
              className={`px-4 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                summary.holesPlayed === 0
                  ? 'bg-white/5 border-white/10 text-white/35 cursor-not-allowed'
                  : savedFeedback
                  ? 'bg-emerald-600 border-emerald-400 text-white'
                  : 'bg-[#2E8B57] hover:bg-[#2E8B57]/90 border-emerald-300/50 text-white shadow'
              }`}
            >
              {savedFeedback ? (
                <>
                  <Check className="w-4 h-4 text-[#F4E4C1]" />
                  <span>Saved to History</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Round</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
