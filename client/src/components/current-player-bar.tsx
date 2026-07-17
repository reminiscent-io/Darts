import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { TEAM_ACTIVE_TURN_CLASSES, TEAM_BG_COLORS, teamColorAt } from "@/lib/team-colors";
import { EASE_OUT_EXPO } from "@/lib/motion";

// The turn-handoff bar. On every turn change it announces the new thrower:
// a one-shot team-color wash that decays, the incoming name sliding up,
// and a single ping from the team dot. All cues play once and settle —
// the bar's resting state stays as quiet as before.

interface CurrentPlayerBarProps {
  /** Changes on every handoff (use the turn index). Drives the one-shot cues. */
  turnKey: string;
  playerName: string;
  teamIndex: number;
  dartsThrown: number;
  roundTotal?: number;
  /** Checkout route for the current thrower (X01), e.g. ["T15", "D8"]. */
  checkout?: string[] | null;
}

export default function CurrentPlayerBar({
  turnKey,
  playerName,
  teamIndex,
  dartsThrown,
  roundTotal,
  checkout,
}: CurrentPlayerBarProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-between px-3 py-2 border-b border-border/50 transition-colors duration-300 ${teamColorAt(
        TEAM_ACTIVE_TURN_CLASSES,
        teamIndex
      )}`}
    >
      {!reducedMotion && (
        <motion.div
          key={`wash-${turnKey}`}
          className={`absolute inset-0 pointer-events-none ${teamColorAt(TEAM_BG_COLORS, teamIndex)}`}
          initial={{ opacity: 0.28 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
          aria-hidden
        />
      )}
      <div className="relative flex items-center gap-2 min-w-0">
        <span className="relative w-2.5 h-2.5 shrink-0">
          <span className={`absolute inset-0 rounded-full ${teamColorAt(TEAM_BG_COLORS, teamIndex)}`} />
          {!reducedMotion && (
            <motion.span
              key={`ping-${turnKey}`}
              className={`absolute inset-0 rounded-full ${teamColorAt(TEAM_BG_COLORS, teamIndex)}`}
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
              aria-hidden
            />
          )}
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={turnKey}
            initial={reducedMotion ? false : { y: 12, opacity: 0, scale: 1.05 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reducedMotion ? undefined : { y: -12, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
            className="text-sm font-medium truncate"
            data-testid="text-current-player"
          >
            {playerName}
          </motion.span>
        </AnimatePresence>
        {roundTotal !== undefined && roundTotal > 0 && (
          <span className="text-xs font-mono text-muted-foreground ml-1">({roundTotal})</span>
        )}
      </div>
      <div className="relative flex items-center gap-3 shrink-0">
        <AnimatePresence initial={false}>
          {checkout && checkout.length > 0 && (
            <motion.div
              key={checkout.join(' ')}
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="flex items-baseline gap-1.5"
              data-testid="checkout-hint"
            >
              <span className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
                Out
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {checkout.join(' · ')}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="relative flex items-center gap-1 shrink-0" data-testid="dart-counter">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
              i < dartsThrown ? "bg-primary" : "bg-muted-foreground/20"
            }`}
            style={{ transitionDelay: dartsThrown === 0 ? `${i * 40}ms` : "0ms" }}
          />
        ))}
        </div>
      </div>
    </div>
  );
}
