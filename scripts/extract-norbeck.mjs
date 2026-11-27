import fs from 'node:fs';
import path from 'node:path';

const OSM_CACHE_PATH =
  'C:\\Users\\Brian\\.gemini\\antigravity\\brain\\e3419568-f727-452a-90a8-c2ba02e4b118\\scratch\\norbeck_map.json';
const OUTPUT_PATH = path.join(process.cwd(), 'src', 'gps', 'data', 'norbeckCourse.ts');

const SCORECARD = {
  pars: [4, 4, 3, 4, 5, 3, 4, 5, 4, 4, 5, 3, 4, 4, 4, 3, 5, 4],
  handicaps: [9, 3, 11, 7, 13, 15, 1, 17, 5, 8, 10, 14, 2, 18, 6, 12, 16, 4],
  yardages: {
    black: [386, 407, 211, 416, 605, 177, 452, 536, 456, 375, 532, 195, 349, 345, 420, 190, 545, 422],
    blue: [351, 394, 182, 392, 550, 173, 404, 531, 410, 344, 534, 160, 346, 325, 414, 169, 537, 397],
    white: [351, 374, 182, 347, 550, 158, 404, 490, 410, 344, 495, 160, 333, 325, 372, 169, 495, 397],
    gold: [351, 374, 142, 243, 422, 158, 404, 490, 361, 344, 449, 160, 333, 325, 328, 169, 401, 336],
    forward: [301, 331, 142, 243, 422, 127, 370, 439, 361, 314, 449, 130, 313, 305, 328, 140, 401, 336],
  },
  teeInfo: {
    black: { label: 'Black', color: '#18181B', rating: 74.1, slope: 136 },
    blue: { label: 'Blue', color: '#2563EB', rating: 72.6, slope: 133 },
    white: { label: 'White', color: '#F8FAFC', rating: 71.1, slope: 129 },
    gold: { label: 'Gold', color: '#D4AF37', rating: 68.4, slope: 121 },
    forward: { label: 'Forward', color: '#DC2626', rating: 66.8, slope: 118 },
  },
};

const REF_LAT = 39.138;
const REF_LNG = -77.095;
const COS_LAT = Math.cos((REF_LAT * Math.PI) / 180);
const M_PER_LAT = 111132.95;
const M_PER_LNG = 111319.49 * COS_LAT;
const YD_PER_M = 1.0936132983;

function roundCoord(n) {
  return Math.round(n * 1e6) / 1e6;
}

function roundPt(pt) {
  return { lat: roundCoord(pt.lat), lng: roundCoord(pt.lng) };
}

function toXY(pt) {
  return [
    (pt.lng - REF_LNG) * M_PER_LNG * YD_PER_M,
    (pt.lat - REF_LAT) * M_PER_LAT * YD_PER_M,
  ];
}

function distYards(a, b) {
  const R = 6371008.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * YD_PER_M;
}

function stripClosingPoint(pts) {
  if (pts.length < 2) return pts;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (Math.abs(first.lat - last.lat) < 1e-8 && Math.abs(first.lng - last.lng) < 1e-8) {
    return pts.slice(0, -1);
  }
  return pts;
}

function polygonCentroid(ring) {
  const pts = stripClosingPoint(ring);
  if (pts.length === 0) return { lat: REF_LAT, lng: REF_LNG };
  if (pts.length < 3) {
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    return roundPt({ lat, lng });
  }
  const xy = pts.map(toXY);
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x0, y0] = xy[i];
    const [x1, y1] = xy[(i + 1) % xy.length];
    const cross = x0 * y1 - x1 * y0;
    area2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area2) < 1e-6) {
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    return roundPt({ lat, lng });
  }
  const ux = cx / (3 * area2);
  const uy = cy / (3 * area2);
  return roundPt({
    lat: REF_LAT + uy / (M_PER_LAT * YD_PER_M),
    lng: REF_LNG + ux / (M_PER_LNG * YD_PER_M),
  });
}

function distPointToSegment(pt, a, b) {
  const [px, py] = toXY(pt);
  const [ax, ay] = toXY(a);
  const [bx, by] = toXY(b);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const dist = Math.hypot(px - projX, py - projY);
  const cross = dx * (py - ay) - dy * (px - ax);
  const side = dist < 2 ? 'C' : cross > 0 ? 'L' : 'R';
  return { dist, t, side };
}

