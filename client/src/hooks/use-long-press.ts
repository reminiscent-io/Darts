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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      triggeredRef.current = false;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      clear();
      timerRef.current = window.setTimeout(() => {
        triggeredRef.current = true;
        timerRef.current = null;
        if (vibrate && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          try { navigator.vibrate(15); } catch { /* ignore */ }
        }
        onLongPress();
      }, threshold);
    },
    [clear, disabled, onLongPress, threshold, vibrate]
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

  const handlePointerUp = useCallback(() => {
    const wasArmed = timerRef.current !== null;
    clear();
    if (wasArmed && !triggeredRef.current && !disabled) onTap();
  }, [clear, disabled, onTap]);

  const handlePointerCancel = useCallback(() => {
    clear();
  }, [clear]);

  const handleContextMenu = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
  }, []);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerCancel,
    onPointerCancel: handlePointerCancel,
    onContextMenu: handleContextMenu,
  };
}
