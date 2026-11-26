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

export interface CourseGpsData {
  id: string;
  name: string;
  location: string;
  address: string;
  center: LatLng;
  parTotal: number;
  teeInfo: Record<TeeName, TeeMeta>;
  holes: HoleGpsData[];
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
export type SatelliteSource = 'esri' | 'usgs';
