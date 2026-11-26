import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import {
  GpsMode,
  GreenDistances,
  HazardDistanceResult,
  HoleGpsData,
  LatLng,
  LayupMeasurement,
  MapOrientation,
  SatelliteSource,
} from '../types';
import {
  bearingDegrees,
  buildDistanceArcsGeoJson,
  destinationPoint,
  distanceYards,
} from '../utils/geo';

export interface CameraCommand {
  type: 'fit-hole' | 'zoom-green';
  nonce: number;
}

interface SatelliteHoleMapProps {
  hole: HoleGpsData;
  playerPosition: LatLng;
  gpsMode: GpsMode;
  accuracyYards: number | null;
  targetPosition: LatLng | null;
  greenDistances: GreenDistances;
  layupMeasurement: LayupMeasurement | null;
  selectedHazard: HazardDistanceResult | null;
  orientation: MapOrientation;
  satelliteSource: SatelliteSource;
  showArcs: boolean;
  cameraCommand: CameraCommand;
  onTargetChange: (pos: LatLng) => void;
  onPreviewPlayerChange: (pos: LatLng) => void;
  onSelectHazard: (hazardId: string | null) => void;
}

function toLngLat(pt: LatLng): [number, number] {
  return [pt.lng, pt.lat];
}

function toClosedRing(pts: LatLng[]): [number, number][] {
  if (pts.length === 0) return [];
  const ring = pts.map(toLngLat);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function emptyFc(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function createTargetElement(): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'w-11 h-11 flex items-center justify-center cursor-grab active:cursor-grabbing select-none';
  wrap.style.touchAction = 'none';
  wrap.innerHTML = `
    <div class="relative w-8 h-8 rounded-full border-2 border-[#D4AF37] bg-[#143F27]/50 shadow-[0_0_12px_rgba(0,0,0,0.65)] flex items-center justify-center">
      <div class="w-2.5 h-2.5 rounded-full bg-white border border-[#143F27]"></div>
      <span class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-[#D4AF37]"></span>
      <span class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-[#D4AF37]"></span>
      <span class="absolute -left-1.5 top-1/2 -translate-y-1/2 h-0.5 w-2 bg-[#D4AF37]"></span>
      <span class="absolute -right-1.5 top-1/2 -translate-y-1/2 h-0.5 w-2 bg-[#D4AF37]"></span>
    </div>
  `;
  return wrap;
}

function createPlayerElement(mode: GpsMode): HTMLDivElement {
  const el = document.createElement('div');
  updatePlayerElement(el, mode);
  return el;
}

function updatePlayerElement(el: HTMLDivElement, mode: GpsMode) {
  el.style.touchAction = 'none';
  if (mode === 'live') {
    el.className = 'relative w-9 h-9 flex items-center justify-center pointer-events-none select-none';
    el.innerHTML = `
      <span class="gps-pulse-ring absolute w-7 h-7 rounded-full bg-sky-400/55"></span>
      <span class="relative w-4 h-4 rounded-full bg-sky-500 border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.6)]"></span>
    `;
  } else {
    el.className = 'relative w-11 h-11 flex items-center justify-center cursor-grab active:cursor-grabbing select-none';
    el.innerHTML = `
      <div class="relative flex flex-col items-center">
        <div class="px-1.5 py-0.5 rounded-full bg-[#2E8B57] border-2 border-white text-[9px] font-extrabold tracking-wider text-white shadow-[0_3px_10px_rgba(0,0,0,0.65)]">YOU</div>
        <div class="w-1.5 h-1.5 -mt-0.5 rotate-45 bg-white"></div>
      </div>
    `;
  }
}

function createPillElement(variant: 'leg1' | 'leg2' | 'arc' | 'hazard'): HTMLDivElement {
  const el = document.createElement('div');
  el.style.pointerEvents = 'none';
  if (variant === 'leg1') {
    el.className =
      'px-2 py-0.5 rounded-full bg-[#143F27]/95 text-white border border-white/40 font-mono text-[11px] font-bold shadow-lg whitespace-nowrap';
  } else if (variant === 'leg2') {
    el.className =
      'px-2 py-0.5 rounded-full bg-[#143F27]/95 text-[#F4E4C1] border border-[#D4AF37]/85 font-mono text-[11px] font-bold shadow-lg whitespace-nowrap';
  } else if (variant === 'arc') {
    el.className =
      'px-1.5 py-0.5 rounded bg-slate-950/75 text-white/95 border border-white/25 font-mono text-[10px] font-bold shadow whitespace-nowrap';
  } else {
    el.className =
      'px-2 py-0.5 rounded-full bg-amber-950/95 text-[#F4E4C1] border border-[#F4E4C1]/80 font-mono text-[10px] font-bold shadow-lg whitespace-nowrap';
  }
  return el;
}

export const SatelliteHoleMap: React.FC<SatelliteHoleMapProps> = ({
  hole,
  playerPosition,
  gpsMode,
  accuracyYards,
  targetPosition,
  greenDistances,
  layupMeasurement,
  selectedHazard,
  orientation,
  satelliteSource,
  showArcs,
  cameraCommand,
  onTargetChange,
  onPreviewPlayerChange,
  onSelectHazard,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapReadyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  const targetMarkerRef = useRef<maplibregl.Marker | null>(null);
  const playerMarkerRef = useRef<maplibregl.Marker | null>(null);
  const playerElRef = useRef<HTMLDivElement | null>(null);
  const leg1PillRef = useRef<maplibregl.Marker | null>(null);
  const leg2PillRef = useRef<maplibregl.Marker | null>(null);
  const hazardPillRef = useRef<maplibregl.Marker | null>(null);
  const arcLabelMarkersRef = useRef<maplibregl.Marker[]>([]);

  const isDraggingTargetRef = useRef(false);
  const isDraggingPlayerRef = useRef(false);
  const prevHoleNumberRef = useRef<number | null>(null);
  const prevOrientationRef = useRef<MapOrientation>(orientation);
  const prevCameraNonceRef = useRef<number>(cameraCommand.nonce);

  const onTargetChangeRef = useRef(onTargetChange);
  const onPreviewPlayerChangeRef = useRef(onPreviewPlayerChange);
  const onSelectHazardRef = useRef(onSelectHazard);
  const selectedHazardIdRef = useRef<string | null>(
    selectedHazard ? selectedHazard.hazard.id : null
  );

  onTargetChangeRef.current = onTargetChange;
  onPreviewPlayerChangeRef.current = onPreviewPlayerChange;
  onSelectHazardRef.current = onSelectHazard;
  selectedHazardIdRef.current = selectedHazard ? selectedHazard.hazard.id : null;

  const arcGeoJson = useMemo(() => {
    if (!showArcs) return emptyFc();
    const holeYards = distanceYards(hole.tee, hole.green.center);
    return buildDistanceArcsGeoJson(hole.green.center, hole.tee, holeYards);
  }, [hole.tee, hole.green.center, showArcs]);

  // Helper to fit camera to the active hole
  const fitHoleCamera = (
    map: maplibregl.Map,
    activeHole: HoleGpsData,
    pos: LatLng,
    orient: MapOrientation,
    immediate = false
  ) => {
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(toLngLat(activeHole.tee));
    bounds.extend(toLngLat(pos));
    bounds.extend(toLngLat(activeHole.green.center));
    for (const pt of activeHole.green.polygon) bounds.extend(toLngLat(pt));
    for (const pt of activeHole.centerline) bounds.extend(toLngLat(pt));
    for (const hz of activeHole.hazards) {
      for (const pt of hz.points) bounds.extend(toLngLat(pt));
    }

    const bearing =
      orient === 'tee-up'
        ? bearingDegrees(activeHole.tee, activeHole.green.center)
        : 0;

    map.fitBounds(bounds, {
      padding: { top: 96, bottom: 146, left: 106, right: 56 },
      bearing,
      pitch: 0,
      maxZoom: 18.2,
      linear: true,
      duration: immediate ? 0 : 600,
    });
  };

  const zoomToGreenCamera = (
    map: maplibregl.Map,
    activeHole: HoleGpsData,
    pos: LatLng,
    orient: MapOrientation
  ) => {
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(toLngLat(activeHole.green.center));
    for (const pt of activeHole.green.polygon) bounds.extend(toLngLat(pt));
    for (const hz of activeHole.hazards) {
      if (distanceYards(hz.center, activeHole.green.center) <= 48) {
        for (const pt of hz.points) bounds.extend(toLngLat(pt));
      }
    }

    const bearing =
      orient === 'tee-up'
        ? bearingDegrees(pos, activeHole.green.center)
        : 0;

    map.fitBounds(bounds, {
      padding: { top: 100, bottom: 150, left: 106, right: 58 },
      bearing,
      pitch: 0,
      maxZoom: 19.2,
      linear: true,
      duration: 550,
    });
  };

  // Initialize MapLibre instance once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: true,
      touchPitch: false,
      center: toLngLat(hole.green.center),
      zoom: 16.8,
      style: {
        version: 8,
        sources: {
          'esri-imagery': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
          },
          'usgs-imagery': {
            type: 'raster',
            tiles: [
              'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 16,
            attribution: 'Imagery © USGS National Map',
          },
        },
        layers: [
          {
            id: 'esri-layer',
            type: 'raster',
            source: 'esri-imagery',
            layout: {
              visibility: satelliteSource === 'esri' ? 'visible' : 'none',
            },
          },
          {
            id: 'usgs-layer',
            type: 'raster',
            source: 'usgs-imagery',
            layout: {
              visibility: satelliteSource === 'usgs' ? 'visible' : 'none',
            },
          },
        ],
      },
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    );

    // Create interactive Target Reticle Marker
    const targetEl = createTargetElement();
    const targetMarker = new maplibregl.Marker({
      element: targetEl,
      draggable: true,
      anchor: 'center',
    });
    targetMarker.on('dragstart', () => {
      isDraggingTargetRef.current = true;
    });
    targetMarker.on('drag', () => {
      const ll = targetMarker.getLngLat();
      onTargetChangeRef.current({ lat: ll.lat, lng: ll.lng });
    });
    targetMarker.on('dragend', () => {
      isDraggingTargetRef.current = false;
      const ll = targetMarker.getLngLat();
      onTargetChangeRef.current({ lat: ll.lat, lng: ll.lng });
    });
    targetMarkerRef.current = targetMarker;

    // Create Player Marker
    const playerEl = createPlayerElement(gpsMode);
    playerElRef.current = playerEl;
    const playerMarker = new maplibregl.Marker({
      element: playerEl,
      draggable: gpsMode === 'preview',
      anchor: 'center',
    })
      .setLngLat(toLngLat(playerPosition))
      .addTo(map);

    playerMarker.on('dragstart', () => {
      isDraggingPlayerRef.current = true;
    });
    playerMarker.on('drag', () => {
      const ll = playerMarker.getLngLat();
      onPreviewPlayerChangeRef.current({ lat: ll.lat, lng: ll.lng });
    });
    playerMarker.on('dragend', () => {
      isDraggingPlayerRef.current = false;
      const ll = playerMarker.getLngLat();
      onPreviewPlayerChangeRef.current({ lat: ll.lat, lng: ll.lng });
    });
    playerMarkerRef.current = playerMarker;

    // Create floating distance pill markers
    leg1PillRef.current = new maplibregl.Marker({
      element: createPillElement('leg1'),
      anchor: 'center',
    });
    leg2PillRef.current = new maplibregl.Marker({
      element: createPillElement('leg2'),
      anchor: 'center',
    });
    hazardPillRef.current = new maplibregl.Marker({
      element: createPillElement('hazard'),
      anchor: 'bottom',
      offset: [0, -8],
    });
    arcLabelMarkersRef.current = [0, 1, 2].map(
      () =>
        new maplibregl.Marker({
          element: createPillElement('arc'),
          anchor: 'center',
        })
    );

    map.on('load', () => {
      const empty = emptyFc();
      const sourceIds = [
        'accuracy-circle',
        'hole-tees',
        'distance-arcs',
        'hole-hazards',
        'hole-green',
        'green-fcb-dots',
        'target-lines',
        'selected-hazard-overlay',
      ];
      for (const id of sourceIds) {
        map.addSource(id, { type: 'geojson', data: empty });
      }

      map.addLayer({
        id: 'accuracy-fill',
        type: 'fill',
        source: 'accuracy-circle',
        paint: {
          'fill-color': '#38BDF8',
          'fill-opacity': 0.14,
        },
      });
      map.addLayer({
        id: 'accuracy-outline',
        type: 'line',
        source: 'accuracy-circle',
        paint: {
          'line-color': '#38BDF8',
          'line-opacity': 0.55,
          'line-width': 1.2,
        },
      });

      map.addLayer({
        id: 'tees-fill',
        type: 'fill',
        source: 'hole-tees',
        paint: {
          'fill-color': '#E9F5EC',
          'fill-opacity': 0.12,
        },
      });
      map.addLayer({
        id: 'tees-outline',
        type: 'line',
        source: 'hole-tees',
        paint: {
          'line-color': '#E9F5EC',
          'line-opacity': 0.5,
          'line-width': 1.2,
        },
      });

      map.addLayer({
        id: 'distance-arcs-line',
        type: 'line',
        source: 'distance-arcs',
        filter: ['==', ['get', 'kind'], 'arc'],
        paint: {
          'line-color': '#FFFFFF',
          'line-opacity': 0.58,
          'line-width': 1.4,
          'line-dasharray': [3, 3],
        },
      });

      map.addLayer({
        id: 'water-fill',
        type: 'fill',
        source: 'hole-hazards',
        filter: ['==', ['get', 'hazardType'], 'water'],
        paint: {
          'fill-color': '#38BDF8',
          'fill-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.38, 0.22],
        },
      });
      map.addLayer({
        id: 'water-outline',
        type: 'line',
        source: 'hole-hazards',
        filter: ['==', ['get', 'hazardType'], 'water'],
        paint: {
          'line-color': ['case', ['boolean', ['get', 'selected'], false], '#BAE6FD', '#38BDF8'],
          'line-width': ['case', ['boolean', ['get', 'selected'], false], 3, 1.8],
        },
      });

      map.addLayer({
        id: 'bunker-fill',
        type: 'fill',
        source: 'hole-hazards',
        filter: ['in', ['get', 'hazardType'], ['literal', ['fairway-bunker', 'greenside-bunker']]],
        paint: {
          'fill-color': '#F4E4C1',
          'fill-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.42, 0.22],
        },
      });
      map.addLayer({
        id: 'bunker-outline',
        type: 'line',
        source: 'hole-hazards',
        filter: ['in', ['get', 'hazardType'], ['literal', ['fairway-bunker', 'greenside-bunker']]],
        paint: {
          'line-color': ['case', ['boolean', ['get', 'selected'], false], '#FBBF24', '#F4E4C1'],
          'line-width': ['case', ['boolean', ['get', 'selected'], false], 3, 1.6],
        },
      });

      map.addLayer({
        id: 'creek-line',
        type: 'line',
        source: 'hole-hazards',
        filter: ['==', ['get', 'hazardType'], 'creek'],
        paint: {
          'line-color': ['case', ['boolean', ['get', 'selected'], false], '#BAE6FD', '#38BDF8'],
          'line-width': ['case', ['boolean', ['get', 'selected'], false], 4.2, 2.5],
          'line-dasharray': [2, 1.5],
        },
      });

      map.addLayer({
        id: 'green-fill',
        type: 'fill',
        source: 'hole-green',
        paint: {
          'fill-color': '#34D399',
          'fill-opacity': 0.22,
        },
      });
      map.addLayer({
        id: 'green-outline',
        type: 'line',
        source: 'hole-green',
        paint: {
          'line-color': '#34D399',
          'line-width': 2.2,
        },
      });

      map.addLayer({
        id: 'target-lines-direct',
        type: 'line',
        source: 'target-lines',
        filter: ['==', ['get', 'role'], 'direct'],
        paint: {
          'line-color': '#FFFFFF',
          'line-opacity': 0.55,
          'line-width': 1.6,
          'line-dasharray': [4, 4],
        },
      });
      map.addLayer({
        id: 'target-lines-leg1',
        type: 'line',
        source: 'target-lines',
        filter: ['==', ['get', 'role'], 'leg1'],
        paint: {
          'line-color': '#FFFFFF',
          'line-opacity': 0.92,
          'line-width': 2.2,
          'line-dasharray': [3, 2.5],
        },
      });
      map.addLayer({
        id: 'target-lines-leg2',
        type: 'line',
        source: 'target-lines',
        filter: ['==', ['get', 'role'], 'leg2'],
        paint: {
          'line-color': '#D4AF37',
          'line-opacity': 0.95,
          'line-width': 2.2,
          'line-dasharray': [3, 2.5],
        },
      });

      map.addLayer({
        id: 'selected-hazard-line',
        type: 'line',
        source: 'selected-hazard-overlay',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': '#FBBF24',
          'line-width': 2.2,
          'line-dasharray': [2, 2],
        },
      });
      map.addLayer({
        id: 'selected-hazard-pts',
        type: 'circle',
        source: 'selected-hazard-overlay',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 4.5,
          'circle-color': ['case', ['==', ['get', 'edge'], 'front'], '#F4E4C1', '#F59E0B'],
          'circle-stroke-color': '#143F27',
          'circle-stroke-width': 1.5,
        },
      });

      map.addLayer({
        id: 'green-fcb-circles',
        type: 'circle',
        source: 'green-fcb-dots',
        paint: {
          'circle-radius': ['match', ['get', 'role'], 'center', 5.5, 4],
          'circle-color': [
            'match',
            ['get', 'role'],
            'front',
            '#6EE7B7',
            'center',
            '#D4AF37',
            '#FFFFFF',
          ],
          'circle-stroke-color': '#143F27',
          'circle-stroke-width': 1.6,
        },
      });

      mapReadyRef.current = true;
      setMapReady(true);
      fitHoleCamera(map, hole, playerPosition, orientation, true);
      prevHoleNumberRef.current = hole.holeNumber;
    });

    // Tap map to select a hazard or place/move target reticle
    map.on('click', (e) => {
      const domTarget = e.originalEvent.target as HTMLElement | null;
      if (domTarget?.closest('.maplibregl-marker')) return;

      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - 8, e.point.y - 8],
        [e.point.x + 8, e.point.y + 8],
      ];
      const hitFeatures = map.queryRenderedFeatures(bbox, {
        layers: ['bunker-fill', 'water-fill', 'creek-line'],
      });

      if (hitFeatures.length > 0) {
        const hitId = hitFeatures[0].properties?.id as string | undefined;
        if (hitId) {
          onSelectHazardRef.current(
            selectedHazardIdRef.current === hitId ? null : hitId
          );
          return;
        }
      }

      onTargetChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    mapRef.current = map;

    return () => {
      mapReadyRef.current = false;
      targetMarker.remove();
      playerMarker.remove();
      leg1PillRef.current?.remove();
      leg2PillRef.current?.remove();
      hazardPillRef.current?.remove();
      arcLabelMarkersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Toggle Esri vs USGS raster visibility cleanly
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    if (map.getLayer('esri-layer')) {
      map.setLayoutProperty(
        'esri-layer',
        'visibility',
        satelliteSource === 'esri' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('usgs-layer')) {
      map.setLayoutProperty(
        'usgs-layer',
        'visibility',
        satelliteSource === 'usgs' ? 'visible' : 'none'
      );
    }
  }, [satelliteSource]);

  // Sync GeoJSON sources & HTML markers whenever hole/player/target/hazard state changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Update Player Marker appearance & position
    if (playerMarkerRef.current && playerElRef.current) {
      updatePlayerElement(playerElRef.current, gpsMode);
      playerMarkerRef.current.setDraggable(gpsMode === 'preview');
      if (!isDraggingPlayerRef.current) {
        playerMarkerRef.current.setLngLat(toLngLat(playerPosition));
      }
    }

    // Update Target Reticle Marker
    if (targetMarkerRef.current) {
      if (targetPosition) {
        if (!isDraggingTargetRef.current) {
          targetMarkerRef.current.setLngLat(toLngLat(targetPosition));
        }
        targetMarkerRef.current.addTo(map);
      } else {
        targetMarkerRef.current.remove();
      }
    }

    // Update Layup / Target Pill Markers
    if (targetPosition && layupMeasurement && leg1PillRef.current && leg2PillRef.current) {
      leg1PillRef.current.getElement().textContent = `${layupMeasurement.toTargetYards}y`;
      leg1PillRef.current.setLngLat(toLngLat(layupMeasurement.leg1Midpoint)).addTo(map);

      leg2PillRef.current.getElement().textContent = `${layupMeasurement.targetToGreenYards}y`;
      leg2PillRef.current.setLngLat(toLngLat(layupMeasurement.leg2Midpoint)).addTo(map);
    } else {
      leg1PillRef.current?.remove();
      leg2PillRef.current?.remove();
    }

    // Update Arc Label Markers
    const arcLabelFeatures = arcGeoJson.features.filter(
      (f) => f.properties?.kind === 'arc-label' && f.geometry.type === 'Point'
    );
    arcLabelMarkersRef.current.forEach((marker, idx) => {
      const feat = arcLabelFeatures[idx];
      if (feat && feat.geometry.type === 'Point') {
        marker.getElement().textContent = String(feat.properties?.label ?? '');
        marker
          .setLngLat(feat.geometry.coordinates as [number, number])
          .addTo(map);
      } else {
        marker.remove();
      }
    });

    // Update Selected Hazard Pill Marker
    if (selectedHazard && hazardPillRef.current) {
      const text = selectedHazard.isCrossing
        ? `Cross ${selectedHazard.frontYards}y`
        : selectedHazard.frontYards === selectedHazard.carryYards
        ? `${selectedHazard.frontYards}y`
        : `F ${selectedHazard.frontYards}y · C ${selectedHazard.carryYards}y`;
      hazardPillRef.current.getElement().textContent = text;
      hazardPillRef.current
        .setLngLat(toLngLat(selectedHazard.frontPoint))
        .addTo(map);
    } else {
      hazardPillRef.current?.remove();
    }

    if (!mapReadyRef.current) return;

    const setSource = (id: string, data: GeoJSON.FeatureCollection) => {
      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      src?.setData(data);
    };

    // 1. Accuracy circle
    if (gpsMode === 'live' && accuracyYards && accuracyYards > 1) {
      const ring: [number, number][] = [];
      for (let deg = 0; deg <= 360; deg += 15) {
        const pt = destinationPoint(playerPosition, deg, accuracyYards);
        ring.push(toLngLat(pt));
      }
      setSource('accuracy-circle', {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [ring] },
          },
        ],
      });
    } else {
      setSource('accuracy-circle', emptyFc());
    }

    // 2. Tees
    setSource('hole-tees', {
      type: 'FeatureCollection',
      features: hole.teePolygons.map((poly) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [toClosedRing(poly)] },
      })),
    });

    // 3. Distance arcs
    setSource('distance-arcs', arcGeoJson);

    // 4. Hazards
    const selectedId = selectedHazard?.hazard.id ?? null;
    setSource('hole-hazards', {
      type: 'FeatureCollection',
      features: hole.hazards.map((hz) => ({
        type: 'Feature',
        properties: {
          id: hz.id,
          hazardType: hz.type,
          selected: hz.id === selectedId,
        },
        geometry:
          hz.geometryType === 'polygon'
            ? { type: 'Polygon', coordinates: [toClosedRing(hz.points)] }
            : { type: 'LineString', coordinates: hz.points.map(toLngLat) },
      })),
    });

    // 5. Green polygon
    setSource('hole-green', {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [toClosedRing(hole.green.polygon)],
          },
        },
      ],
    });

    // 6. Green Front / Center / Back dots
    setSource('green-fcb-dots', {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { role: 'front' },
          geometry: { type: 'Point', coordinates: toLngLat(greenDistances.frontPoint) },
        },
        {
          type: 'Feature',
          properties: { role: 'center' },
          geometry: { type: 'Point', coordinates: toLngLat(hole.green.center) },
        },
        {
          type: 'Feature',
          properties: { role: 'back' },
          geometry: { type: 'Point', coordinates: toLngLat(greenDistances.backPoint) },
        },
      ],
    });

    // 7. Target / Sight lines
    if (targetPosition) {
      setSource('target-lines', {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { role: 'leg1' },
            geometry: {
              type: 'LineString',
              coordinates: [toLngLat(playerPosition), toLngLat(targetPosition)],
            },
          },
          {
            type: 'Feature',
            properties: { role: 'leg2' },
            geometry: {
              type: 'LineString',
              coordinates: [toLngLat(targetPosition), toLngLat(hole.green.center)],
            },
          },
        ],
      });
    } else {
      setSource('target-lines', {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { role: 'direct' },
            geometry: {
              type: 'LineString',
              coordinates: [toLngLat(playerPosition), toLngLat(hole.green.center)],
            },
          },
        ],
      });
    }

    // 8. Selected hazard measurement line + dots
    if (selectedHazard) {
      const lineCoords = selectedHazard.isCrossing
        ? [toLngLat(playerPosition), toLngLat(selectedHazard.frontPoint)]
        : [
            toLngLat(playerPosition),
            toLngLat(selectedHazard.frontPoint),
            toLngLat(selectedHazard.carryPoint),
          ];
      const features: GeoJSON.Feature[] = [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: lineCoords },
        },
        {
          type: 'Feature',
          properties: { edge: 'front' },
          geometry: { type: 'Point', coordinates: toLngLat(selectedHazard.frontPoint) },
        },
      ];
      if (!selectedHazard.isCrossing) {
        features.push({
          type: 'Feature',
          properties: { edge: 'carry' },
          geometry: { type: 'Point', coordinates: toLngLat(selectedHazard.carryPoint) },
        });
      }
      setSource('selected-hazard-overlay', {
        type: 'FeatureCollection',
        features,
      });
    } else {
      setSource('selected-hazard-overlay', emptyFc());
    }
  }, [
    mapReady,
    hole,
    playerPosition,
    gpsMode,
    accuracyYards,
    targetPosition,
    greenDistances,
    layupMeasurement,
    selectedHazard,
    arcGeoJson,
    satelliteSource,
  ]);

  // Reframe camera when hole changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    if (prevHoleNumberRef.current !== hole.holeNumber) {
      prevHoleNumberRef.current = hole.holeNumber;
      fitHoleCamera(map, hole, playerPosition, orientation, false);
    }
  }, [hole.holeNumber, orientation, playerPosition]);

  // Smoothly rotate bearing when orientation toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    if (prevOrientationRef.current !== orientation) {
      prevOrientationRef.current = orientation;
      const bearing =
        orientation === 'tee-up'
          ? bearingDegrees(hole.tee, hole.green.center)
          : 0;
      map.easeTo({ bearing, duration: 480 });
    }
  }, [orientation, hole]);

  // Imperative camera commands (Recenter Hole / Zoom to Green)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    if (prevCameraNonceRef.current === cameraCommand.nonce) return;
    prevCameraNonceRef.current = cameraCommand.nonce;

    if (cameraCommand.type === 'fit-hole') {
      fitHoleCamera(map, hole, playerPosition, orientation, false);
    } else {
      zoomToGreenCamera(map, hole, playerPosition, orientation);
    }
  }, [cameraCommand, hole, playerPosition, orientation]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full bg-[#0D2B1A]"
      aria-label={`Satellite map of Norbeck Country Club Hole ${hole.holeNumber}`}
    />
  );
};
