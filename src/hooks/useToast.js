import { useSyncExternalStore } from 'react';
import { TOAST_AUTO_DISMISS_MS } from '../constants.js';

// Module-level store (not React Context) so showToast() can be called from
// plain utility modules like pdfExporter.js, which aren't components and
// have no access to a Provider tree.
let toasts = [];
let idCounter = 0;
const listeners = new Set();
const dismissTimers = new Map();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

export function dismissToast(id) {
  if (!toasts.some((toast) => toast.id === id)) return;

  clearTimeout(dismissTimers.get(id));
  dismissTimers.delete(id);
  toasts = toasts.filter((toast) => toast.id !== id);
  emitChange();
}

export function showToast(message, type = 'error') {
  // Dedup identical (message, type) pairs instead of stacking duplicates —
  // repeated failures from the same action (retried PDF export, repeated
  // invalid Benchmark input) would otherwise pile up toasts indefinitely.
  const existing = toasts.find((toast) => toast.message === message && toast.type === type);
  if (existing) return;

  const id = ++idCounter;
  toasts = [...toasts, { id, message, type }];
  emitChange();

  // Errors (including fail-closed security rejections like a private-repo
  // add) stay until the user manually dismisses them, so the message can't
  // silently disappear before it's read the way alert() never allowed.
  // Success/warning toasts are lower-stakes and auto-dismiss.
  if (type !== 'error') {
    dismissTimers.set(id, setTimeout(() => dismissToast(id), TOAST_AUTO_DISMISS_MS));
  }
}

export function useToast() {
  const toastList = useSyncExternalStore(subscribe, getSnapshot);
  return { toasts: toastList, dismissToast };
}
