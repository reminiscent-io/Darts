import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLongPress } from "@/hooks/use-long-press";
import { Multiplier } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LongPressScoreButtonProps {
  label: ReactNode;
  multipliers?: Multiplier[];
  onTap: () => void;
  onLongSelect: (multiplier: Multiplier) => void;
  highlighted?: boolean;
  disabled?: boolean;
  className?: string;
  testId?: string;
}

export default function LongPressScoreButton({
  label,
  multipliers = [1, 2, 3],
  onTap,
  onLongSelect,
  highlighted = false,
  disabled = false,
  className,
  testId,
}: LongPressScoreButtonProps) {
  const [open, setOpen] = useState(false);

  const handlers = useLongPress(
    () => setOpen(true),
    () => onTap(),
    { disabled }
  );

  const handleSelect = (m: Multiplier) => {
    setOpen(false);
    onLongSelect(m);
  };

  return (
    <div className="relative">
      <Button
        {...handlers}
        variant="secondary"
        size="sm"
        disabled={disabled}
        data-testid={testId}
        className={cn(
          "w-full select-none touch-none",
          highlighted && "ring-2 ring-primary scale-105 bg-primary/20",
          className
        )}
        style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      >
        {label}
      </Button>
      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onPointerDown={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.92 }}
              transition={{ duration: 0.12 }}
              className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 flex gap-1 bg-popover border border-border rounded-md p-1 shadow-lg"
              role="menu"
            >
              {multipliers.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelect(m)}
                  className="font-mono text-sm font-bold tabular-nums w-10 h-10 rounded bg-secondary text-secondary-foreground hover-elevate active-elevate-2"
                  data-testid={testId ? `${testId}-mult-${m}` : undefined}
                >
                  {m}x
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
