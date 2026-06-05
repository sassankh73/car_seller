'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import GuidedCaptureOverlay, {
  CAPTURE_STEPS,
  getFeedbackMessage,
  FeedbackMessage,
} from './GuidedCaptureOverlay';
import { useTranslations } from 'next-intl';

// Result image data interface (matches CaptureResult from useCameraCapture)
interface CapturedImage {
  image: string; // Data URL
  blob: Blob;
  stepIndex: number;
  timestamp: number;
}

export default function GuidedCapture({
  onCaptureComplete,
  onCancel,
}: {
  onCaptureComplete: (images: CapturedImage[]) => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const {
    state,
    videoRef,
    requestPermission,
    startStream,
    stopStream,
    captureImage,
    reset,
  } = useCameraCapture();

  // Step tracking
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isWaitingForValidation, setIsWaitingForValidation] = useState(false);

  // Feedback messages
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

  // Debug state for video element
  const [videoDebug, setVideoDebug] = useState({
    streaming: false,
    readyState: 0,
    videoWidth: 0,
    videoHeight: 0,
    paused: true,
    srcObjectExists: false,
  });

  // Check for camera availability on mount
  useEffect(() => {
    const checkCamera = async () => {
      const available = await requestPermission();
      if (available) {
        await startStream(videoRef.current!);
      }
    };
    checkCamera();
    return () => {
      stopStream();
      reset();
    };
  }, [requestPermission, startStream, stopStream, reset]);

  // Handle feedback based on validation
  useEffect(() => {
    const message = getFeedbackMessage(
      currentStepIndex,
      isWaitingForValidation,
      validationResult
    );
    setFeedback(message);
  }, [currentStepIndex, isWaitingForValidation, validationResult]);

  const handleStartCamera = async () => {
    const hasPermission = await requestPermission();
    if (hasPermission) {
      await startStream(videoRef.current!);
    }
  };

  const handleCapture = async () => {
    if (isCapturing) return;

    setIsWaitingForValidation(true);
    setValidationResult(null);

    try {
      const result = await captureImage();
      setIsCapturing(true);

      // Store captured image data for this step
      setCapturedImages((prev) => [
        ...prev,
        {
          image: result.image,
          blob: result.blob,
          stepIndex: currentStepIndex,
          timestamp: Date.now(),
        },
      ]);

      // Simulate validation delay
      setTimeout(() => {
        setIsWaitingForValidation(false);
        setValidationResult({
          vehicleDetected: true,
          vehicleSize: 0.55, // Simulate valid size
          vehicleCentered: true,
          wheelsVisible: true,
          horizonLevel: true,
          cameraAngle: 'flat',
        });
      }, 800);
    } catch (error) {
      console.error('Failed to capture:', error);
      setFeedback({
        type: 'error',
        message: 'Failed to capture image. Please try again.',
        priority: 'high',
      });
    }
  };

  const handleRetake = () => {
    setValidationResult(null);
    setFeedback(null);
  };

  const handleSubmitCapture = () => {
    if (!validationResult?.vehicleDetected) {
      setFeedback({
        type: 'error',
        message: 'Vehicle not properly positioned. Please try again.',
        priority: 'high',
      });
      return;
    }

    if (capturedImages.length > 0 && capturedImages[capturedImages.length - 1].stepIndex === currentStepIndex) {
      // Already captured for this step, move to next
      handleNextStep();
      return;
    }

    handleNextStep();
  };

  const handleNextStep = () => {
    if (currentStepIndex < CAPTURE_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setValidationResult(null);
      setFeedback(null);
    } else {
      // All steps complete
      handleComplete();
    }
  };

  const handleComplete = () => {
    stopStream();
    reset();
    onCaptureComplete(capturedImages);
  };

  // Render camera view when available
  if (state.hasPermission && state.isStreaming) {
    console.log('[GuidedCapture] Rendering camera view - streaming active');
    
    // Log videoRef current state
    if (videoRef.current) {
      console.log('[GuidedCapture] videoRef.current:', videoRef.current);
      console.log('[GuidedCapture] video.srcObject:', videoRef.current.srcObject);
      console.log('[GuidedCapture] video.readyState:', videoRef.current.readyState);
      console.log('[GuidedCapture] video.videoWidth:', videoRef.current.videoWidth);
      console.log('[GuidedCapture] video.videoHeight:', videoRef.current.videoHeight);
      console.log('[GuidedCapture] video.paused:', videoRef.current.paused);
      console.log('[GuidedCapture] video.ended:', videoRef.current.ended);
      console.log('[GuidedCapture] video.playbackRate:', videoRef.current.playbackRate);
    } else {
      console.log('[GuidedCapture] videoRef.current is null');
    }
    
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Camera preview */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          {/* Debug Panel */}
          <div className="absolute top-4 left-4 z-40 bg-black/80 backdrop-blur text-white p-2 rounded-lg text-xs font-mono overflow-hidden max-w-[200px]">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-gray-400">streaming:</span>
                <span className={videoDebug.streaming ? "text-green-400" : "text-red-400"}>{videoDebug.streaming ? "true" : "false"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">readyState:</span>
                <span className="text-blue-400">{videoDebug.readyState}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">width:</span>
                <span className="text-yellow-400">{videoDebug.videoWidth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">height:</span>
                <span className="text-yellow-400">{videoDebug.videoHeight}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">paused:</span>
                <span className={videoDebug.paused ? "text-red-400" : "text-green-400"}>{videoDebug.paused ? "true" : "false"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">srcObject:</span>
                <span className={videoDebug.srcObjectExists ? "text-green-400" : "text-red-400"}>{videoDebug.srcObjectExists ? "exists" : "null"}</span>
              </div>
            </div>
          </div>
          
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover z-0"
            autoPlay
            playsInline
            muted
            loop
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setVideoDebug({
                  streaming: true,
                  readyState: videoRef.current.readyState,
                  videoWidth: videoRef.current.videoWidth,
                  videoHeight: videoRef.current.videoHeight,
                  paused: videoRef.current.paused,
                  srcObjectExists: videoRef.current.srcObject !== null,
                });
              }
            }}
            onCanPlay={() => {
              if (videoRef.current) {
                setVideoDebug({
                  streaming: true,
                  readyState: videoRef.current.readyState,
                  videoWidth: videoRef.current.videoWidth,
                  videoHeight: videoRef.current.videoHeight,
                  paused: videoRef.current.paused,
                  srcObjectExists: videoRef.current.srcObject !== null,
                });
              }
            }}
            onPlay={() => {
              if (videoRef.current) {
                setVideoDebug({
                  streaming: true,
                  readyState: videoRef.current.readyState,
                  videoWidth: videoRef.current.videoWidth,
                  videoHeight: videoRef.current.videoHeight,
                  paused: videoRef.current.paused,
                  srcObjectExists: videoRef.current.srcObject !== null,
                });
              }
            }}
            onPause={() => {
              if (videoRef.current) {
                setVideoDebug({
                  streaming: true,
                  readyState: videoRef.current.readyState,
                  videoWidth: videoRef.current.videoWidth,
                  videoHeight: videoRef.current.videoHeight,
                  paused: videoRef.current.paused,
                  srcObjectExists: videoRef.current.srcObject !== null,
                });
              }
            }}
          />
          <GuidedCaptureOverlay
            step={CAPTURE_STEPS[currentStepIndex]}
            feedback={feedback}
            isValidating={isWaitingForValidation}
            onCapture={handleCapture}
            onRetake={handleRetake}
          />
        </div>

        {/* Cancel button */}
        <div className="absolute top-4 right-4 z-30">
          <button
            onClick={onCancel}
            className="bg-black/50 backdrop-blur text-white px-4 py-2 rounded-lg hover:bg-black/70 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Render permission requested but not streaming (waiting for user to start)
  if (state.hasPermission) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
        <div className="mb-8 text-center">
          <h2 className="text-white text-xl font-bold mb-2">
            Camera Ready
          </h2>
          <p className="text-white/70 mb-6">
            {currentStepIndex === 0
              ? 'Ready to start capturing your vehicle photos'
              : `Step ${currentStepIndex + 1} of 4 ready to go`}
          </p>
          <button
            onClick={() => startStream(videoRef.current!)}
            className="bg-red-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-red-700 transition-colors shadow-xl shadow-red-600/30"
          >
            Start Camera
          </button>
        </div>
        <button
          onClick={onCancel}
          className="text-white/50 hover:text-white text-sm mt-4"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Render error state
  if (state.error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Camera Access Required
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {state.error}
          </p>
          <div className="space-y-3">
            <button
              onClick={handleStartCamera}
              className="w-full bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={onCancel}
              className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render loading/permission checking
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mb-6" />
      <h2 className="text-white text-xl font-bold">Checking Camera...</h2>
      <p className="text-white/70 mt-2">
        Please allow camera access to begin
      </p>
    </div>
  );
}