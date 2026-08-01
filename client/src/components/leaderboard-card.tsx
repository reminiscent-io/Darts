import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { Leaderboard, LeaderboardRow } from "@/lib/player-stats";

interface LeaderboardCardProps {
  board: Leaderboard;
  onSelectPlayer: (name: string) => void;
  /** Rows shown before "show all". */
  previewCount?: number;
}

function Row({
  row,
  rank,
  onSelect,
}: {
  row: LeaderboardRow;
  rank: number;
  onSelect: (name: string) => void;
}) {
  const isLeader = rank === 1;
  return (
    <button
      type="button"
      onClick={() => onSelect(row.player)}
      data-testid={`row-leaderboard-${row.player}`}
      className={`w-full min-h-10 flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
        isLeader
          ? "bg-primary/10 border border-primary/20 hover:bg-primary/15"
          : "bg-muted/20 hover:bg-muted/40"
      }`}
    >
      <span
        className={`w-5 shrink-0 font-mono text-xs ${
          isLeader ? "text-primary" : "text-muted-foreground/60"
        }`}
      >
        {rank}
      </span>
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">
        {row.player}
      </span>
      {row.detail && (
        <span className="shrink-0 text-[11px] text-muted-foreground/60 font-mono">
          {row.detail}
        </span>
      )}
      <span
        className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
          isLeader ? "text-primary" : "text-foreground"
        }`}
      >
        {row.display}
      </span>
    </button>
  );
}

export default function LeaderboardCard({
  board,
  onSelectPlayer,
  previewCount = 3,
}: LeaderboardCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showUnqualified, setShowUnqualified] = useState(false);

  if (board.rows.length === 0 && board.unqualified.length === 0) return null;

  const visible = expanded ? board.rows : board.rows.slice(0, previewCount);
  const hidden = board.rows.length - visible.length;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-sm font-semibold text-foreground">{board.title}</h3>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
          {board.caption}
        </span>
      </div>

      <div className="space-y-1">
        {visible.map((row, i) => (
          <Row key={row.player} row={row} rank={i + 1} onSelect={onSelectPlayer} />
        ))}
        {board.rows.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground/60">
            Nobody has enough games for this board yet.
          </p>
        )}
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full min-h-9 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
        >
          Show all {board.rows.length}
          <ChevronDown className="w-3 h-3" />
        </button>
      )}

      {board.unqualified.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowUnqualified(v => !v)}
            aria-expanded={showUnqualified}
            className="w-full min-h-9 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center justify-center gap-1"
          >
            {board.unqualified.length} player{board.unqualified.length === 1 ? "" : "s"} need more games
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showUnqualified ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {showUnqualified && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden space-y-1"
              >
                {board.unqualified.map(row => (
                  <li key={row.player}>
                    <button
                      type="button"
                      onClick={() => onSelectPlayer(row.player)}
                      className="w-full min-h-9 flex items-center gap-3 px-3 py-1.5 rounded-md text-left hover:bg-muted/30 transition-colors"
                    >
                      <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
                        {row.player}
                      </span>
                      <span className="shrink-0 text-[11px] font-mono text-muted-foreground/60">
                        {row.games} game{row.games === 1 ? "" : "s"}
                      </span>
                      <span className="shrink-0 text-xs font-mono text-muted-foreground/60">
                        {row.display}
                      </span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
