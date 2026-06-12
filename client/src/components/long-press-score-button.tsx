import { ReactNode, useLayoutEffect, useRef, useState } from "react";
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
  // Horizontal offset (px, relative to the trigger) that keeps the menu on-screen.
  // Positioned via `left` instead of CSS transforms because Framer Motion owns
  // the inline transform while animating y/scale.
  const [menuLeft, setMenuLeft] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handlers = useLongPress(
    () => setOpen(true),
    () => onTap(),
    { disabled }
  );

  // Before paint: center the menu over the trigger, clamp it to the viewport,
  // and move focus in so keyboard users can pick a multiplier.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (trigger && menu) {
      const margin = 8;
      const triggerRect = trigger.getBoundingClientRect();
      const menuWidth = menu.offsetWidth;
      const centered = triggerRect.left + (triggerRect.width - menuWidth) / 2;
      const maxLeft = document.documentElement.clientWidth - margin - menuWidth;
      const clamped = Math.min(Math.max(centered, margin), Math.max(margin, maxLeft));
      setMenuLeft(clamped - triggerRect.left);
    }
    menu?.querySelector("button")?.focus();
  }, [open]);

  const closeMenu = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const handleSelect = (m: Multiplier) => {
    closeMenu(true);
    onLongSelect(m);
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const items = Array.from(menuRef.current?.querySelectorAll("button") ?? []);
      const idx = items.indexOf(document.activeElement as HTMLButtonElement);
      if (idx === -1 || items.length === 0) return;
      const next = e.key === "ArrowRight" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      items[next].focus();
    }
  };

  return (
    <div className="relative">
      <Button
        {...handlers}
        ref={triggerRef}
        variant="secondary"
        size="sm"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
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
              ref={menuRef}
              initial={{ opacity: 0, y: 6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.92 }}
              transition={{ duration: 0.12 }}
              style={{ left: menuLeft }}
              className="absolute z-50 bottom-full mb-2 flex gap-1 bg-popover border border-border rounded-md p-1 shadow-lg"
              role="menu"
              aria-label="Multiplier"
              onKeyDown={handleMenuKeyDown}
            >
              {multipliers.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="menuitem"
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
