import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './gps.css';
import { GpsApp } from './GpsApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GpsApp />
  </StrictMode>
);
