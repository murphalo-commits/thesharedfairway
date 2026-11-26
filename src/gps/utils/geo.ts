import {
  CourseGpsData,
  GreenDistances,
  HazardDistanceResult,
  HoleGpsData,
  LatLng,
  LayupMeasurement,
} from '../types';

const EARTH_RADIUS_METERS = 6371008.8;
export const YARDS_PER_METER = 1.0936132983;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function toLocalXY(origin: LatLng, pt: LatLng): [number, number] {
  const cosLat = Math.cos(origin.lat * DEG_TO_RAD);
  const x =
    (pt.lng - origin.lng) *
    DEG_TO_RAD *
    EARTH_RADIUS_METERS *
    cosLat *
    YARDS_PER_METER;
  const y =
    (pt.lat - origin.lat) * DEG_TO_RAD * EARTH_RADIUS_METERS * YARDS_PER_METER;
  return [x, y];
}

export function fromLocalXY(origin: LatLng, xYards: number, yYards: number): LatLng {
  const cosLat = Math.cos(origin.lat * DEG_TO_RAD);
  const lat =
    origin.lat +
    (yYards / (EARTH_RADIUS_METERS * YARDS_PER_METER)) * RAD_TO_DEG;
  const lng =
    origin.lng +
    (xYards / (EARTH_RADIUS_METERS * YARDS_PER_METER * cosLat)) * RAD_TO_DEG;
  return { lat, lng };
}

export function distanceYards(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(a.lat * DEG_TO_RAD) *
      Math.cos(b.lat * DEG_TO_RAD) *
      sinLng *
      sinLng;
  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))) *
    YARDS_PER_METER
  );
}

export function bearingDegrees(a: LatLng, b: LatLng): number {
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * RAD_TO_DEG) + 360) % 360;
}

export function destinationPoint(
  origin: LatLng,
  bearingDeg: number,
  yards: number
): LatLng {
  const angularDist = yards / (EARTH_RADIUS_METERS * YARDS_PER_METER);
  const brng = bearingDeg * DEG_TO_RAD;
  const lat1 = origin.lat * DEG_TO_RAD;
  const lng1 = origin.lng * DEG_TO_RAD;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDist) +
      Math.cos(lat1) * Math.sin(angularDist) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angularDist) * Math.cos(lat1),
      Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: lat2 * RAD_TO_DEG,
    lng: ((lng2 * RAD_TO_DEG + 540) % 360) - 180,
  };
}

export function isPointInPolygon(pt: LatLng, polygon: LatLng[]): boolean {
  if (polygon.length < 3) return false;
  const [px, py] = toLocalXY(pt, pt);
  const xy = polygon.map((v) => toLocalXY(pt, v));
  let inside = false;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    const [xi, yi] = xy[i];
    const [xj, yj] = xy[j];
    const intersects =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function intersectRayWithPolygon(
  originXY: [number, number],
  dirXY: [number, number],
  polyXY: [number, number][]
): number[] {
  const [px, py] = originXY;
  const [ux, uy] = dirXY;
  const hits: number[] = [];

  for (let i = 0; i < polyXY.length; i++) {
    const [ax, ay] = polyXY[i];
    const [bx, by] = polyXY[(i + 1) % polyXY.length];
    const ex = bx - ax;
    const ey = by - ay;
    const det = ex * uy - ey * ux;
    if (Math.abs(det) < 1e-9) continue;

    const rx = ax - px;
    const ry = ay - py;
    const s = (ex * ry - ey * rx) / det;
    const t = (ux * ry - uy * rx) / det;

    if (t >= -1e-6 && t <= 1 + 1e-6) {
      hits.push(s);
    }
  }

  hits.sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const s of hits) {
    if (deduped.length === 0 || Math.abs(s - deduped[deduped.length - 1]) > 0.05) {
      deduped.push(s);
    }
  }
  return deduped;
}

