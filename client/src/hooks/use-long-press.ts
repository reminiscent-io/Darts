import { useCallback, useEffect, useRef } from "react";

interface UseLongPressOptions {
  threshold?: number;
  moveThreshold?: number;
  vibrate?: boolean;
  disabled?: boolean;
}

interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.SyntheticEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onKeyUp: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
}

export function useLongPress(
  onLongPress: () => void,
  onTap: () => void,
  { threshold = 400, moveThreshold = 10, vibrate = true, disabled = false }: UseLongPressOptions = {}
): LongPressHandlers {
  const timerRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const arm = useCallback(() => {
    triggeredRef.current = false;
    clear();
    timerRef.current = window.setTimeout(() => {
      triggeredRef.current = true;
      timerRef.current = null;
      if (vibrate && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try { navigator.vibrate(15); } catch { /* ignore */ }
      }
      onLongPress();
    }, threshold);
  }, [clear, onLongPress, threshold, vibrate]);

  const release = useCallback(() => {
    const wasArmed = timerRef.current !== null;
    clear();
    if (wasArmed && !triggeredRef.current && !disabled) onTap();
  }, [clear, disabled, onTap]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      arm();
    },
    [arm, disabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (timerRef.current === null || !startPosRef.current) return;
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      if (Math.hypot(dx, dy) > moveThreshold) clear();
    },
    [clear, moveThreshold]
  );

  const handlePointerCancel = useCallback(() => {
    clear();
  }, [clear]);

  const handleContextMenu = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
  }, []);

  // Keyboard mirror of the pointer gesture: quick Enter/Space = tap,
  // held past the threshold = long-press. preventDefault stops the native
  // click synthesis so the tap never double-fires.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (disabled || e.repeat || timerRef.current !== null) return;
      startPosRef.current = null;
      arm();
    },
    [arm, disabled]
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      release();
    },
    [release]
  );

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: release,
    onPointerLeave: handlePointerCancel,
    onPointerCancel: handlePointerCancel,
    onContextMenu: handleContextMenu,
    onKeyDown: handleKeyDown,
    onKeyUp: handleKeyUp,
    onBlur: handlePointerCancel,
  };
}