function distPointToPolyline(pt, line) {
  let best = { dist: Infinity, distFromTee: 0, side: 'C', totalLen: 0 };
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const segLen = distYards(line[i - 1], line[i]);
    const res = distPointToSegment(pt, line[i - 1], line[i]);
    if (res.dist < best.dist) {
      best = {
        dist: res.dist,
        distFromTee: acc + res.t * segLen,
        side: res.side,
        totalLen: 0,
      };
    }
    acc += segLen;
  }
  best.totalLen = acc;
  return best;
}

function polylineCentroid(pts) {
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  return roundPt({ lat, lng });
}

function clipPolylineToBox(pts, box) {
  const isInside = (p) =>
    p.lat >= box.minLat &&
    p.lat <= box.maxLat &&
    p.lng >= box.minLng &&
    p.lng <= box.maxLng;

  const runs = [];
  let start = -1;
  let end = -1;
  for (let i = 0; i < pts.length; i++) {
    if (isInside(pts[i])) {
      if (start === -1) start = i;
      end = i;
    } else if (start !== -1) {
      runs.push([start, end]);
      start = -1;
      end = -1;
    }
  }
  if (start !== -1) runs.push([start, end]);

  const segments = [];
  for (const [rStart, rEnd] of runs) {
    const i0 = Math.max(0, rStart - 1);
    const i1 = Math.min(pts.length - 1, rEnd + 1);
    const clipped = pts.slice(i0, i1 + 1);
    if (clipped.length >= 2) segments.push(clipped);
  }
  return segments;
}