export function computeGreenDistances(
  player: LatLng,
  green: HoleGpsData['green']
): GreenDistances {
  const center = green.center;
  const [px, py] = toLocalXY(center, player);
  const polyXY = green.polygon.map((v) => toLocalXY(center, v));
  const onGreen = isPointInPolygon(player, green.polygon);

  const dx = -px;
  const dy = -py;
  const distToCenter = Math.hypot(dx, dy);

  const ux = distToCenter > 0.05 ? dx / distToCenter : 0;
  const uy = distToCenter > 0.05 ? dy / distToCenter : 1;

  const hits = intersectRayWithPolygon([px, py], [ux, uy], polyXY);
  const projs = polyXY.map(([vx, vy]) => (vx - px) * ux + (vy - py) * uy);
  const minProj = projs.length ? Math.min(...projs) : distToCenter - 12;
  const maxProj = projs.length ? Math.max(...projs) : distToCenter + 12;

  let frontS: number;
  let backS: number;

  if (!onGreen && hits.length >= 2) {
    const forwardHits = hits.filter((s) => s >= 0);
    if (forwardHits.length >= 2) {
      frontS = forwardHits[0];
      backS = forwardHits[forwardHits.length - 1];
    } else {
      frontS = Math.max(0, hits[0]);
      backS = Math.max(frontS, hits[hits.length - 1]);
    }
  } else if (onGreen) {
    frontS = 0;
    const forwardHits = hits.filter((s) => s >= 0);
    backS = forwardHits.length > 0 ? forwardHits[forwardHits.length - 1] : Math.max(0, maxProj);
  } else {
    frontS = Math.max(0, minProj);
    backS = Math.max(frontS, maxProj);
  }

  const frontPoint = fromLocalXY(center, px + frontS * ux, py + frontS * uy);
  const backPoint = fromLocalXY(center, px + backS * ux, py + backS * uy);

  const frontYards = onGreen ? 0 : Math.round(frontS);
  const centerYards = Math.round(distToCenter);
  const backYards = Math.round(backS);
  const depthYards = onGreen
    ? Math.max(1, Math.round(maxProj - minProj))
    : Math.max(1, Math.round(backS - frontS));

  return {
    onGreen,
    frontYards,
    centerYards,
    backYards,
    depthYards,
    frontPoint,
    backPoint,
  };
}

function densifyPoints(points: LatLng[], closed: boolean, stepYards = 3): LatLng[] {
  if (points.length < 2) return points;
  const result: LatLng[] = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    result.push(a);
    const d = distanceYards(a, b);
    if (d > stepYards) {
      const steps = Math.ceil(d / stepYards);
      for (let k = 1; k < steps; k++) {
        const f = k / steps;
        result.push({
          lat: a.lat + (b.lat - a.lat) * f,
          lng: a.lng + (b.lng - a.lng) * f,
        });
      }
    }
  }
  if (!closed) {
    result.push(points[points.length - 1]);
  }
  return result;
}

export function computeHazardDistances(
  player: LatLng,
  hole: HoleGpsData
): HazardDistanceResult[] {
  const greenCenter = hole.green.center;
  const [gx, gy] = toLocalXY(player, greenCenter);
  const distToGreen = Math.hypot(gx, gy);
  const ugx = distToGreen > 0.05 ? gx / distToGreen : 0;
  const ugy = distToGreen > 0.05 ? gy / distToGreen : 1;

  const results: HazardDistanceResult[] = hole.hazards.map((hazard) => {
    const isCrossing = hazard.geometryType === 'polyline';
    const sampled = densifyPoints(hazard.points, !isCrossing, 2.5);

    let frontPoint = hazard.center;
    let minD = Infinity;
    for (const pt of sampled) {
      const d = distanceYards(player, pt);
      if (d < minD) {
        minD = d;
        frontPoint = pt;
      }
    }

    const frontYards = Math.round(minD);
    let carryPoint = frontPoint;
    let carryYards = frontYards;

    if (!isCrossing) {
      const [hcx, hcy] = toLocalXY(player, hazard.center);
      const hcDist = Math.hypot(hcx, hcy);
      const uhx = hcDist > 0.05 ? hcx / hcDist : ugx;
      const uhy = hcDist > 0.05 ? hcy / hcDist : ugy;

      const polyXY = hazard.points.map((v) => toLocalXY(player, v));
      const rayHits = intersectRayWithPolygon([0, 0], [uhx, uhy], polyXY).filter(
        (s) => s >= 0
      );

      if (rayHits.length > 0) {
        const farS = rayHits[rayHits.length - 1];
        if (farS >= minD) {
          carryPoint = fromLocalXY(player, farS * uhx, farS * uhy);
          carryYards = Math.round(farS);
        }
      }

      if (carryYards <= frontYards) {
        let bestProj = -Infinity;
        for (const pt of sampled) {
          const [sx, sy] = toLocalXY(player, pt);
          const proj = sx * uhx + sy * uhy;
          if (proj > bestProj) {
            bestProj = proj;
            carryPoint = pt;
          }
        }
        carryYards = Math.max(frontYards, Math.round(distanceYards(player, carryPoint)));
      }
    }

    const [cx, cy] = toLocalXY(player, hazard.center);
    const [fx, fy] = toLocalXY(player, frontPoint);
    const projCenter = cx * ugx + cy * ugy;
    const projFront = fx * ugx + fy * ugy;
    const aheadProj = Math.max(projCenter, projFront);

    const isAhead = aheadProj > -8 && frontYards <= distToGreen + 40;
    const isPassed = !isAhead && aheadProj <= -8;

    return {
      hazard,
      frontYards,
      carryYards,
      frontPoint,
      carryPoint,
      isCrossing,
      isAhead,
      isPassed,
    };
  });

  results.sort((a, b) => {
    if (a.isAhead !== b.isAhead) return a.isAhead ? -1 : 1;
    return a.frontYards - b.frontYards;
  });

  return results;
}

