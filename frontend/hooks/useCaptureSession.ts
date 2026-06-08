'use client';

import { useCallback } from 'react';

const DB_NAME = 'autostudio_capture';
const STORE_NAME = 'session';
const SESSION_KEY = 'current_session';

export interface StoredImage {
  image: string;   // data URL
  blob: Blob;
  stepIndex: number;
  timestamp: number;
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

async function dbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function dbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

async function dbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

// Serialize Blob → base64 for IndexedDB storage
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Deserialize base64 → Blob
function base64ToBlob(b64: string): Blob {
  const [header, data] = b64.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bytes = atob(data);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

interface SerializedSession {
  images: { image: string; blobB64: string; stepIndex: number; timestamp: number }[];
}

export function useCaptureSession() {
  const saveImage = useCallback(async (images: StoredImage[]) => {
    const serialized: SerializedSession = {
      images: await Promise.all(
        images.map(async (img) => ({
          image: img.image,
          blobB64: await blobToBase64(img.blob),
          stepIndex: img.stepIndex,
          timestamp: img.timestamp,
        }))
      ),
    };
    await dbSet(SESSION_KEY, serialized);
  }, []);

  const loadSession = useCallback(async (): Promise<StoredImage[] | null> => {
    const session = await dbGet<SerializedSession>(SESSION_KEY);
    if (!session || !session.images?.length) return null;
    return session.images.map((item) => ({
      image: item.image,
      blob: base64ToBlob(item.blobB64),
      stepIndex: item.stepIndex,
      timestamp: item.timestamp,
    }));
  }, []);

  const clearSession = useCallback(async () => {
    await dbDelete(SESSION_KEY);
  }, []);

  return { saveImage, loadSession, clearSession };
}
