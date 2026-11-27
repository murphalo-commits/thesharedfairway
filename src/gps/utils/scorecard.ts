import {
  ActiveGpsRound,
  CourseGpsData,
  HoleComputedSummary,
  HoleScoreEntry,
  NineSummary,
  RoundComputedSummary,
  SavedGpsRound,
  TeeMeta,
  TeeName,
} from '../types';

export function createEmptyHoleEntry(holeNumber: number): HoleScoreEntry {
  return {
    holeNumber,
    gross: null,
    putts: null,
    fairway: null,
    gir: null,
    girManual: false,
    sand: false,
    penalties: 0,
  };
}

export function createEmptyRound(courseId: string, tee: TeeName): ActiveGpsRound {
  const holes: Record<number, HoleScoreEntry> = {};
  for (let h = 1; h <= 18; h++) {
    holes[h] = createEmptyHoleEntry(h);
  }
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `gps-round-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    courseId,
    startedAt: new Date().toISOString(),
    tee,
    holes,
  };
}

function roundHalfAwayFromZero(val: number): number {
  return val >= 0 ? Math.round(val) : -Math.round(-val);
}

export function calculateCourseHandicap(
  handicapIndex: number,
  teeMeta: TeeMeta,
  parTotal: number
): number {
  return roundHalfAwayFromZero(
    handicapIndex * (teeMeta.slope / 113) + (teeMeta.rating - parTotal)
  );
}

export function getStrokesOnHole(
  courseHandicap: number,
  holeHandicap: number
): number {
  if (courseHandicap === 0) return 0;
  if (courseHandicap > 0) {
    const base = Math.floor(courseHandicap / 18);
    const rem = courseHandicap % 18;
    return base + (holeHandicap <= rem ? 1 : 0);
  }
  const absCh = Math.abs(courseHandicap);
  const base = Math.floor(absCh / 18);
  const rem = absCh % 18;
  return -(base + (19 - holeHandicap <= rem ? 1 : 0));
}

export function getNetDoubleBogeyMax(
  par: number,
  strokesReceived: number | null
): number {
  if (strokesReceived !== null) {
    return par + 2 + strokesReceived;
  }
  return par + 5;
}

export function computeGirAuto(
  par: number,
  gross: number | null,
  putts: number | null
): boolean | null {
  if (gross === null || putts === null) return null;
  return gross - putts <= par - 2;
}

function summarizeNine(
  items: HoleComputedSummary[],
  hasHandicap: boolean
): NineSummary {
  let holesPlayed = 0;
  let parTotal = 0;
  let parForPlayed = 0;
  let grossTotal = 0;
  let adjustedGrossTotal = 0;
  let netSum = 0;
  let puttsSum = 0;
  let puttsCount = 0;

  for (const item of items) {
    parTotal += item.par;
    if (item.entry.gross !== null) {
      holesPlayed++;
      parForPlayed += item.par;
      grossTotal += item.entry.gross;
      adjustedGrossTotal += item.adjustedGross ?? item.entry.gross;
      if (hasHandicap && item.net !== null) {
        netSum += item.net;
      }
    }
    if (item.entry.putts !== null) {
      puttsSum += item.entry.putts;
      puttsCount++;
    }
  }

  return {
    holesPlayed,
    parTotal,
    parForPlayed,
    grossTotal,
    adjustedGrossTotal,
    netTotal: hasHandicap && holesPlayed > 0 ? netSum : null,
    puttsTotal: puttsCount > 0 ? puttsSum : null,
  };
}

export function computeRoundSummary(
  round: ActiveGpsRound,
  course: CourseGpsData,
  handicapIndex: number | null
): RoundComputedSummary {
  const teeMeta = course.teeInfo[round.tee];
  const hasHandicap =
    handicapIndex !== null &&
    typeof handicapIndex === 'number' &&
    !Number.isNaN(handicapIndex);
  const courseHandicap = hasHandicap
    ? calculateCourseHandicap(handicapIndex, teeMeta, course.parTotal)
    : null;

  const holes: HoleComputedSummary[] = [];
  const ndbCappedHoles: HoleComputedSummary[] = [];

  let holesPlayed = 0;
  let grossTotal = 0;
  let parForPlayed = 0;
  let adjustedGrossTotal = 0;
  let netSum = 0;
  let puttsSum = 0;
  let puttsHoles = 0;
  let firHit = 0;
  let firTracked = 0;
  let girHit = 0;
  let girTracked = 0;
  let sandCount = 0;
  let penaltiesTotal = 0;
  let eagles = 0;
  let birdies = 0;
  let pars = 0;
  let bogeys = 0;
  let doublesPlus = 0;

  for (const h of course.holes) {
    const entry = round.holes[h.holeNumber] || createEmptyHoleEntry(h.holeNumber);
    const strokes =
      courseHandicap !== null
        ? getStrokesOnHole(courseHandicap, h.handicap)
        : null;
    const ndbMax = getNetDoubleBogeyMax(h.par, strokes);
    const gross = entry.gross;
    const adjustedGross = gross !== null ? Math.min(gross, ndbMax) : null;
    const ndbCapped = gross !== null && adjustedGross !== null && gross > adjustedGross;
    const net =
      gross !== null && strokes !== null ? gross - strokes : null;
    const toPar = gross !== null ? gross - h.par : null;
    const girEffective =
      entry.gir !== null ? entry.gir : computeGirAuto(h.par, gross, entry.putts);

    const item: HoleComputedSummary = {
      holeNumber: h.holeNumber,
      par: h.par,
      handicap: h.handicap,
      yardage: h.yardages[round.tee],
      entry,
      strokes,
      ndbMax,
      adjustedGross,
      ndbCapped,
      net,
      toPar,
      girEffective,
    };
    holes.push(item);

    if (gross !== null) {
      holesPlayed++;
      grossTotal += gross;
      parForPlayed += h.par;
      adjustedGrossTotal += adjustedGross ?? gross;
      if (ndbCapped) ndbCappedHoles.push(item);
      if (net !== null) netSum += net;

      const diff = gross - h.par;
      if (diff <= -2) eagles++;
      else if (diff === -1) birdies++;
      else if (diff === 0) pars++;
      else if (diff === 1) bogeys++;
      else doublesPlus++;
    }

    if (entry.putts !== null) {
      puttsSum += entry.putts;
      puttsHoles++;
    }

    if (h.par >= 4 && entry.fairway !== null) {
      firTracked++;
      if (entry.fairway === 'hit') firHit++;
    }

    if (girEffective !== null) {
      girTracked++;
      if (girEffective) girHit++;
    }

    if (entry.sand) sandCount++;
    penaltiesTotal += entry.penalties || 0;
  }

  const frontNine = summarizeNine(holes.slice(0, 9), hasHandicap);
  const backNine = summarizeNine(holes.slice(9, 18), hasHandicap);

  const differential =
    holesPlayed === 18
      ? Math.round(
          ((113 / teeMeta.slope) * (adjustedGrossTotal - teeMeta.rating)) * 10
        ) / 10
      : null;

  const isNineHoleComplete =
    holesPlayed === 9 &&
    (frontNine.holesPlayed === 9 || backNine.holesPlayed === 9);

  return {
    teeMeta,
    hasHandicap,
    courseHandicap,
    holes,
    frontNine,
    backNine,
    holesPlayed,
    grossTotal,
    parForPlayed,
    toPar: grossTotal - parForPlayed,
    adjustedGrossTotal,
    netTotal: hasHandicap && holesPlayed > 0 ? netSum : null,
    ndbCappedHoles,
    differential,
    isNineHoleComplete,
    puttsTotal: puttsHoles > 0 ? puttsSum : null,
    puttsHoles,
    firHit,
    firTracked,
    girHit,
    girTracked,
    sandCount,
    penaltiesTotal,
    eagles,
    birdies,
    pars,
    bogeys,
    doublesPlus,
  };
}

export function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}

export function buildSavedRoundRecord(
  round: ActiveGpsRound,
  summary: RoundComputedSummary,
  handicapIndex: number | null
): SavedGpsRound {
  return {
    ...round,
    completedAt: new Date().toISOString(),
    handicapIndex,
    courseHandicap: summary.courseHandicap,
    grossTotal: summary.grossTotal,
    adjustedGrossTotal: summary.adjustedGrossTotal,
    netTotal: summary.netTotal,
    toPar: summary.toPar,
    holesPlayed: summary.holesPlayed,
    differential: summary.differential,
    puttsTotal: summary.puttsTotal,
    firHit: summary.firHit,
    firTracked: summary.firTracked,
    girHit: summary.girHit,
    girTracked: summary.girTracked,
  };
}

export function formatGhinClipboardText(
  round: ActiveGpsRound,
  course: CourseGpsData,
  summary: RoundComputedSummary,
  handicapIndex: number | null
): string {
  const dateStr = new Date(round.startedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formatNineScores = (items: HoleComputedSummary[]) =>
    items
      .map((h) => {
        if (h.entry.gross === null) return '-';
        return h.ndbCapped ? `${h.entry.gross}(${h.adjustedGross})` : `${h.entry.gross}`;
      })
      .join(' ');

  const lines = [
    `${course.name} — ${dateStr}`,
    `Tee: ${summary.teeMeta.label} (${summary.teeMeta.yards} yds · ${summary.teeMeta.rating} / ${summary.teeMeta.slope})`,
    handicapIndex !== null
      ? `Handicap Index: ${handicapIndex > 0 ? handicapIndex.toFixed(1) : `+${Math.abs(handicapIndex).toFixed(1)}`} | Course Hcp: ${summary.courseHandicap}`
      : `Course Hcp: Not set (NDB cap uses Par+5)`,
    '',
    `OUT (1-9):  ${formatNineScores(summary.holes.slice(0, 9))} | ${summary.frontNine.grossTotal} (AGS ${summary.frontNine.adjustedGrossTotal})`,
    `IN  (10-18): ${formatNineScores(summary.holes.slice(9, 18))} | ${summary.backNine.grossTotal} (AGS ${summary.backNine.adjustedGrossTotal})`,
    '',
    `Total (${summary.holesPlayed}H): Gross ${summary.grossTotal} (${formatToPar(summary.toPar)}) | Adjusted Gross (AGS): ${summary.adjustedGrossTotal}`,
  ];

  if (summary.differential !== null) {
    lines.push(`WHS Score Differential: ${summary.differential.toFixed(1)}`);
  }

  const statParts: string[] = [];
  if (summary.firTracked > 0) statParts.push(`FIR ${summary.firHit}/${summary.firTracked}`);
  if (summary.girTracked > 0) statParts.push(`GIR ${summary.girHit}/${summary.girTracked}`);
  if (summary.puttsTotal !== null) statParts.push(`Putts ${summary.puttsTotal}`);
  if (statParts.length > 0) {
    lines.push(`GHIN Stats: ${statParts.join(' · ')}`);
  }

  return lines.join('\n');
}