function main() {
  if (!fs.existsSync(OSM_CACHE_PATH)) {
    console.error(`OSM cache file missing at: ${OSM_CACHE_PATH}`);
    process.exit(1);
  }

  const osm = JSON.parse(fs.readFileSync(OSM_CACHE_PATH, 'utf8'));
  const nodeMap = new Map();
  for (const el of osm.elements) {
    if (el.type === 'node') {
      nodeMap.set(el.id, { lat: el.lat, lng: el.lon });
    }
  }

  const getWayPoints = (way) =>
    (way.nodes || []).map((id) => nodeMap.get(id)).filter(Boolean).map(roundPt);

  const holeWays = osm.elements
    .filter((el) => el.type === 'way' && el.tags?.golf === 'hole')
    .sort((a, b) => Number(a.tags.ref) - Number(b.tags.ref));

  if (holeWays.length !== 18) {
    throw new Error(`Expected 18 OSM golf=hole ways, found ${holeWays.length}`);
  }

  const boundaryWay = osm.elements.find(
    (el) => el.type === 'way' && el.id === 45754331
  );
  if (!boundaryWay) {
    throw new Error('Missing Norbeck boundary way 45754331');
  }
  const boundary = stripClosingPoint(getWayPoints(boundaryWay));
  const bLats = boundary.map((p) => p.lat);
  const bLngs = boundary.map((p) => p.lng);
  const marginLat = 120 / (M_PER_LAT * YD_PER_M);
  const marginLng = 120 / (M_PER_LNG * YD_PER_M);
  const courseBox = {
    minLat: Math.min(...bLats),
    maxLat: Math.max(...bLats),
    minLng: Math.min(...bLngs),
    maxLng: Math.max(...bLngs),
  };
  const paddedBox = {
    minLat: courseBox.minLat - marginLat,
    maxLat: courseBox.maxLat + marginLat,
    minLng: courseBox.minLng - marginLng,
    maxLng: courseBox.maxLng + marginLng,
  };

  const greenWays = osm.elements
    .filter((el) => el.type === 'way' && el.tags?.golf === 'green')
    .map((w) => {
      const polygon = stripClosingPoint(getWayPoints(w));
      return { id: w.id, polygon, center: polygonCentroid(polygon) };
    });

  const teeWays = osm.elements
    .filter((el) => el.type === 'way' && el.tags?.golf === 'tee')
    .map((w) => {
      const polygon = stripClosingPoint(getWayPoints(w));
      return { id: w.id, polygon, center: polygonCentroid(polygon) };
    });

  const fairwayWays = osm.elements
    .filter((el) => el.type === 'way' && el.tags?.golf === 'fairway')
    .map((w) => {
      const polygon = stripClosingPoint(getWayPoints(w));
      return { id: w.id, polygon, center: polygonCentroid(polygon) };
    });

  const bunkerWays = osm.elements
    .filter((el) => el.type === 'way' && el.tags?.golf === 'bunker')
    .map((w) => {
      const polygon = stripClosingPoint(getWayPoints(w));
      return { id: w.id, polygon, center: polygonCentroid(polygon) };
    });

  const waterHazardWays = osm.elements
    .filter((el) => el.type === 'way' && el.tags?.golf === 'water_hazard')
    .map((w) => {
      const polygon = stripClosingPoint(getWayPoints(w));
      return { id: w.id, polygon, center: polygonCentroid(polygon) };
    });

  const allWaterWays = osm.elements
    .filter((el) => el.type === 'way' && el.tags?.natural === 'water')
    .map((w) => {
      const polygon = stripClosingPoint(getWayPoints(w));
      return { id: w.id, polygon, center: polygonCentroid(polygon) };
    })
    .filter(
      (w) =>
        w.center.lat >= courseBox.minLat &&
        w.center.lat <= courseBox.maxLat &&
        w.center.lng >= courseBox.minLng &&
        w.center.lng <= courseBox.maxLng
    );

  const streamWays = osm.elements
    .filter((el) => el.type === 'way' && el.tags?.waterway === 'stream')
    .map((w) => ({
      id: w.id,
      name: w.tags?.name || '',
      points: getWayPoints(w),
    }));

  // 1. Match each hole to its green polygon
  const greenToHole = new Map();
  const holeDrafts = holeWays.map((hw, idx) => {
    const holeNumber = Number(hw.tags.ref);
    if (holeNumber !== idx + 1) {
      throw new Error(`Hole index mismatch: expected ${idx + 1}, got ${holeNumber}`);
    }
    const centerline = getWayPoints(hw);
    const tee = centerline[0];
    const endPt = centerline[centerline.length - 1];

    let bestGreen = null;
    let bestGreenDist = Infinity;
    for (const g of greenWays) {
      const d = distYards(endPt, g.center);
      if (d < bestGreenDist) {
        bestGreenDist = d;
        bestGreen = g;
      }
    }
    if (!bestGreen) {
      throw new Error(`No green matched for hole ${holeNumber}`);
    }
    greenToHole.set(bestGreen.id, holeNumber);

    const par = SCORECARD.pars[idx];
    const handicap = SCORECARD.handicaps[idx];
    let defaultTarget = null;
    if (par >= 4) {
      if (centerline.length >= 3) {
        defaultTarget = centerline[1];
      } else {
        defaultTarget = roundPt({
          lat: tee.lat + (bestGreen.center.lat - tee.lat) * 0.6,
          lng: tee.lng + (bestGreen.center.lng - tee.lng) * 0.6,
        });
      }
    }

    return {
      holeNumber,
      par,
      handicap,
      yardages: {
        black: SCORECARD.yardages.black[idx],
        blue: SCORECARD.yardages.blue[idx],
        white: SCORECARD.yardages.white[idx],
        gold: SCORECARD.yardages.gold[idx],
        forward: SCORECARD.yardages.forward[idx],
      },
      tee,
      teePolygons: [],
      centerline,
      defaultTarget,
      green: {
        center: bestGreen.center,
        polygon: bestGreen.polygon,
      },
      hazards: [],
    };
  });

  // 2. Match tee polygons to nearest hole start within 65 yds
  const teeToHole = new Map();
  for (const tw of teeWays) {
    let bestHole = null;
    let bestDist = Infinity;
    for (const h of holeDrafts) {
      const d = distYards(tw.center, h.tee);
      if (d < bestDist) {
        bestDist = d;
        bestHole = h;
      }
    }
    if (bestHole && bestDist <= 65) {
      bestHole.teePolygons.push(tw.polygon);
      teeToHole.set(tw.id, bestHole.holeNumber);
    } else {
      teeToHole.set(tw.id, null);
    }
  }

  // 3. Identify practice greens & filter out practice-green bunkers
  const practiceGreens = greenWays.filter((g) => !greenToHole.has(g.id));
  let excludedPracticeBunkers = 0;
  let keptBunkers = 0;

  const rawBunkersByHole = new Map(holeDrafts.map((h) => [h.holeNumber, []]));
  const bunkerToHole = new Map();

  for (const b of bunkerWays) {
    const nearPractice = practiceGreens.some((pg) => distYards(b.center, pg.center) < 35);
    if (nearPractice) {
      excludedPracticeBunkers++;
      bunkerToHole.set(b.id, null);
      continue;
    }

    let bestHole = null;
    let bestProj = null;
    for (const h of holeDrafts) {
      const proj = distPointToPolyline(b.center, h.centerline);
      if (!bestProj || proj.dist < bestProj.dist) {
        bestProj = proj;
        bestHole = h;
      }
    }

    if (!bestHole || !bestProj) continue;
    keptBunkers++;
    bunkerToHole.set(b.id, bestHole.holeNumber);

    const distToGreenCenter = distYards(b.center, bestHole.green.center);
    const type = distToGreenCenter < 42 ? 'greenside-bunker' : 'fairway-bunker';
    rawBunkersByHole.get(bestHole.holeNumber).push({
      id: `bunker-${b.id}`,
      type,
      side: bestProj.side,
      distFromTee: bestProj.distFromTee,
      points: b.polygon,
      center: b.center,
    });
  }

  for (const h of holeDrafts) {
    const items = rawBunkersByHole.get(h.holeNumber) || [];
    const counts = new Map();
    for (const item of items) {
      const key = `${item.type}:${item.side}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    items.sort((a, b) => a.distFromTee - b.distFromTee);
    const seen = new Map();
    for (const item of items) {
      const key = `${item.type}:${item.side}`;
      const total = counts.get(key) || 1;
      const idx = (seen.get(key) || 0) + 1;
      seen.set(key, idx);
      const base = item.type === 'greenside-bunker' ? 'Greenside Bunker' : 'Fairway Bunker';
      const label =
        total > 1 ? `${base} ${item.side}${idx}` : `${base} (${item.side})`;
      h.hazards.push({
        id: `h${h.holeNumber}-${item.id}`,
        type: item.type,
        label,
        side: item.side,
        geometryType: 'polygon',
        points: item.points,
        center: item.center,
      });
    }
  }

  // 4. Match water hazards (polygons within 40 yds of hole centerline)
  let waterAssignments = 0;
  for (const w of waterHazardWays) {
    for (const h of holeDrafts) {
      const minEdgeDist = Math.min(
        ...w.polygon.map((pt) => distPointToPolyline(pt, h.centerline).dist)
      );
      if (minEdgeDist < 40) {
        waterAssignments++;
        const proj = distPointToPolyline(w.center, h.centerline);
        h.hazards.push({
          id: `h${h.holeNumber}-water-${w.id}`,
          type: 'water',
          label: `Pond (${proj.side})`,
          side: proj.side,
          geometryType: 'polygon',
          points: w.polygon,
          center: w.center,
        });
      }
    }
  }

  // 5. Match & clip creek crossings (streams passing within 30 yds of hole centerline)
  let creekAssignments = 0;
  for (const s of streamWays) {
    for (const h of holeDrafts) {
      const ptDists = s.points.map((pt) => distPointToPolyline(pt, h.centerline));
      const minDist = Math.min(...ptDists.map((d) => d.dist));
      if (minDist >= 30) continue;

      let start = -1;
      let end = -1;
      let runBest = Infinity;
      const runs = [];
      for (let i = 0; i < s.points.length; i++) {
        if (ptDists[i].dist <= 65) {
          if (start === -1) start = i;
          end = i;
          if (ptDists[i].dist < runBest) runBest = ptDists[i].dist;
        } else if (start !== -1) {
          if (runBest < 30) runs.push([start, end]);
          start = -1;
          end = -1;
          runBest = Infinity;
        }
      }
      if (start !== -1 && runBest < 30) runs.push([start, end]);

      for (let rIdx = 0; rIdx < runs.length; rIdx++) {
        const [rStart, rEnd] = runs[rIdx];
        const i0 = Math.max(0, rStart - 1);
        const i1 = Math.min(s.points.length - 1, rEnd + 1);
        const clipped = s.points.slice(i0, i1 + 1);
        if (clipped.length < 2) continue;

        let closestPt = clipped[0];
        let closestDist = Infinity;
        let closestSide = 'C';
        for (const pt of clipped) {
          const d = distPointToPolyline(pt, h.centerline);
          if (d.dist < closestDist) {
            closestDist = d.dist;
            closestPt = pt;
            closestSide = d.side;
          }
        }

        creekAssignments++;
        const isRockCreek = s.name.toLowerCase().includes('rock creek');
        h.hazards.push({
          id: `h${h.holeNumber}-creek-${s.id}${runs.length > 1 ? `-${rIdx + 1}` : ''}`,
          type: 'creek',
          label: isRockCreek ? 'Rock Creek' : 'Creek Crossing',
          side: closestDist < 12 ? 'C' : closestSide,
          geometryType: 'polyline',
          points: clipped,
          center: closestPt || polylineCentroid(clipped),
        });
      }
    }
  }

  // 6. Build full property Digital Course View vectors
  const woods = osm.elements
    .filter((el) => el.type === 'way' && el.tags?.natural === 'wood')
    .map((w) => stripClosingPoint(getWayPoints(w)))
    .filter((poly) => poly.length >= 3);

  const fairways = fairwayWays.map((fw) => {
    const samplePts = [fw.center, ...fw.polygon];
    let bestHoleNum = null;
    let bestDist = Infinity;
    for (const h of holeDrafts) {
      let minD = Infinity;
      for (const pt of samplePts) {
        const d = distPointToPolyline(pt, h.centerline).dist;
        if (d < minD) minD = d;
      }
      if (minD < bestDist) {
        bestDist = minD;
        bestHoleNum = h.holeNumber;
      }
    }
    return {
      id: `fairway-${fw.id}`,
      holeNumber: bestDist <= 45 ? bestHoleNum : null,
      points: fw.polygon,
    };
  });

  const greens = greenWays.map((g) => ({
    id: `green-${g.id}`,
    holeNumber: greenToHole.get(g.id) ?? null,
    points: g.polygon,
  }));

  const tees = teeWays.map((t) => ({
    id: `tee-${t.id}`,
    holeNumber: teeToHole.get(t.id) ?? null,
    points: t.polygon,
  }));

  const bunkers = bunkerWays.map((b) => ({
    id: `bunker-${b.id}`,
    holeNumber: bunkerToHole.get(b.id) ?? null,
    points: b.polygon,
  }));

  const waters = allWaterWays.map((w) => w.polygon);

  const streams = [];
  for (const s of streamWays) {
    streams.push(...clipPolylineToBox(s.points, paddedBox));
  }

  const cartpaths = osm.elements
    .filter((el) => el.type === 'way' && el.tags?.golf === 'cartpath')
    .map((w) => getWayPoints(w))
    .filter((line) => line.length >= 2);

  const drivingRangeWay = osm.elements.find(
    (el) => el.type === 'way' && el.tags?.golf === 'driving_range'
  );
  const drivingRange = drivingRangeWay
    ? stripClosingPoint(getWayPoints(drivingRangeWay))
    : null;

  const clubhouseWay = osm.elements.find(
    (el) => el.type === 'way' && el.tags?.golf === 'clubhouse'
  );
  const clubhouse = clubhouseWay
    ? stripClosingPoint(getWayPoints(clubhouseWay))
    : null;

  const pools = osm.elements
    .filter((el) => el.type === 'way' && el.tags?.leisure === 'swimming_pool')
    .map((w) => stripClosingPoint(getWayPoints(w)))
    .filter((poly) => poly.length >= 3);

  const roads = [];
  for (const w of osm.elements.filter(
    (el) => el.type === 'way' && el.tags?.highway === 'tertiary'
  )) {
    roads.push(...clipPolylineToBox(getWayPoints(w), paddedBox));
  }

  const courseCenter = roundPt({
    lat: holeDrafts.reduce((s, h) => s + h.green.center.lat, 0) / holeDrafts.length,
    lng: holeDrafts.reduce((s, h) => s + h.green.center.lng, 0) / holeDrafts.length,
  });

  const teeInfo = {};
  for (const [k, meta] of Object.entries(SCORECARD.teeInfo)) {
    const total = SCORECARD.yardages[k].reduce((a, b) => a + b, 0);
    teeInfo[k] = { ...meta, yards: total };
  }

  const course = {
    id: 'norbeck-cc',
    name: 'Norbeck Country Club',
    location: 'Rockville, MD',
    address: '17200 Cashell Rd, Rockville, MD 20853',
    center: courseCenter,
    parTotal: SCORECARD.pars.reduce((a, b) => a + b, 0),
    teeInfo,
    holes: holeDrafts,
    vectors: {
      boundary,
      woods,
      fairways,
      greens,
      tees,
      bunkers,
      waters,
      streams,
      cartpaths,
      drivingRange,
      clubhouse,
      pools,
      roads,
    },
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const fileContent = `// Auto-generated from OpenStreetMap geometry for Norbeck Country Club via scripts/extract-norbeck.mjs
import { CourseGpsData } from '../types';

export const NORBECK_COURSE: CourseGpsData = ${JSON.stringify(course, null, 2)};
`;
  fs.writeFileSync(OUTPUT_PATH, fileContent, 'utf8');

  console.log('Generated Norbeck GPS dataset ->', path.relative(process.cwd(), OUTPUT_PATH));
  console.log(
    `Summary: ${holeDrafts.length} holes | ${greenToHole.size} greens (${practiceGreens.length} practice greens skipped) | ${keptBunkers} bunkers (${excludedPracticeBunkers} practice bunkers excluded) | ${waterAssignments} water assignments | ${creekAssignments} creek crossings`
  );
  console.log(
    `Digital vectors: boundary=${boundary.length}pts, woods=${woods.length}, fairways=${fairways.length}, greens=${greens.length}, tees=${tees.length}, bunkers=${bunkers.length}, waters=${waters.length}, streams=${streams.length}, cartpaths=${cartpaths.length}, pools=${pools.length}, roads=${roads.length}`
  );
}

main();
