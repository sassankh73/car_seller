'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useIsMobile } from '@/hooks/useIsMobile';

export interface CaptureStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  requirements: string[];
  positionType: 'front-left' | 'side-left' | 'side-right' | 'rear-left' | 'rear' | 'front';
  imageUrl?: string;
}

export const CAPTURE_STEPS: CaptureStep[] = [
  {
    id: 'step1',
    title: 'Front Left 45°',
    subtitle: 'Step 1 of 6',
    description: 'Position your vehicle so you can see the front and left side clearly',
    requirements: ['Full vehicle visible', 'All wheels visible', 'Camera at eye level', 'Vehicle fills guide area'],
    positionType: 'front-left',
  },
  {
    id: 'step2',
    title: 'Left Side',
    subtitle: 'Step 2 of 6',
    description: 'Capture the full left length of your vehicle',
    requirements: ['Full vehicle length visible', 'Both axles visible', 'Vehicle aligned with frame'],
    positionType: 'side-left',
  },
  {
    id: 'step3',
    title: 'Rear Left 45°',
    subtitle: 'Step 3 of 6',
    description: 'Position your vehicle so you can see the rear and left side',
    requirements: ['Rear and side visible', 'Full vehicle inside frame', 'All wheels visible'],
    positionType: 'rear-left',
  },
  {
    id: 'step4',
    title: 'Rear View',
    subtitle: 'Step 4 of 6',
    description: 'Photograph the rear of your vehicle straight on',
    requirements: ['Full vehicle visible', 'Symmetrical framing', 'Vehicle fills guide area'],
    positionType: 'rear',
  },
  {
    id: 'step5',
    title: 'Right Side',
    subtitle: 'Step 5 of 6',
    description: 'Capture the full right length of your vehicle',
    requirements: ['Full vehicle length visible', 'Both axles visible', 'Vehicle aligned with frame'],
    positionType: 'side-right',
  },
  {
    id: 'step6',
    title: 'Front View',
    subtitle: 'Step 6 of 6',
    description: 'Photograph the front of your vehicle straight on',
    requirements: ['Full vehicle visible', 'Symmetrical framing', 'Vehicle fills guide area'],
    positionType: 'front',
  },
];

export type FeedbackType =
  | 'moving-left' | 'moving-right' | 'moving-forward' | 'moving-backward'
  | 'raise-camera' | 'lower-camera' | 'vehicle-detected' | 'vehicle-centered'
  | 'vehicle-correct-position' | 'validating' | 'positioning' | 'vehicle-not-detected'
  | 'too-far' | 'too-close' | 'not-centered' | 'wheels-not-visible'
  | 'horizon-not-level' | 'correct-position' | 'model-loading' | 'error';

export interface FeedbackMessage {
  type: FeedbackType;
  message: string;
  priority: 'low' | 'medium' | 'high';
}

export function getFeedbackMessage(
  stepIndex: number,
  isValidating: boolean,
  validationResult?: {
    vehicleDetected: boolean;
    vehicleSize: number;
    vehicleCentered: boolean;
    wheelsVisible: boolean;
    horizonLevel: boolean;
    cameraAngle: 'flat' | 'up' | 'down';
  }
): FeedbackMessage | null {
  if (isValidating) return { type: 'validating', message: 'Capturing photo...', priority: 'medium' };
  if (!validationResult) return { type: 'positioning', message: 'Position your vehicle inside the guide', priority: 'high' };
  if (!validationResult.vehicleDetected) return { type: 'vehicle-not-detected', message: 'Vehicle not detected. Ensure vehicle is in frame.', priority: 'high' };
  if (validationResult.vehicleSize < 0.4) return { type: 'too-far', message: 'Move closer to fill the frame', priority: 'high' };
  if (validationResult.vehicleSize > 0.85) return { type: 'too-close', message: 'Move back, vehicle is too close', priority: 'high' };
  if (!validationResult.vehicleCentered) return { type: 'not-centered', message: 'Center the vehicle in the frame', priority: 'medium' };
  if (validationResult.cameraAngle === 'up') return { type: 'raise-camera', message: 'Lower camera slightly', priority: 'medium' };
  if (validationResult.cameraAngle === 'down') return { type: 'lower-camera', message: 'Raise camera slightly', priority: 'medium' };
  if (!validationResult.wheelsVisible) return { type: 'wheels-not-visible', message: 'Ensure all wheels are visible', priority: 'medium' };
  if (!validationResult.horizonLevel) return { type: 'horizon-not-level', message: 'Keep camera level with the ground', priority: 'medium' };
  return { type: 'correct-position', message: 'Perfect position! Tap to capture.', priority: 'low' };
}

