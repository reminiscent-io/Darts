import { useCallback, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/lib/motion";

// Fly-to-tray: when a dart is recorded, its label lifts off the tapped
// button and travels into the dart tray, landing where the chip appears.
// The point is error visibility — if a value flies and you didn't throw
// it, you notice. Skipped entirely under prefers-reduced-motion.

export interface DartFlight {
  id: number;
  label: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** CSS custom property name for the team hue, e.g. "--chart-2". */
  colorVar: string;
}

// Tray geometry: "Darts:" label (~56px) then chips (~78px pitch).
const TRAY_LABEL_OFFSET = 56;
const CHIP_PITCH = 78;

export function useDartFlight() {
  const trayRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const [flights, setFlights] = useState<DartFlight[]>([]);
  const reducedMotion = useReducedMotion();

  const launchDart = useCallback(
    (label: string, slot: number, colorVar: string, origin?: { x: number; y: number }) => {
      if (reducedMotion || !origin) return;
      const rect = trayRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(
        rect.left + TRAY_LABEL_OFFSET + slot * CHIP_PITCH + CHIP_PITCH / 2,
        rect.right - CHIP_PITCH / 2
      );
      setFlights((prev) => [
        ...prev,
        { id: nextId.current++, label, from: origin, to: { x, y: rect.top + rect.height / 2 }, colorVar },
      ]);
    },
    [reducedMotion]
  );

  const removeFlight = useCallback((id: number) => {
    setFlights((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { trayRef, flights, launchDart, removeFlight };
}

interface DartFlightLayerProps {
  flights: DartFlight[];
  onDone: (id: number) => void;
}

export function DartFlightLayer({ flights, onDone }: DartFlightLayerProps) {
  if (flights.length === 0) return null;
  return (
    <div className="fixed inset-0 z-50 pointer-events-none" aria-hidden>
      {flights.map((flight) => (
        <motion.span
          key={flight.id}
          className="absolute left-0 top-0"
          initial={{ x: flight.from.x, y: flight.from.y, scale: 1, opacity: 1 }}
          animate={{ x: flight.to.x, y: flight.to.y, scale: 0.92, opacity: [1, 1, 0] }}
          transition={{
            duration: 0.34,
            ease: EASE_OUT_EXPO,
            opacity: { duration: 0.34, times: [0, 0.75, 1] },
          }}
          onAnimationComplete={() => onDone(flight.id)}
        >
          <span
            className="block -translate-x-1/2 -translate-y-1/2 rounded-md bg-secondary px-3 py-1.5 text-sm font-mono font-semibold text-secondary-foreground"
            style={{ boxShadow: `0 0 0 2px hsl(var(${flight.colorVar}) / 0.7)` }}
          >
            {flight.label}
          </span>
        </motion.span>
      ))}
    </div>
  );
}
