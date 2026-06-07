'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useIsMobile } from '@/hooks/useIsMobile';

// Capture step definitions
export interface CaptureStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  requirements: string[];
  positionType: 'front-left' | 'side' | 'rear-left' | 'rear' | 'front';
  imageUrl?: string;
}

export const CAPTURE_STEPS: CaptureStep[] = [
  {
    id: 'step1',
    title: 'Front Left 45°',
    subtitle: 'Step 1 of 4',
    description: 'Position your vehicle so you can see the front and left side clearly',
    requirements: [
      'Full vehicle visible',
      'All wheels visible',
      'Camera at eye level',
      'Vehicle centered in frame',
    ],
    positionType: 'front-left',
  },
  {
    id: 'step2',
    title: 'Side View',
    subtitle: 'Step 2 of 4',
    description: 'Capture the full length of your vehicle',
    requirements: [
      'Full vehicle length visible',
      'All wheels fully visible',
      'Vehicle aligned with frame',
    ],
    positionType: 'side',
  },
  {
    id: 'step3',
    title: 'Rear Left 45°',
    subtitle: 'Step 3 of 4',
    description: 'Position your vehicle so you can see the rear and left side',
    requirements: [
      'Rear and side visible',
      'Full vehicle inside frame',
      'Wheels clearly visible',
    ],
    positionType: 'rear-left',
  },
  {
    id: 'step4',
    title: 'Rear or Front View',
    subtitle: 'Step 4 of 4',
    description: 'Choose either rear or front view for symmetry',
    requirements: [
      'Full vehicle visible',
      'Symmetrical framing',
      'Clean background preferred',
    ],
    positionType: 'rear',
  },
];

// Feedback types
export type FeedbackType =
  | 'moving-left'
  | 'moving-right'
  | 'moving-forward'
  | 'moving-backward'
  | 'raise-camera'
  | 'lower-camera'
  | 'vehicle-detected'
  | 'vehicle-centered'
  | 'vehicle-correct-position'
  | 'validating'
  | 'positioning'
  | 'vehicle-not-detected'
  | 'too-far'
  | 'too-close'
  | 'not-centered'
  | 'wheels-not-visible'
  | 'horizon-not-level'
  | 'correct-position'
  | 'error';

export interface FeedbackMessage {
  type: FeedbackType;
  message: string;
  priority: 'low' | 'medium' | 'high';
}

// Generate feedback based on position analysis
export function getFeedbackMessage(
  stepIndex: number,
  isValidating: boolean,
  validationResult?: {
    vehicleDetected: boolean;
    vehicleSize: number; // 0-1 percentage
    vehicleCentered: boolean;
    wheelsVisible: boolean;
    horizonLevel: boolean;
    cameraAngle: 'flat' | 'up' | 'down';
  }
): FeedbackMessage | null {
  if (isValidating) {
    return {
      type: 'validating',
      message: 'Validating position...',
      priority: 'medium',
    };
  }

  if (!validationResult) {
    return {
      type: 'positioning',
      message: 'Position your vehicle inside the guide',
      priority: 'high',
    };
  }

  // Check if vehicle is detected
  if (!validationResult.vehicleDetected) {
    return {
      type: 'vehicle-not-detected',
      message: 'Vehicle not detected. Ensure vehicle is in frame.',
      priority: 'high',
    };
  }

  // Check vehicle size (coverage)
  if (validationResult.vehicleSize < 0.4) {
    return {
      type: 'too-far',
      message: 'Move closer to fill the frame',
      priority: 'high',
    };
  }

  if (validationResult.vehicleSize > 0.8) {
    return {
      type: 'too-close',
      message: 'Move back, vehicle is too close',
      priority: 'high',
    };
  }

  // Check centering
  if (!validationResult.vehicleCentered) {
    const centerMessage =
      stepIndex === 1
        ? 'Center the vehicle in the frame'
        : 'Align vehicle with the guide';
    return {
      type: 'not-centered',
      message: centerMessage,
      priority: 'medium',
    };
  }

  // Check camera angle
  if (validationResult.cameraAngle === 'up') {
    return {
      type: 'raise-camera',
      message: 'Lower camera slightly',
      priority: 'medium',
    };
  }

  if (validationResult.cameraAngle === 'down') {
    return {
      type: 'lower-camera',
      message: 'Raise camera slightly',
      priority: 'medium',
    };
  }

  // Check wheels (for steps that require them)
  if (stepIndex !== 1 && !validationResult.wheelsVisible) {
    return {
      type: 'wheels-not-visible',
      message: 'Ensure all wheels are visible',
      priority: 'medium',
    };
  }

  // Check horizon level
  if (!validationResult.horizonLevel) {
    return {
      type: 'horizon-not-level',
      message: 'Keep camera level with the ground',
      priority: 'medium',
    };
  }

  // All checks passed
  return {
    type: 'correct-position',
    message: 'Perfect position! Tap to capture.',
    priority: 'low',
  };
}