// Functional framing guides: viewfinder-style with corner brackets + guide rectangle
function VehicleGuideFrame({ positionType }: { positionType: CaptureStep['positionType'] }) {
  // Guide box dimensions per angle type (in a 500x400 viewBox)
  const guide = useMemo(() => {
    switch (positionType) {
      case 'front':
      case 'rear':
        // Square-ish: full front/rear showing mirrors + all 4 wheels
        return { x: 90, y: 50, w: 320, h: 300 };
      case 'side-left':
      case 'side-right':
        // Wide horizontal: full vehicle length from nose to tail
        return { x: 20, y: 100, w: 460, h: 200 };
      case 'front-left':
      case 'rear-left':
        // Perspective: slightly asymmetric wide rect for 3/4 view
        return { x: 50, y: 60, w: 400, h: 280 };
      default:
        return { x: 90, y: 50, w: 320, h: 300 };
    }
  }, [positionType]);

  const { x, y, w, h } = guide;
  const bLen = 24; // corner bracket arm length
  const bW = 3;    // bracket stroke width

  const corners = [
    // top-left: right then down
    `M${x + bLen},${y} L${x},${y} L${x},${y + bLen}`,
    // top-right: left then down
    `M${x + w - bLen},${y} L${x + w},${y} L${x + w},${y + bLen}`,
    // bottom-left: right then up
    `M${x + bLen},${y + h} L${x},${y + h} L${x},${y + h - bLen}`,
    // bottom-right: left then up
    `M${x + w - bLen},${y + h} L${x + w},${y + h} L${x + w},${y + h - bLen}`,
  ];

  // perspective arrow hints for 45° views
  const is45 = positionType === 'front-left' || positionType === 'rear-left';

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
      <svg viewBox="0 0 500 400" className="absolute inset-0 w-full h-full">
        {/* Vignette: dark overlay outside guide, transparent inside */}
        <defs>
          <mask id={`guide-${positionType}`}>
            <rect width="500" height="400" fill="white" />
            <rect x={x} y={y} width={w} height={h} fill="black" />
          </mask>
        </defs>
        <rect width="500" height="400" fill="rgba(0,0,0,0.38)" mask={`url(#guide-${positionType})`} />

        {/* Guide rectangle outline */}
        <rect
          x={x} y={y} width={w} height={h}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
          strokeDasharray="6,4"
        />

        {/* Corner brackets — bright white for visibility */}
        {corners.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="white" strokeWidth={bW} strokeLinecap="round" />
        ))}

        {/* Center crosshair dot */}
        <circle cx={x + w / 2} cy={y + h / 2} r="3" fill="rgba(255,255,255,0.6)" />

        {/* For 45° views: small perspective arrow hint */}
        {is45 && (
          <text
            x={positionType === 'front-left' ? x + 8 : x + w - 8}
            y={y + h - 8}
            fontSize="11"
            fill="rgba(255,255,255,0.5)"
            textAnchor={positionType === 'front-left' ? 'start' : 'end'}
          >
            45°
          </text>
        )}
      </svg>
    </div>
  );
}

function FeedbackIndicator({ feedback }: { feedback: FeedbackMessage }) {
  return (
    <div className={`px-4 py-2 rounded-lg text-center font-medium transition-all ${
      feedback.priority === 'high'
        ? 'bg-red-100 text-red-700 animate-pulse'
        : feedback.priority === 'medium'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-green-100 text-green-700'
    }`}>
      {feedback.message}
    </div>
  );
}

