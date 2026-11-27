import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerCode from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';
import 'maplibre-gl/dist/maplibre-gl.css';
import './gps.css';
import { GpsApp } from './GpsApp';

// Inline the MapLibre v6 worker so single-file standalone builds never 404 on maplibre-gl-worker.mjs
const cleanedWorkerCode = maplibreWorkerCode
  .replace(/\bexport\s*\{[^}]*\};?\s*/g, '')
  .replace(/\/\/#\s*sourceMappingURL=.*$/gm, '');
const workerBlob = new Blob([cleanedWorkerCode], { type: 'text/javascript' });
maplibregl.setWorkerUrl(URL.createObjectURL(workerBlob));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GpsApp />
  </StrictMode>
);