export function computeLayupMeasurement(
  player: LatLng,
  target: LatLng,
  greenCenter: LatLng
): LayupMeasurement {
  const toTargetYards = Math.round(distanceYards(player, target));
  const targetToGreenYards = Math.round(distanceYards(target, greenCenter));
  return {
    toTargetYards,
    targetToGreenYards,
    totalYards: toTargetYards + targetToGreenYards,
    leg1Midpoint: {
      lat: (player.lat + target.lat) / 2,
      lng: (player.lng + target.lng) / 2,
    },
    leg2Midpoint: {
      lat: (target.lat + greenCenter.lat) / 2,
      lng: (target.lng + greenCenter.lng) / 2,
    },
  };
}

export function buildDistanceArcsGeoJson(
  greenCenter: LatLng,
  teePoint: LatLng,
  maxHoleYards: number
): GeoJSON.FeatureCollection {
  const baseBearing = bearingDegrees(greenCenter, teePoint);
  const features: GeoJSON.Feature[] = [];
  const radii = [100, 150, 200];

  for (const radius of radii) {
    if (radius > maxHoleYards - 25) continue;

    const coords: [number, number][] = [];
    for (let delta = -50; delta <= 50; delta += 5) {
      const pt = destinationPoint(greenCenter, baseBearing + delta, radius);
      coords.push([pt.lng, pt.lat]);
    }

    features.push({
      type: 'Feature',
      properties: { kind: 'arc', yards: radius },
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    });

    const labelPt = destinationPoint(greenCenter, baseBearing - 26, radius);
    features.push({
      type: 'Feature',
      properties: { kind: 'arc-label', label: `${radius}`, yards: radius },
      geometry: {
        type: 'Point',
        coordinates: [labelPt.lng, labelPt.lat],
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

function pointToSegmentDistYards(pt: LatLng, a: LatLng, b: LatLng): number {
  const [px, py] = toLocalXY(a, pt);
  const [bx, by] = toLocalXY(a, b);
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}

export function detectNearestHole(
  player: LatLng,
  course: CourseGpsData
): { holeNumber: number; distanceYards: number } {
  let bestHole = 1;
  let bestDist = Infinity;

  for (const hole of course.holes) {
    let minHoleDist = distanceYards(player, hole.tee);
    minHoleDist = Math.min(minHoleDist, distanceYards(player, hole.green.center));
    for (let i = 1; i < hole.centerline.length; i++) {
      minHoleDist = Math.min(
        minHoleDist,
        pointToSegmentDistYards(player, hole.centerline[i - 1], hole.centerline[i])
      );
    }
    if (minHoleDist < bestDist) {
      bestDist = minHoleDist;
      bestHole = hole.holeNumber;
    }
  }

  return { holeNumber: bestHole, distanceYards: Math.round(bestDist) };
}

export function isOnCourse(player: LatLng, course: CourseGpsData): boolean {
  return distanceYards(player, course.center) <= 2500;
}
