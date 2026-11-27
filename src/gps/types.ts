export interface LatLng {
  lat: number;
  lng: number;
}

export type TeeName = 'black' | 'blue' | 'white' | 'gold' | 'forward';

export type HazardType =
  | 'fairway-bunker'
  | 'greenside-bunker'
  | 'water'
  | 'creek';

export interface HazardFeature {
  id: string;
  type: HazardType;
  label: string;
  side: 'L' | 'R' | 'C';
  geometryType: 'polygon' | 'polyline';
  points: LatLng[];
  center: LatLng;
}

export interface HoleGpsData {
  holeNumber: number;
  par: number;
  handicap: number;
  yardages: Record<TeeName, number>;
  tee: LatLng;
  teePolygons: LatLng[][];
  centerline: LatLng[];
  defaultTarget: LatLng | null;
  green: {
    center: LatLng;
    polygon: LatLng[];
  };
  hazards: HazardFeature[];
}

export interface TeeMeta {
  label: string;
  color: string;
  yards: number;
  rating: number;
  slope: number;
}

export interface CourseVectorPolygon {
  id: string;
  holeNumber: number | null;
  points: LatLng[];
}

export interface CourseMapVectors {
  boundary: LatLng[];
  woods: LatLng[][];
  fairways: CourseVectorPolygon[];
  greens: CourseVectorPolygon[];
  tees: CourseVectorPolygon[];
  bunkers: CourseVectorPolygon[];
  waters: LatLng[][];
  streams: LatLng[][];
  cartpaths: LatLng[][];
  drivingRange: LatLng[] | null;
  clubhouse: LatLng[] | null;
  pools: LatLng[][];
  roads: LatLng[][];
}

export interface CourseGpsData {
  id: string;
  name: string;
  location: string;
  address: string;
  center: LatLng;
  parTotal: number;
  teeInfo: Record<TeeName, TeeMeta>;
  holes: HoleGpsData[];
  vectors: CourseMapVectors;
}

export interface GreenDistances {
  onGreen: boolean;
  frontYards: number;
  centerYards: number;
  backYards: number;
  depthYards: number;
  frontPoint: LatLng;
  backPoint: LatLng;
}

export interface HazardDistanceResult {
  hazard: HazardFeature;
  frontYards: number;
  carryYards: number;
  frontPoint: LatLng;
  carryPoint: LatLng;
  isCrossing: boolean;
  isAhead: boolean;
  isPassed: boolean;
}

export interface LayupMeasurement {
  toTargetYards: number;
  targetToGreenYards: number;
  totalYards: number;
  leg1Midpoint: LatLng;
  leg2Midpoint: LatLng;
}

export type GpsMode = 'live' | 'preview';
export type MapOrientation = 'tee-up' | 'north-up';
export type MapStyle = 'digital' | 'esri' | 'usgs';

export type FairwayResult = 'left' | 'hit' | 'right';

export interface HoleScoreEntry {
  holeNumber: number;
  gross: number | null;
  putts: number | null;
  fairway: FairwayResult | null;
  gir: boolean | null;
  girManual?: boolean;
  sand: boolean;
  penalties: number;
}

export interface ActiveGpsRound {
  id: string;
  courseId: string;
  startedAt: string;
  tee: TeeName;
  holes: Record<number, HoleScoreEntry>;
}

export interface SavedGpsRound extends ActiveGpsRound {
  completedAt: string;
  handicapIndex: number | null;
  courseHandicap: number | null;
  grossTotal: number;
  adjustedGrossTotal: number;
  netTotal: number | null;
  toPar: number;
  holesPlayed: number;
  differential: number | null;
  puttsTotal: number | null;
  firHit: number;
  firTracked: number;
  girHit: number;
  girTracked: number;
}

export interface HoleComputedSummary {
  holeNumber: number;
  par: number;
  handicap: number;
  yardage: number;
  entry: HoleScoreEntry;
  strokes: number | null;
  ndbMax: number;
  adjustedGross: number | null;
  ndbCapped: boolean;
  net: number | null;
  toPar: number | null;
  girEffective: boolean | null;
}

export interface NineSummary {
  holesPlayed: number;
  parTotal: number;
  parForPlayed: number;
  grossTotal: number;
  adjustedGrossTotal: number;
  netTotal: number | null;
  puttsTotal: number | null;
}

export interface RoundComputedSummary {
  teeMeta: TeeMeta;
  hasHandicap: boolean;
  courseHandicap: number | null;
  holes: HoleComputedSummary[];
  frontNine: NineSummary;
  backNine: NineSummary;
  holesPlayed: number;
  grossTotal: number;
  parForPlayed: number;
  toPar: number;
  adjustedGrossTotal: number;
  netTotal: number | null;
  ndbCappedHoles: HoleComputedSummary[];
  differential: number | null;
  isNineHoleComplete: boolean;
  puttsTotal: number | null;
  puttsHoles: number;
  firHit: number;
  firTracked: number;
  girHit: number;
  girTracked: number;
  sandCount: number;
  penaltiesTotal: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublesPlus: number;
}
