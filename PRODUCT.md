# PRODUCT.md

## Product Purpose

Cricket & X01 darts scorekeeper. Mobile-first web app for tracking real-life darts games at the oche, with team or solo play, individual shot attribution, real-time multi-device sync via WebSocket, and a history of completed matches with per-player trend analysis.

The app sits next to a physical dartboard. It is held in one hand, glanced at between throws, tapped quickly with the other hand, sometimes by a player whose throwing arm is still warm. It is not a dashboard. It is not an analytics tool. It is a scorekeeper that should feel like a worn pub scoreboard, not like enterprise software.

## Register

**product** — the design serves an interactive tool. People come here to score a game, not to admire the interface. But the moments that matter (a clean checkout, a closed cricket bed, a match-winning dart) deserve weight.

## Users

- Casual darts players in homes, garages, basements, pubs — phone or tablet propped near the board.
- Mixed skill levels. The same app gets used for friendly "first to 301" bouts and for serious league-style cricket.
- Often two-to-six players in a room, one device passing between them.

The user is rarely alone with the screen. Other players watch over their shoulder. Wins should look like wins from across a room.

## Brand & Tone

- **Voice:** scoreboard-terse, oche-vernacular. "OUT", "CLOSED", "MVP", "CHECKOUT". No marketing copy. No exclamation marks padding things out. The game is the celebration.
- **Aesthetic:** scoreboard-meets-arcade. Mono digits, weighty type, amber-on-navy contrast (the cabinet behind every dartboard ever lit by a hanging lamp). The bullseye is the anchoring metaphor — concentric, focused, unambiguous.
- **Anti-references:**
  - Generic "stats dashboard" cards with icon + heading + supporting text.
  - The hero-metric template (big number, small label, gradient accent).
  - SaaS-cream celebrations with confetti and gradient text.
  - ESPN-style broadcast graphics — too corporate, too animated.
  - Healthcare-app neutrality. This is not neutral. Someone won.

## Strategic Principles

1. **The game is the hero, not the chrome.** Winner name and final scores get the largest type. Stats live below the fold; affordances live in the footer.
2. **Read at arm's length.** Every primary number must be legible from across a room. Mono numerals at display sizes, high contrast.
3. **Celebrate the win, but only once and only big.** The post-game screen is the only place we get loud. The in-game UI stays disciplined.
4. **Mobile-thumb-reachable.** Action buttons sit in the footer, full-width or paired. Never make the user stretch.
5. **Per-player attribution matters.** Cricket and X01 both track individual contribution; stats should make the standout player obvious without being a leaderboard.

## Design Anti-Patterns to Avoid

- Side-stripe borders on stat rows.
- Gradient text on the winner name.
- Generic icon-in-tinted-circle as the only celebration cue.
- Identical card grids of player stats.
- Confetti, sparkles, "Congratulations!" toast copy.
- Modal "share your victory" overlays.

## Source

Inferred from CLAUDE.md (project root), `client/src/pages/*-post-game-screen.tsx`, `client/src/index.css` theme tokens, and `tailwind.config.ts` (2026-05-01).
