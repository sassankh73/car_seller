'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { useVehicleDetection } from '@/hooks/useVehicleDetection';
import { useCaptureSession } from '@/hooks/useCaptureSession';
import GuidedCaptureOverlay, {
  CAPTURE_STEPS,
  FeedbackMessage,
  getFeedbackMessage,
} from './GuidedCaptureOverlay';

export interface CapturedImage {
  image: string;
  blob: Blob;
  stepIndex: number;
  timestamp: number;
}

interface CameraDevice {
  id: string;
  label: string;
  displayName: string;
}

function labelCamera(label: string, idx: number): string {
  const l = label.toLowerCase();
  if (l.includes('ultra') || l.includes('0.5')) return 'Rear Ultra Wide';
  if (l.includes('tele') || l.includes('telephoto')) return 'Rear Telephoto';
  if (l.includes('back') || l.includes('rear') || l.includes('environment')) return 'Rear Wide';
  if (l.includes('front') || l.includes('user') || l.includes('face')) return 'Front';
  return `Camera ${idx + 1}`;
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
    captureImage,
    getCameras,
    reset,
  } = useCameraCapture();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

  // Camera selection (TASK-6)
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [showCameraMenu, setShowCameraMenu] = useState(false);

  // Session resume (TASK-4)
  const [resumePrompt, setResumePrompt] = useState(false);
  const [savedImages, setSavedImages] = useState<CapturedImage[] | null>(null);
  const { saveImage, loadSession, clearSession } = useCaptureSession();

  // Vehicle detection (TASK-3)
  const detection = useVehicleDetection(state.isStreaming);
  // Wire video element to detection hook
  useEffect(() => {
    detection.attachVideo(videoRef.current);
  }, [videoRef, detection]);

  const captureReadyFromDetection = detection.modelReady
    ? detection.validationResult?.vehicleDetected === true &&
      (detection.validationResult?.vehicleSize ?? 0) >= 0.35 &&
      (detection.validationResult?.vehicleSize ?? 0) <= 0.85
    : true; // while model is loading, don't block capture

  // Debug overlay
  const [videoDebug, setVideoDebug] = useState({
    streaming: false, readyState: 0, videoWidth: 0, videoHeight: 0,
    paused: true, srcObjectExists: false,
  });
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

  // On mount: check for saved session, then start camera
  useEffect(() => {
    const init = async () => {
      const stored = await loadSession();
      if (stored && stored.length > 0) {
        setSavedImages(stored);
        setResumePrompt(true);
        return;
      }
      await startCamera();
    };
    init();
    return () => {
      stopStream();
      reset();
      detection.stopDetection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    const opts = deviceId
      ? { deviceId }
      : { facingMode: 'environment' as const };
    const ok = await requestPermission(opts);
    if (ok) {
      await startStream(videoRef.current!);
      // Enumerate cameras after permission is granted (labels only available post-permission)
      try {
        const devs = await getCameras();
        const mapped: CameraDevice[] = devs.map((d, i) => ({
          id: d.id,
          label: d.label,
          displayName: labelCamera(d.label, i),
        }));
        setCameras(mapped);
        if (!deviceId && mapped.length > 0) {
          // Pre-select the rear wide camera
          const rearWide = mapped.find((d) => d.displayName === 'Rear Wide') ?? mapped[0];
          setSelectedCameraId(rearWide.id);
        }
      } catch {}
    }
  }, [requestPermission, startStream, videoRef, getCameras]);

  const handleCameraSelect = async (deviceId: string) => {
    setShowCameraMenu(false);
    if (deviceId === selectedCameraId) return;
    setSelectedCameraId(deviceId);
    stopStream();
    await startCamera(deviceId);
  };

  const handleResumeSession = async () => {
    if (!savedImages) return;
    setResumePrompt(false);
    setCapturedImages(savedImages);
    setCurrentStepIndex(savedImages.length);
    setSavedImages(null);
    await startCamera(selectedCameraId || undefined);
  };

  const handleStartFresh = async () => {
    setResumePrompt(false);
    setSavedImages(null);
    await clearSession();
    await startCamera();
  };

  useEffect(() => { setFeedback(null); }, [currentStepIndex]);

  const handleCapture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const result = await captureImage();
      const newImage: CapturedImage = {
        image: result.image,
        blob: result.blob,
        stepIndex: currentStepIndex,
        timestamp: Date.now(),
      };
      const nextImages = [...capturedImages, newImage];
      setCapturedImages(nextImages);
      // Persist immediately (TASK-4)
      await saveImage(nextImages);

      setTimeout(() => {
        setIsCapturing(false);
        handleNextStep(nextImages);
      }, 600);
    } catch {
      setIsCapturing(false);
      setFeedback({ type: 'error', message: t('smartPhotoGuide.feedback.error'), priority: 'high' });
    }
  };

  const handleRetake = () => { setFeedback(null); };

  const handleNextStep = (images: CapturedImage[]) => {
    if (currentStepIndex < CAPTURE_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleComplete(images);
    }
  };

  const handleComplete = async (images: CapturedImage[]) => {
    await clearSession();
    stopStream();
    reset();
    detection.stopDetection();
    onCaptureComplete(images);
  };

  // Build live feedback from detection result (TASK-3)
  const liveFeedback = useCallback((): FeedbackMessage | null => {
    if (!state.isStreaming) return null;
    if (detection.modelLoading) {
      return { type: 'model-loading', message: t('smartPhotoGuide.feedback.modelLoading'), priority: 'medium' };
    }
    if (detection.modelReady && detection.validationResult) {
      return getFeedbackMessage(currentStepIndex, isCapturing, detection.validationResult) || feedback;
    }
    return feedback;
  }, [state.isStreaming, detection, currentStepIndex, isCapturing, feedback, t]);

  const activeFeedback = liveFeedback();

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">

        {/* Video — always mounted */}
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

        {/* Session resume prompt (TASK-4) */}
        {resumePrompt && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-stone-900 mb-1">
                {t('smartPhotoGuide.session.resumeTitle')}
              </h2>
              <p className="text-stone-500 text-sm mb-5">
                {t('smartPhotoGuide.session.resumeMessage', { count: savedImages?.length ?? 0 })}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleStartFresh}
                  className="flex-1 py-3 border border-stone-200 text-stone-600 rounded-xl font-medium text-sm hover:bg-stone-50 transition-colors"
                >
                  {t('smartPhotoGuide.session.startFresh')}
                </button>
                <button
                  onClick={handleResumeSession}
                  className="flex-[2] py-3 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors"
                >
                  {t('smartPhotoGuide.session.resume')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Streaming: guides + overlay */}
        {state.isStreaming && !resumePrompt && (
          <>
            {process.env.NEXT_PUBLIC_CAMERA_DEBUG === 'true' && (
              <div className="absolute top-4 left-4 z-40 bg-black/80 backdrop-blur text-white p-2 rounded-lg text-xs font-mono overflow-hidden max-w-[200px]">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between"><span className="text-gray-400">streaming:</span><span className={videoDebug.streaming ? 'text-green-400' : 'text-red-400'}>{String(videoDebug.streaming)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">readyState:</span><span className="text-blue-400">{videoDebug.readyState}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">width:</span><span className="text-yellow-400">{videoDebug.videoWidth}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">detection:</span><span className={detection.modelReady ? 'text-green-400' : 'text-amber-400'}>{detection.modelReady ? 'ready' : detection.modelLoading ? 'loading' : 'off'}</span></div>
                </div>
              </div>
            )}

            <GuidedCaptureOverlay
              step={CAPTURE_STEPS[currentStepIndex]}
              feedback={activeFeedback}
              isValidating={isCapturing}
              onCapture={handleCapture}
              onRetake={handleRetake}
              captureReady={captureReadyFromDetection}
            />
          </>
        )}

        {/* Permission granted but not yet streaming */}
        {state.hasPermission && !state.isStreaming && !state.error && !resumePrompt && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 p-6">
            <h2 className="text-white text-xl font-bold mb-2">{t('smartPhotoGuide.step.title_frontLeft45')}</h2>
            <p className="text-white/70 mb-6">{t('smartPhotoGuide.step.description_frontLeft45')}</p>
            <button
              onClick={() => startCamera(selectedCameraId || undefined)}
              className="bg-red-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-red-700 transition-colors shadow-xl shadow-red-600/30"
            >
              {t('smartPhotoGuide.startGuidedCapture')}
            </button>
          </div>
        )}

        {/* Error state */}
        {state.error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Camera Access Required</h3>
              <p className="text-gray-600 mb-6">{state.error}</p>
              <div className="space-y-3">
                <button onClick={() => startCamera()} className="w-full bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors">Try Again</button>
                <button onClick={onCancel} className="w-full text-gray-600 hover:text-gray-900 px-6 py-3 rounded-xl font-medium transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Loading / permission checking */}
        {!state.hasPermission && !state.error && !resumePrompt && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mb-6" />
            <h2 className="text-white text-xl font-bold">Checking Camera…</h2>
            <p className="text-white/70 mt-2">Please allow camera access to begin</p>
          </div>
        )}
      </div>

      {/* Camera selector (TASK-6) — shown when streaming and multiple cameras available */}
      {state.isStreaming && cameras.length > 1 && (
        <div className="absolute top-4 left-4 z-30">
          <div className="relative">
            <button
              onClick={() => setShowCameraMenu((v) => !v)}
              className="bg-black/50 backdrop-blur text-white px-3 py-2 rounded-lg hover:bg-black/70 transition-colors flex items-center gap-2 min-h-[44px]"
              aria-label="Select camera"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
              <span className="text-sm font-medium">
                {cameras.find((c) => c.id === selectedCameraId)?.displayName ?? 'Camera'}
              </span>
              <svg className="w-3 h-3 opacity-60" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            {showCameraMenu && (
              <div className="absolute top-full left-0 mt-1 bg-black/90 backdrop-blur-md rounded-xl overflow-hidden shadow-xl min-w-[160px] z-40">
                {cameras.map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => handleCameraSelect(cam.id)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors min-h-[44px] ${
                      cam.id === selectedCameraId
                        ? 'bg-red-600 text-white font-semibold'
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    {cam.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Captured thumbnails strip */}
      {capturedImages.length > 0 && state.isStreaming && (
        <div className="absolute top-4 right-14 z-30 flex gap-1">
          {capturedImages.map((img, i) => (
            <div key={i} className="w-9 h-9 rounded-md overflow-hidden border-2 border-green-400 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.image} alt={`Step ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Cancel button */}
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={onCancel}
          className="bg-black/50 backdrop-blur text-white px-4 py-2 rounded-lg hover:bg-black/70 transition-colors min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
