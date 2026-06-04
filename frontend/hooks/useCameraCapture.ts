'use client';

import { useState, useRef, useCallback } from 'react';

export interface CameraState {
  isAvailable: boolean;
  hasPermission: boolean;
  isStreaming: boolean;
  error: string | null;
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

export function useCameraCapture() {
  const [state, setState] = useState<CameraState>({
    isAvailable: false,
    hasPermission: false,
    isStreaming: false,
    error: null,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Check if camera is available
  const checkCameraAvailability = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }
    return true;
  }, []);

  // Request camera permission
  const requestPermission = useCallback(
    async (options: CaptureOptions = {}): Promise<boolean> => {
      const { facingMode = 'user', resolution = 'medium' } = options;

      if (streamRef.current) {
        stopStream();
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: RESOLUTIONS[resolution].width },
            height: { ideal: RESOLUTIONS[resolution].height },
            aspectRatio: { ideal: 4 / 3 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        // Test if we can get tracks
        const hasVideoTrack = stream.getVideoTracks().length > 0;
        setState({
          isAvailable: true,
          hasPermission: hasVideoTrack,
          isStreaming: false,
          error: null,
        });

        return hasVideoTrack;
      } catch (error: any) {
        let errorMessage = 'Camera access denied or unavailable';
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please enable camera permissions.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is being used by another application.';
        } else if (error.name === 'PermissionDeniedError') {
          errorMessage = 'Please enable camera permissions in your browser settings.';
        }

        setState({
          isAvailable: true,
          hasPermission: false,
          isStreaming: false,
          error: errorMessage,
        });

        return false;
      }
    },
    []
  );

  // Start camera stream
  const startStream = useCallback(
    async (videoElement: HTMLVideoElement): Promise<boolean> => {
      if (!streamRef.current) {
        const hasPermission = await requestPermission();
        if (!hasPermission) return false;
      }

      if (videoElement && streamRef.current) {
        videoElement.srcObject = streamRef.current;
        try {
          await videoElement.play();
          setState((prev) => ({
            ...prev,
            isStreaming: true,
            error: null,
          }));
          return true;
        } catch (error) {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: 'Failed to start video stream',
          }));
          return false;
        }
      }
      return false;
    },
    [requestPermission]
  );

  // Stop camera stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState((prev) => ({
      ...prev,
      isStreaming: false,
    }));
  }, []);

  // Capture image from camera
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

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image as data URL
    const image = canvas.toDataURL('image/jpeg', 0.95);

    // Convert to blob
    const response = await fetch(image);
    const blob = await response.blob();

    // Store reference to canvas for reuse
    canvasRef.current = canvas;

    return {
      image,
      blob,
      timestamp: Date.now(),
      dimensions: {
        width: canvas.width,
        height: canvas.height,
      },
    };
  }, []);

  // Check for camera permission status
  const getPermissionStatus = useCallback(async (): Promise<boolean> => {
    try {
      // Try to query permission without actually requesting it
      // Note: This only works in some browsers
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some((d) => d.kind === 'videoinput');
      return hasCamera;
    } catch {
      return false;
    }
  }, []);

  // Get available cameras
  const getCameras = useCallback(async (): Promise<{ id: string; label: string }[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({
          id: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
        }));
      return cameras;
    } catch {
      return [];
    }
  }, []);

  // Reset hook state
  const reset = useCallback(() => {
    stopStream();
    setState({
      isAvailable: false,
      hasPermission: false,
      isStreaming: false,
      error: null,
    });
  }, [stopStream]);

  return {
    state,
    videoRef,
    canvasRef,
    requestPermission,
    startStream,
    stopStream,
    captureImage,
    getPermissionStatus,
    getCameras,
    reset,
  };
}