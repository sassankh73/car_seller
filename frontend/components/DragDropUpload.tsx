"use client";

import { useState, useCallback, useRef } from "react";

interface DragDropUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;
  previewUrl?: string | null;
  onPreviewClick?: () => void;
  t: (key: string) => string;
}

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/tiff",
  "image/tif",
  "image/bmp",
];

const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.tiff,.tif,.bmp";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MIN_RESOLUTION = { width: 640, height: 480 };

export default function DragDropUpload({
  onFilesSelected,
  accept = ACCEPTED_EXTENSIONS,
  maxSize = MAX_FILE_SIZE,
  multiple = false,
  previewUrl,
  onPreviewClick,
  t,
}: DragDropUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      const isTypeAllowed = ACCEPTED_TYPES.includes(file.type) || 
        /\.(heic|heif|avif|tif)$/i.test(file.name);
      if (!isTypeAllowed) {
        return t("upload.errors.unsupportedFormat");
      }

      // Check file size
      if (file.size > maxSize) {
        const maxMB = Math.round(maxSize / (1024 * 1024));
        return t("upload.errors.fileSizeExceeded").replace("{max}", maxMB.toString());
      }

      if (file.size === 0) {
        return t("upload.errors.emptyFile");
      }

      return null;
    },
    [maxSize, t]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles: File[] = [];
      let firstError: string | null = null;

      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          if (!firstError) firstError = error;
          continue;
        }
        validFiles.push(file);
      }

      if (firstError && validFiles.length === 0) {
        setError(firstError);
        return;
      }

      setError(null);
      setSelectedFiles(validFiles);
      onFilesSelected(validFiles);

      // Simulate upload progress
      setUploadProgress(0);
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev === null || prev >= 100) {
            clearInterval(interval);
            return null;
          }
          return prev + 10;
        });
      }, 100);
    },
    [validateFile, onFilesSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        if (!multiple) {
          handleFiles([files[0]]);
        } else {
          handleFiles(files);
        }
      }
    },
    [handleFiles, multiple]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
          isDragOver
            ? "border-red-500 bg-red-50"
            : error
            ? "border-red-300 bg-red-50"
            : "border-charcoal-200 hover:border-red-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />

        {previewUrl ? (
          <div className="space-y-3">
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-48 mx-auto rounded-lg object-cover"
            />
            <p className="text-xs text-charcoal-400">
              {t("upload.clickToReplace")}
            </p>
          </div>
        ) : (
          <div className="text-charcoal-400">
            <svg
              className="w-10 h-10 mx-auto mb-2 text-charcoal-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm font-medium">{t("upload.dragDropTitle")}</p>
            <p className="text-xs mt-1 text-charcoal-300">{t("upload.orClickToBrowse")}</p>
            <p className="text-xs mt-2 text-charcoal-300">
              {t("upload.supportedFormats")}
            </p>
            <p className="text-xs text-charcoal-300 mt-1">
              JPG, PNG, WEBP, HEIC, HEIF, AVIF, TIFF, BMP
            </p>
            <p className="text-xs text-charcoal-300 mt-1">
              {t("upload.maxSize")}
            </p>
          </div>
        )}
      </div>

      {/* Upload progress */}
      {uploadProgress !== null && (
        <div className="w-full bg-charcoal-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-red-500 h-full transition-all duration-150 rounded-full"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <svg
            className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Selected file info */}
      {selectedFiles.length > 0 && !error && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <svg
            className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm text-green-700 font-medium">
              {selectedFiles[0].name}
            </p>
            <p className="text-xs text-green-600">
              {(selectedFiles[0].size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}