// Render the vehicle guide frame
function VehicleGuideFrame({ positionType }: { positionType: CaptureStep['positionType'] }) {
  // SVG path definitions for different angles
  const getVehiclePath = () => {
    const paths: Record<CaptureStep['positionType'], React.ReactNode> = {
      'front-left': (
        <>
          <path
            d="M120 180 L280 140 L340 140 L420 160 L420 220 L400 240 L100 240 L80 220 Z"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.7"
          />
          <circle cx="160" cy="230" r="15" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" />
          <circle cx="360" cy="230" r="15" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" />
        </>
      ),
      side: (
        <>
          <path
            d="M100 200 L400 200 L400 240 L380 240 L340 220 L100 220 L80 240 Z"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.7"
          />
          <circle cx="160" cy="240" r="15" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" />
          <circle cx="340" cy="240" r="15" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" />
        </>
      ),
      'rear-left': (
        <>
          <path
            d="M100 180 L420 180 L420 240 L380 240 L360 220 L80 220 L60 240 Z"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.7"
          />
          <circle cx="160" cy="230" r="15" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" />
          <circle cx="360" cy="230" r="15" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" />
        </>
      ),
      rear: (
        <>
          <path
            d="M120 180 L360 180 L360 240 L320 240 L300 220 L120 220 L100 240 Z"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.7"
          />
          <circle cx="160" cy="230" r="15" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" />
          <circle cx="320" cy="230" r="15" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" />
        </>
      ),
      front: (
        <>
          <path
            d="M100 180 L400 180 L400 240 L340 240 L300 220 L100 220 L60 240 Z"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.7"
          />
          <circle cx="160" cy="230" r="15" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" />
          <circle cx="340" cy="230" r="15" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" />
        </>
      ),
    };
    return paths[positionType];
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
      <svg
        viewBox="0 0 500 400"
        className="h-full w-full max-w-lg max-h-[60vh]"
      >
        {/* Vehicle outline */}
        {getVehiclePath()}
      </svg>
    </div>
  );
}

// Feedback indicator component
function FeedbackIndicator({ feedback }: { feedback: FeedbackMessage }) {
  return (
    <div
      className={`px-4 py-2 rounded-lg text-center font-medium transition-all ${
        feedback.priority === 'high'
          ? 'bg-red-100 text-red-700 animate-pulse'
          : feedback.priority === 'medium'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-green-100 text-green-700'
      }`}
    >
      {feedback.message}
    </div>
  );
}

