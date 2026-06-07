'use client';

import { useState, useRef, useCallback } from 'react';

export interface CameraState {
  isAvailable: boolean;
  hasPermission: boolean;
  isStreaming: boolean;
  error: string | null;
  activeFacingMode: 'user' | 'environment';
}

export interface CaptureOptions {
  facingMode?: 'user' | 'environment';
  resolution?: 'low' | 'medium' | 'high';
}

export interface CaptureResult {
  image: string; // Data URL
  blob: Blob;
  timestamp: number;
  dimensions: { width: number; height: number };
}

const RESOLUTIONS = {
  low: { width: 640, height: 480 },
  medium: { width: 1280, height: 720 },
  high: { width: 1920, height: 1080 },
};

async function logDeviceInfo(stream: MediaStream, requestedFacingMode: string) {
  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings() ?? {};

  let deviceLabels: { id: string; label: string }[] = [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    deviceLabels = devices
      .filter((d) => d.kind === 'videoinput')
      .map((d) => ({ id: d.deviceId.slice(0, 8), label: d.label || '(unlabeled)' }));
  } catch {}

  console.log('[Camera] Available video devices:', deviceLabels);
  console.log('[Camera] Selected device:', track?.label ?? '(unknown)');
  console.log('[Camera] FacingMode requested:', requestedFacingMode);
  console.log('[Camera] FacingMode actual:', (settings as any).facingMode ?? '(not reported)');
  console.log(
    '[Camera] Active stream tracks:',
    stream.getVideoTracks().map((t) => t.label),
  );
}

export function useCameraCapture() {
  const [state, setState] = useState<CameraState>({
    isAvailable: false,
    hasPermission: false,
    isStreaming: false,
    error: null,
    activeFacingMode: 'environment',
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Tracks which facing mode is currently active so switchCamera knows what to toggle to
  const activeFacingModeRef = useRef<'user' | 'environment'>('environment');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const requestPermission = useCallback(
    async (options: CaptureOptions = {}): Promise<boolean> => {
      // Default to rear camera — front camera (user) is useless for vehicle photography
      const { facingMode = 'environment', resolution = 'medium' } = options;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            // Use { ideal } so browsers without a rear camera (desktop) fall back gracefully
            facingMode: { ideal: facingMode },
            width: { ideal: RESOLUTIONS[resolution].width },
            height: { ideal: RESOLUTIONS[resolution].height },
            aspectRatio: { ideal: 4 / 3 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        activeFacingModeRef.current = facingMode;

        await logDeviceInfo(stream, facingMode);

        const hasVideoTrack = stream.getVideoTracks().length > 0;
        setState({
          isAvailable: true,
          hasPermission: hasVideoTrack,
          isStreaming: false,
          error: null,
          activeFacingMode: facingMode,
        });

        return hasVideoTrack;
      } catch (error: any) {
        let errorMessage = 'Camera access denied or unavailable';
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Camera access denied. Please enable camera permissions.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is being used by another application.';
        }

        setState({
          isAvailable: true,
          hasPermission: false,
          isStreaming: false,
          error: errorMessage,
          activeFacingMode: facingMode,
        });

        return false;
      }
    },
    [],
  );

  const startStream = useCallback(
    async (videoElement: HTMLVideoElement): Promise<boolean> => {
      console.log('[Camera] startStream called');

      if (!streamRef.current) {
        console.log('[Camera] No existing stream, requesting permission...');
        const hasPermission = await requestPermission();
        if (!hasPermission) {
          console.log('[Camera] Permission not granted');
          return false;
        }
      }

      if (videoElement && streamRef.current) {
        console.log('[Camera] Assigning stream to video element');
        videoElement.srcObject = streamRef.current;

        try {
          await videoElement.play();
          console.log('[Camera] play() succeeded, dimensions:', {
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
          });

          setState((prev) => ({ ...prev, isStreaming: true, error: null }));
          return true;
        } catch (error) {
          console.error('[Camera] play() failed:', error);
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: 'Failed to start video stream',
          }));
          return false;
        }
      }

      console.warn('[Camera] startStream: no video element or stream available');
      return false;
    },
    [requestPermission],
  );

  // Switch between front and rear camera without a page reload
  const switchCamera = useCallback(async (): Promise<boolean> => {
    const newFacingMode =
      activeFacingModeRef.current === 'environment' ? 'user' : 'environment';

    console.log('[Camera] Switching camera to facingMode:', newFacingMode);

    // Stop current tracks before opening the new camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: newFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      activeFacingModeRef.current = newFacingMode;

      await logDeviceInfo(stream, newFacingMode);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setState((prev) => ({
        ...prev,
        activeFacingMode: newFacingMode,
        isStreaming: true,
        error: null,
      }));

      return true;
    } catch (error: any) {
      console.error('[Camera] Failed to switch camera:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to switch camera. Your device may not support this.',
      }));
      return false;
    }
  }, []);

  const captureImage = useCallback(async (): Promise<CaptureResult> => {
    if (!videoRef.current || !streamRef.current) {
      throw new Error('Camera is not streaming');
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL('image/jpeg', 0.95);
    const response = await fetch(image);
    const blob = await response.blob();

    canvasRef.current = canvas;

    return {
      image,
      blob,
      timestamp: Date.now(),
      dimensions: { width: canvas.width, height: canvas.height },
    };
  }, []);

  const getPermissionStatus = useCallback(async (): Promise<boolean> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some((d) => d.kind === 'videoinput');
    } catch {
      return false;
    }
  }, []);

  const getCameras = useCallback(async (): Promise<{ id: string; label: string }[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({
          id: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
        }));
    } catch {
      return [];
    }
  }, []);

  const reset = useCallback(() => {
    stopStream();
    setState({
      isAvailable: false,
      hasPermission: false,
      isStreaming: false,
      error: null,
      activeFacingMode: 'environment',
    });
    activeFacingModeRef.current = 'environment';
  }, [stopStream]);

  return {
    state,
    videoRef,
    canvasRef,
    requestPermission,
    startStream,
    stopStream,
    switchCamera,
    captureImage,
    getPermissionStatus,
    getCameras,
    reset,
  };
}
