"use client";

import { useEffect, useSyncExternalStore } from "react";

const DB_NAME = "marhampattii";
const STORE = "audio";

type Entry = Blob | "loading" | "missing";

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
const objectUrls = new WeakMap<Blob, string>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function statusFor(key: string | undefined) {
  if (!key) return "empty";
  const value = cache.get(key);
  if (!value) return "idle";
  if (value === "loading") return "loading";
  if (value === "missing") return "missing";
  return "ready";
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putAudio(key: string, blob: Blob) {
  cache.set(key, blob);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  emit();
}

export async function getAudio(key: string) {
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
}

export async function deleteAudio(key: string) {
  cache.delete(key);
  emit();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // The in-memory copy is already gone.
  }
}

export function urlForBlob(blob: Blob) {
  const existing = objectUrls.get(blob);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  objectUrls.set(blob, url);
  return url;
}

export function useStoredBlob(key: string | undefined) {
  const status = useSyncExternalStore(subscribe, () => statusFor(key), () => "empty");

  useEffect(() => {
    if (!key || cache.has(key)) return;
    cache.set(key, "loading");
    emit();
    void getAudio(key)
      .then((blob) => {
        cache.set(key, blob ?? "missing");
        emit();
      })
      .catch(() => {
        cache.set(key, "missing");
        emit();
      });
  }, [key]);

  const value = key ? cache.get(key) : undefined;
  return {
    status,
    blob: value instanceof Blob ? value : undefined,
  };
}