// Main overlay component
export default function GuidedCaptureOverlay({
  step,
  feedback,
  isValidating,
  onCapture,
  onRetake,
}: {
  step: CaptureStep;
  feedback: FeedbackMessage | null;
  isValidating: boolean;
  onCapture: () => void;
  onRetake: () => void;
}) {
  const t = useTranslations('dashboard');
  const isMobile = useIsMobile();

  // Translated step titles, subtitles, and requirements keyed by step id
  const stepTitle: Record<string, string> = {
    step1: t('smartPhotoGuide.step.title_frontLeft45'),
    step2: t('smartPhotoGuide.step.title_side'),
    step3: t('smartPhotoGuide.step.title_rearLeft45'),
    step4: t('smartPhotoGuide.step.title_rearOrFront'),
  };
  const stepSubtitle: Record<string, string> = {
    step1: t('smartPhotoGuide.step.stepOf', { current: 1, total: 4 }),
    step2: t('smartPhotoGuide.step.stepOf', { current: 2, total: 4 }),
    step3: t('smartPhotoGuide.step.stepOf', { current: 3, total: 4 }),
    step4: t('smartPhotoGuide.step.stepOf', { current: 4, total: 4 }),
  };
  const stepRequirements: Record<string, string[]> = {
    step1: [
      t('smartPhotoGuide.step.requirement_fullVehicle'),
      t('smartPhotoGuide.step.requirement_allWheels'),
      t('smartPhotoGuide.step.requirement_eyeLevel'),
      t('smartPhotoGuide.step.requirement_centered'),
    ],
    step2: [
      t('smartPhotoGuide.step.requirement_fullLength'),
      t('smartPhotoGuide.step.requirement_allWheels'),
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
      t('smartPhotoGuide.step.requirement_cleanBackground'),
    ],
  };

  const displayTitle = stepTitle[step.id] ?? step.title;
  const displaySubtitle = stepSubtitle[step.id] ?? step.subtitle;
  const displayRequirements = stepRequirements[step.id] ?? step.requirements;

  const currentFeedback = useMemo((): FeedbackMessage => {
    if (isValidating) {
      return {
        type: 'validating',
        message: t('smartPhotoGuide.feedback.validating'),
        priority: 'medium',
      };
    }
    return feedback || {
      type: 'positioning',
      message: t('smartPhotoGuide.feedback.positioning'),
      priority: 'high',
    };
  }, [feedback, isValidating, t]);

  return (
    <div className="relative w-full h-full pointer-events-none z-10">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-white font-medium text-sm bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
            {displaySubtitle}
          </span>
          <span className="text-white font-bold text-lg bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm mt-1">
            {displayTitle}
          </span>
        </div>
      </div>

      {/* Vehicle guide frame */}
      <VehicleGuideFrame positionType={step.positionType} />

      {/* Mobile: feedback toast — floats above the control bar, pointer-events-none so it never blocks touches */}
      {/* Mobile: feedback toast — floats above buttons, never blocks touches */}
      {isMobile && (
        <div className="absolute bottom-32 left-0 right-0 px-4 z-20 flex justify-center pointer-events-none">
          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm max-w-[260px] text-center ${
            currentFeedback.priority === 'high'
              ? 'bg-red-600/60 text-white'
              : currentFeedback.priority === 'medium'
              ? 'bg-amber-600/60 text-white'
              : 'bg-green-700/60 text-white'
          }`}>
            {currentFeedback.message}
          </div>
        </div>
      )}

      {/* Bottom control bar — layout chosen by device type, not viewport width */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-auto">

        {isMobile ? (
          /* ── Phone (portrait AND landscape): transparent ghost overlay ── */
          <div>
            {/* Ghost requirements — 40% opacity, no background card */}
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
            {/* Touch-friendly buttons */}
            <div className="px-4 pb-8 pt-2 flex gap-3">
              <button
                onClick={onRetake}
                className="flex-1 py-4 bg-black/50 border border-white/20 text-white font-medium rounded-xl active:scale-[0.97] transition-transform text-sm"
              >
                {t('smartPhotoGuide.captureButtons.retake')}
              </button>
              <button
                onClick={onCapture}
                className="flex-[2] py-4 bg-red-600 text-white font-semibold rounded-xl active:scale-[0.97] transition-transform shadow-lg shadow-red-600/30 text-sm"
              >
                {t('smartPhotoGuide.captureButtons.capture')}
              </button>
            </div>
          </div>
        ) : (
          /* ── Tablet / desktop: full dark card with requirements, feedback, buttons ── */
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
                className="flex-1 py-3 bg-white/10 border border-white/20 text-white font-medium rounded-xl hover:bg-white/20 transition-colors"
              >
                {t('smartPhotoGuide.captureButtons.retake')}
              </button>
              <button
                onClick={onCapture}
                className="flex-[2] py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
              >
                {t('smartPhotoGuide.captureButtons.capture')}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Step progress indicator */}
      <div className="absolute top-20 left-0 right-0 px-4 z-20 flex justify-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i === parseInt(step.id.replace('step', ''), 10) - 1
                ? 'w-6 bg-red-500'
                : i < parseInt(step.id.replace('step', ''), 10) - 1
                ? 'bg-green-500'
                : 'bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Render instructions card for interior photos
export function InteriorPhotosInstructions() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 max-w-md mx-auto">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-amber-900 font-semibold">Interior Photos</h3>
          <p className="text-amber-700 text-sm mt-1">
            Interior photos are not processed by AutoStudio. Please photograph
            them separately for your vehicle listing.
          </p>
          <div className="mt-3 text-xs text-amber-600 font-medium">
            Examples: Dashboard, Steering wheel, Seats, Cargo area
          </div>
        </div>
      </div>
    </div>
  );
}

// Render the "Best Results" recommendation banner
export function BestResultsBanner({ onStartGuidedCapture }: { onStartGuidedCapture: () => void }) {
  return (
    <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-6 text-white mb-6">
      <h3 className="text-lg font-bold mb-2">Best Results Achieved Here</h3>
      <p className="text-red-50 mb-4 text-sm leading-relaxed">
        Most users achieve significantly better AI results by taking new photos
        using your mobile camera. Our guided capture system helps you get the
        perfect angle and positioning every time.
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