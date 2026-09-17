"use client";

import * as React from "react";

/**
 * Minimal toast store with a shadcn-compatible API (`useToast`, `toast`).
 *
 * Implemented locally rather than with Radix Toast on purpose: Radix registers
 * every toast as a dismissable layer, which steals the Escape key from any open
 * dialog or drawer while a toast is visible. This store keeps toasts purely
 * presentational so they never interfere with focus or keyboard handling.
 */

export type ToastVariant = "default" | "success" | "destructive";

export interface ToastItem {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant: ToastVariant;
  duration: number;
}

type Action =
  | { type: "ADD"; toast: ToastItem }
  | { type: "DISMISS"; id?: string }
  | { type: "REMOVE"; id?: string };

interface State {
  toasts: ToastItem[];
}

export const TOAST_LIMIT = 3;
const DEFAULT_DURATION = 4500;

let count = 0;
function genId(): string {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return `toast-${Date.now()}-${count}`;
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD":
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case "DISMISS":
      return {
        ...state,
        toasts: state.toasts.filter((toast) => (action.id ? toast.id !== action.id : false)),
      };
    case "REMOVE":
      return {
        ...state,
        toasts: action.id ? state.toasts.filter((toast) => toast.id !== action.id) : [],
      };
    default:
      return state;
  }
};

const listeners: ((state: State) => void)[] = [];
let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

export interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
}

export function toast({
  title,
  description,
  variant = "default",
  duration = DEFAULT_DURATION,
}: ToastOptions) {
  const id = genId();

  dispatch({ type: "ADD", toast: { id, title, description, variant, duration } });
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      dispatch({ type: "REMOVE", id });
    }, duration),
  );

  return { id, dismiss: () => dismissToast(id) };
}

export function dismissToast(id?: string) {
  if (!id) {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    dispatch({ type: "REMOVE" });
    return;
  }

  clearTimer(id);
  dispatch({ type: "REMOVE", id });
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    setState(memoryState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    toasts: state.toasts,
    toast,
    dismiss: dismissToast,
  };
}