export default function GuidedCaptureOverlay({
  step,
  feedback,
  isValidating,
  onCapture,
  onRetake,
  captureReady = true,
}: {
  step: CaptureStep;
  feedback: FeedbackMessage | null;
  isValidating: boolean;
  onCapture: () => void;
  onRetake: () => void;
  captureReady?: boolean;
}) {
  const t = useTranslations('dashboard');
  const isMobile = useIsMobile();

  const stepNum = parseInt(step.id.replace('step', ''), 10);
  const total = CAPTURE_STEPS.length;

  const stepTitle: Record<string, string> = {
    step1: t('smartPhotoGuide.step.title_frontLeft45'),
    step2: t('smartPhotoGuide.step.title_leftSide'),
    step3: t('smartPhotoGuide.step.title_rearLeft45'),
    step4: t('smartPhotoGuide.step.title_rearView'),
    step5: t('smartPhotoGuide.step.title_rightSide'),
    step6: t('smartPhotoGuide.step.title_frontView'),
  };
  const stepRequirements: Record<string, string[]> = {
    step1: [
      t('smartPhotoGuide.step.requirement_fullVehicle'),
      t('smartPhotoGuide.step.requirement_allWheels'),
      t('smartPhotoGuide.step.requirement_eyeLevel'),
      t('smartPhotoGuide.step.requirement_fillGuide'),
    ],
    step2: [
      t('smartPhotoGuide.step.requirement_fullLength'),
      t('smartPhotoGuide.step.requirement_bothAxles'),
      t('smartPhotoGuide.step.requirement_aligned'),
    ],
    step3: [
      t('smartPhotoGuide.step.requirement_rearAndSide'),
      t('smartPhotoGuide.step.requirement_insideFrame'),
      t('smartPhotoGuide.step.requirement_allWheels'),
    ],
    step4: [
      t('smartPhotoGuide.step.requirement_fullVehicle'),
      t('smartPhotoGuide.step.requirement_symmetrical'),
      t('smartPhotoGuide.step.requirement_fillGuide'),
    ],
    step5: [
      t('smartPhotoGuide.step.requirement_fullLength'),
      t('smartPhotoGuide.step.requirement_bothAxles'),
      t('smartPhotoGuide.step.requirement_aligned'),
    ],
    step6: [
      t('smartPhotoGuide.step.requirement_fullVehicle'),
      t('smartPhotoGuide.step.requirement_symmetrical'),
      t('smartPhotoGuide.step.requirement_fillGuide'),
    ],
  };

  const displayTitle = stepTitle[step.id] ?? step.title;
  const displaySubtitle = t('smartPhotoGuide.step.stepOf', { current: stepNum, total });
  const displayRequirements = stepRequirements[step.id] ?? step.requirements;

  const currentFeedback = useMemo((): FeedbackMessage => {
    if (isValidating) return { type: 'validating', message: t('smartPhotoGuide.feedback.validating'), priority: 'medium' };
    return feedback || { type: 'positioning', message: t('smartPhotoGuide.feedback.positioning'), priority: 'high' };
  }, [feedback, isValidating, t]);

  const isReady = captureReady && !isValidating;

  return (
    <div className="relative w-full h-full pointer-events-none z-10">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <span className="text-white font-medium text-xs bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
            {displaySubtitle}
          </span>
          <span className="text-white font-bold text-base bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
            {displayTitle}
          </span>
        </div>
      </div>

      {/* Vehicle guide frame (vignette + brackets) */}
      <VehicleGuideFrame positionType={step.positionType} />

      {/* Mobile feedback toast */}
      {isMobile && (
        <div className="absolute bottom-32 left-0 right-0 px-4 z-20 flex justify-center pointer-events-none">
          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm max-w-[280px] text-center ${
            currentFeedback.priority === 'high'
              ? 'bg-red-600/70 text-white'
              : currentFeedback.priority === 'medium'
              ? 'bg-amber-600/70 text-white'
              : 'bg-green-700/70 text-white'
          }`}>
            {currentFeedback.message}
          </div>
        </div>
      )}

      {/* Bottom control bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-auto">
        {isMobile ? (
          <div>
            {/* Ghost requirements */}
            <div className="px-4 pt-2 pb-1">
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {displayRequirements.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-1 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/40 flex-none" />
                    <span className="text-white/40 text-[11px] leading-tight truncate">{req}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Touch-friendly buttons — min 44px tall */}
            <div className="px-4 pb-8 pt-2 flex gap-3">
              <button
                onClick={onRetake}
                className="flex-1 py-3.5 min-h-[44px] bg-black/50 border border-white/20 text-white font-medium rounded-xl active:scale-[0.97] transition-transform text-sm"
              >
                {t('smartPhotoGuide.captureButtons.retake')}
              </button>
              <button
                onClick={onCapture}
                disabled={!isReady}
                className={`flex-[2] py-3.5 min-h-[44px] text-white font-semibold rounded-xl active:scale-[0.97] transition-all shadow-lg text-sm ${
                  isReady
                    ? 'bg-red-600 shadow-red-600/30'
                    : 'bg-red-600/40 shadow-none opacity-70'
                }`}
              >
                {t('smartPhotoGuide.captureButtons.capture')}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-black/80 backdrop-blur-md border-t border-white/10">
            <div className="px-4 pt-3 pb-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {displayRequirements.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full border border-white/30 flex-none bg-white/10" />
                    <span className="text-white/60 text-xs truncate">{req}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 pb-2">
              <FeedbackIndicator feedback={currentFeedback} />
            </div>
            <div className="px-4 pb-5 flex gap-3">
              <button
                onClick={onRetake}
                className="flex-1 py-3 min-h-[44px] bg-white/10 border border-white/20 text-white font-medium rounded-xl hover:bg-white/20 transition-colors"
              >
                {t('smartPhotoGuide.captureButtons.retake')}
              </button>
              <button
                onClick={onCapture}
                disabled={!isReady}
                className={`flex-[2] py-3 min-h-[44px] text-white font-medium rounded-xl transition-colors shadow-lg ${
                  isReady
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30'
                    : 'bg-red-600/40 cursor-not-allowed shadow-none'
                }`}
              >
                {t('smartPhotoGuide.captureButtons.capture')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step progress dots */}
      <div className="absolute top-20 left-0 right-0 px-4 z-20 flex justify-center gap-2">
        {CAPTURE_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === stepNum - 1
                ? 'w-6 bg-red-500'
                : i < stepNum - 1
                ? 'w-2 bg-green-500'
                : 'w-2 bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function InteriorPhotosInstructions() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 max-w-md mx-auto">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-amber-900 font-semibold">Interior Photos</h3>
          <p className="text-amber-700 text-sm mt-1">
            Interior photos are not processed by AutoStudio. Please photograph them separately for your vehicle listing.
          </p>
          <div className="mt-3 text-xs text-amber-600 font-medium">
            Examples: Dashboard, Steering wheel, Seats, Cargo area
          </div>
        </div>
      </div>
    </div>
  );
}

export function BestResultsBanner({ onStartGuidedCapture }: { onStartGuidedCapture: () => void }) {
  return (
    <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-6 text-white mb-6">
      <h3 className="text-lg font-bold mb-2">Best Results Achieved Here</h3>
      <p className="text-red-50 mb-4 text-sm leading-relaxed">
        Most users achieve significantly better AI results by taking new photos using your mobile camera. Our guided capture system helps you get the perfect angle and positioning every time.
      </p>
      <button
        onClick={onStartGuidedCapture}
        className="bg-white text-red-600 px-6 py-2.5 rounded-xl font-semibold hover:bg-red-50 transition-colors shadow-lg"
      >
        Start Guided Capture
      </button>
      <p className="text-xs text-red-100 mt-3">
        You can still upload existing photos if needed.
      </p>
    </div>
  );
}
