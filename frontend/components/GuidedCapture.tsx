'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import GuidedCaptureOverlay, {
  CAPTURE_STEPS,
  FeedbackMessage,
} from './GuidedCaptureOverlay';

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
  const t = useTranslations('dashboard');
  const {
    state,
    videoRef,
    requestPermission,
    startStream,
    stopStream,
    switchCamera,
    captureImage,
    reset,
  } = useCameraCapture();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

  // Only used when NEXT_PUBLIC_CAMERA_DEBUG=true
  const [videoDebug, setVideoDebug] = useState({
    streaming: false,
    readyState: 0,
    videoWidth: 0,
    videoHeight: 0,
    paused: true,
    srcObjectExists: false,
  });

  // On mount: request permission then start stream.
  // The <video> element is always in the DOM, so videoRef.current is valid here.
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

  // Reset guide feedback when advancing to a new step
  useEffect(() => {
    setFeedback(null);
  }, [currentStepIndex]);

  const handleStartCamera = async () => {
    const hasPermission = await requestPermission();
    if (hasPermission) {
      await startStream(videoRef.current!);
    }
  };

  const handleCapture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      const result = await captureImage();

      // Compute the new array immediately — do NOT rely on the state update
      // settling before handleNextStep reads it. The stale-closure bug caused
      // the 4th image to be missing: setCapturedImages schedules a re-render
      // but does not mutate `capturedImages` in this closure.
      const newImage: CapturedImage = {
        image: result.image,
        blob: result.blob,
        stepIndex: currentStepIndex,
        timestamp: Date.now(),
      };
      const nextImages = [...capturedImages, newImage];
      setCapturedImages(nextImages);

      console.log(
        'Captured images:',
        nextImages.length,
        '— angle:',
        CAPTURE_STEPS[currentStepIndex]?.title,
      );

      setTimeout(() => {
        setIsCapturing(false);
        handleNextStep(nextImages);
      }, 600);
    } catch (error) {
      console.error('Failed to capture:', error);
      setIsCapturing(false);
      setFeedback({
        type: 'error',
        message: t('smartPhotoGuide.feedback.error'),
        priority: 'high',
      });
    }
  };

  const handleRetake = () => {
    setFeedback(null);
  };

  // images is passed explicitly to avoid reading stale state in handleComplete
  const handleNextStep = (images: CapturedImage[]) => {
    if (currentStepIndex < CAPTURE_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleComplete(images);
    }
  };

  const handleComplete = (images: CapturedImage[]) => {
    console.log(
      'Generated projects:',
      images.length,
      '— angles:',
      images.map((img) => CAPTURE_STEPS[img.stepIndex]?.title).join(', '),
    );
    stopStream();
    reset();
    onCaptureComplete(images);
  };

  const updateVideoDebug = () => {
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
  };

  // Single unified render — the <video> element is ALWAYS in the DOM so that
  // videoRef.current is non-null when startStream() is called from useEffect.
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">

        {/* Video — always mounted; ref always attached */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover z-0"
          autoPlay
          playsInline
          muted
          onLoadedMetadata={updateVideoDebug}
          onCanPlay={updateVideoDebug}
          onPlay={updateVideoDebug}
          onPause={updateVideoDebug}
        />

        {/* Streaming active: vehicle guides */}
        {state.isStreaming && (
          <>
            {/* Debug diagnostics — explicit flag only, never shown to users in production */}
            {process.env.NEXT_PUBLIC_CAMERA_DEBUG === 'true' && (
              <div className="absolute top-4 left-4 z-40 bg-black/80 backdrop-blur text-white p-2 rounded-lg text-xs font-mono overflow-hidden max-w-[200px]">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">streaming:</span>
                    <span className={videoDebug.streaming ? 'text-green-400' : 'text-red-400'}>
                      {videoDebug.streaming ? 'true' : 'false'}
                    </span>
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
                    <span className={videoDebug.paused ? 'text-red-400' : 'text-green-400'}>
                      {videoDebug.paused ? 'true' : 'false'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">srcObject:</span>
                    <span className={videoDebug.srcObjectExists ? 'text-green-400' : 'text-red-400'}>
                      {videoDebug.srcObjectExists ? 'exists' : 'null'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <GuidedCaptureOverlay
              step={CAPTURE_STEPS[currentStepIndex]}
              feedback={feedback}
              isValidating={isCapturing}
              onCapture={handleCapture}
              onRetake={handleRetake}
            />
          </>
        )}

        {/* Permission granted but not yet streaming — fallback */}
        {state.hasPermission && !state.isStreaming && !state.error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 p-6">
            <div className="mb-8 text-center">
              <h2 className="text-white text-xl font-bold mb-2">
                {t('smartPhotoGuide.step.title_frontLeft45')}
              </h2>
              <p className="text-white/70 mb-6">
                {t('smartPhotoGuide.step.description_frontLeft45')}
              </p>
              <button
                onClick={handleStartCamera}
                className="bg-red-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-red-700 transition-colors shadow-xl shadow-red-600/30"
              >
                {t('smartPhotoGuide.startGuidedCapture')}
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {state.error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6">
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
              <p className="text-gray-600 dark:text-gray-300 mb-6">{state.error}</p>
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
        )}

        {/* Loading / permission checking */}
        {!state.hasPermission && !state.error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mb-6" />
            <h2 className="text-white text-xl font-bold">Checking Camera...</h2>
            <p className="text-white/70 mt-2">Please allow camera access to begin</p>
          </div>
        )}
      </div>

      {/* Switch Camera button — only when streaming, top-left */}
      {state.isStreaming && (
        <div className="absolute top-4 left-4 z-30">
          <button
            onClick={switchCamera}
            className="bg-black/50 backdrop-blur text-white px-3 py-2 rounded-lg hover:bg-black/70 transition-colors flex items-center gap-2"
            aria-label="Switch camera"
          >
            {/* Rotate/flip camera icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
              <path d="M9 2H5a2 2 0 0 0-2 2v4" />
              <path d="M3 16v2a2 2 0 0 0 2 2h4" />
              <path d="M16 22h3a2 2 0 0 0 2-2v-4" />
              <path d="M14 11a4 4 0 0 1-8 0 4 4 0 0 1 8 0" />
            </svg>
            <span className="text-sm font-medium">
              {state.activeFacingMode === 'environment' ? 'Front' : 'Rear'}
            </span>
          </button>
        </div>
      )}

      {/* Cancel button — always visible */}
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
