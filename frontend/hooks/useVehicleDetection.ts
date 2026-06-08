'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface ValidationResult {
  vehicleDetected: boolean;
  vehicleSize: number;      // 0-1 fraction of frame covered
  vehicleCentered: boolean;
  wheelsVisible: boolean;
  horizonLevel: boolean;
  cameraAngle: 'flat' | 'up' | 'down';
}

const VEHICLE_CLASSES = new Set(['car', 'truck', 'bus', 'motorcycle']);

// Interval between inference runs (ms). 1500ms is a good balance for mobile.
const INFERENCE_INTERVAL = 1500;

export function useVehicleDetection(enabled: boolean) {
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const modelRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const runInference = useCallback(async () => {
    const video = videoRef.current;
    if (!modelRef.current || !video || video.readyState < 2) return;

    try {
      const predictions: Array<{
        class: string;
        score: number;
        bbox: [number, number, number, number]; // x, y, w, h
      }> = await modelRef.current.detect(video);

      const vehicles = predictions.filter(
        (p) => VEHICLE_CLASSES.has(p.class) && p.score > 0.35
      );

      if (vehicles.length === 0) {
        setValidationResult({
          vehicleDetected: false,
          vehicleSize: 0,
          vehicleCentered: false,
          wheelsVisible: false,
          horizonLevel: true,
          cameraAngle: 'flat',
        });
        return;
      }

      // Use the highest-confidence vehicle detection
      const best = vehicles.reduce((a, b) => (a.score > b.score ? a : b));
      const [bx, by, bw, bh] = best.bbox;

      const frameW = video.videoWidth || video.clientWidth;
      const frameH = video.videoHeight || video.clientHeight;

      const vehicleSize = (bw * bh) / (frameW * frameH);

      const vehicleCenterX = bx + bw / 2;
      const vehicleCenterY = by + bh / 2;
      const frameCenterX = frameW / 2;
      const frameCenterY = frameH / 2;

      // Allow ±20% off-center
      const centerTolerance = 0.20;
      const vehicleCentered =
        Math.abs(vehicleCenterX - frameCenterX) / frameW < centerTolerance &&
        Math.abs(vehicleCenterY - frameCenterY) / frameH < centerTolerance;

      setValidationResult({
        vehicleDetected: true,
        vehicleSize,
        vehicleCentered,
        wheelsVisible: true,      // COCO-SSD can't detect wheels; assume visible
        horizonLevel: true,       // Tilt detection requires device sensors
        cameraAngle: 'flat',
      });
    } catch {
      // Inference errors are non-fatal; just skip this frame
    }
  }, []);

  // Load model lazily when enabled
  useEffect(() => {
    if (!enabled || modelRef.current || modelLoading) return;

    let cancelled = false;
    setModelLoading(true);

    (async () => {
      try {
        // Dynamic imports keep TF.js out of the initial bundle
        const [tf, cocoSsd] = await Promise.all([
          import('@tensorflow/tfjs'),
          import('@tensorflow-models/coco-ssd'),
        ]);
        // Use the lightweight CPU backend on mobile
        await tf.setBackend('cpu');
        await tf.ready();
        if (cancelled) return;
        modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        if (cancelled) return;
        setModelReady(true);
      } catch (e) {
        console.warn('[VehicleDetection] Failed to load model:', e);
      } finally {
        if (!cancelled) setModelLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [enabled, modelLoading]);

  // Start/stop inference loop when model is ready
  useEffect(() => {
    if (!modelReady || !enabled) {
      stopDetection();
      return;
    }
    intervalRef.current = setInterval(runInference, INFERENCE_INTERVAL);
    return stopDetection;
  }, [modelReady, enabled, runInference, stopDetection]);

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
  }, []);

  return { modelLoading, modelReady, validationResult, attachVideo, stopDetection };
}
