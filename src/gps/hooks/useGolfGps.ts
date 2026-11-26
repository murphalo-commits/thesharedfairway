import { useCallback, useEffect, useRef, useState } from 'react';
import { CourseGpsData, GpsMode, HoleGpsData, LatLng } from '../types';
import { YARDS_PER_METER, isOnCourse } from '../utils/geo';

export type GpsStatus =
  | 'idle'
  | 'acquiring'
  | 'active'
  | 'off-course'
  | 'denied'
  | 'unavailable';

export interface UseGolfGpsResult {
  gpsMode: GpsMode;
  status: GpsStatus;
  rawPosition: LatLng | null;
  activePosition: LatLng;
  previewPosition: LatLng;
  accuracyYards: number | null;
  heading: number | null;
  wakeLockActive: boolean;
  switchToLive: () => void;
  switchToPreview: () => void;
  setPreviewPosition: (pos: LatLng) => void;
  resetPreviewToTee: (hole: HoleGpsData) => void;
}

export function useGolfGps(
  course: CourseGpsData,
  activeHole: HoleGpsData
): UseGolfGpsResult {
  const [gpsMode, setGpsMode] = useState<GpsMode>('preview');
  const [status, setStatus] = useState<GpsStatus>(() =>
    typeof navigator !== 'undefined' && 'geolocation' in navigator
      ? 'acquiring'
      : 'unavailable'
  );
  const [rawPosition, setRawPosition] = useState<LatLng | null>(null);
  const [accuracyYards, setAccuracyYards] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [previewOverride, setPreviewOverride] = useState<{
    holeNumber: number;
    pos: LatLng;
  } | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const manualPreviewOverrideRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const previewPosition =
    previewOverride && previewOverride.holeNumber === activeHole.holeNumber
      ? previewOverride.pos
      : activeHole.tee;

  // High-accuracy Geolocation watcher
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unavailable');
      setGpsMode('preview');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const nextPos: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const accYds =
          typeof pos.coords.accuracy === 'number' && !Number.isNaN(pos.coords.accuracy)
            ? Math.round(pos.coords.accuracy * YARDS_PER_METER)
            : null;
        const hdg =
          typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)
            ? pos.coords.heading
            : null;

        setRawPosition(nextPos);
        setAccuracyYards(accYds);
        setHeading(hdg);

        if (isOnCourse(nextPos, course)) {
          setStatus('active');
          if (!manualPreviewOverrideRef.current) {
            setGpsMode('live');
          }
        } else {
          setStatus('off-course');
          setGpsMode('preview');
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('denied');
        } else {
          setStatus('unavailable');
        }
        setGpsMode('preview');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1500,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [course]);

  // Screen Wake Lock while in Live GPS mode
  useEffect(() => {
    let cancelled = false;

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch {
          // Ignore release errors on browsers that auto-release
        }
        wakeLockRef.current = null;
      }
      if (!cancelled) setWakeLockActive(false);
    };

    const requestWakeLock = async () => {
      if (
        gpsMode !== 'live' ||
        typeof navigator === 'undefined' ||
        !('wakeLock' in navigator) ||
        document.visibilityState !== 'visible'
      ) {
        await releaseWakeLock();
        return;
      }
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        sentinel.addEventListener('release', () => {
          if (!cancelled) setWakeLockActive(false);
        });
      } catch {
        if (!cancelled) setWakeLockActive(false);
      }
    };

    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && gpsMode === 'live') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseWakeLock();
    };
  }, [gpsMode]);

  const switchToLive = useCallback(() => {
    manualPreviewOverrideRef.current = false;
    if (rawPosition && isOnCourse(rawPosition, course)) {
      setGpsMode('live');
      setStatus('active');
    } else if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setStatus((prev) => (prev === 'denied' ? 'denied' : 'acquiring'));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nextPos: LatLng = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setRawPosition(nextPos);
          setAccuracyYards(
            typeof pos.coords.accuracy === 'number'
              ? Math.round(pos.coords.accuracy * YARDS_PER_METER)
              : null
          );
          if (isOnCourse(nextPos, course)) {
            setStatus('active');
            setGpsMode('live');
          } else {
            setStatus('off-course');
            setGpsMode('preview');
          }
        },
        (err) => {
          setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
          setGpsMode('preview');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, [course, rawPosition]);

  const switchToPreview = useCallback(() => {
    manualPreviewOverrideRef.current = true;
    setGpsMode('preview');
  }, []);

  const setPreviewPosition = useCallback(
    (pos: LatLng) => {
      setPreviewOverride({ holeNumber: activeHole.holeNumber, pos });
    },
    [activeHole.holeNumber]
  );

  const resetPreviewToTee = useCallback((hole: HoleGpsData) => {
    setPreviewOverride({ holeNumber: hole.holeNumber, pos: hole.tee });
  }, []);

  const activePosition =
    gpsMode === 'live' && rawPosition ? rawPosition : previewPosition;

  return {
    gpsMode,
    status,
    rawPosition,
    activePosition,
    previewPosition,
    accuracyYards,
    heading,
    wakeLockActive,
    switchToLive,
    switchToPreview,
    setPreviewPosition,
    resetPreviewToTee,
  };
}
