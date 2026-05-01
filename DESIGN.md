# DESIGN.md

## Tokens (sourced from `client/src/index.css`)

### Color (HSL, dark theme primary)
- `background` — `220 15% 10%` (deep navy, tinted neutral)
- `foreground` — `210 20% 95%` (warm-white)
- `border` — `220 10% 18%`
- `card` — `220 12% 13%`
- `muted` — `220 10% 16%`
- `muted-foreground` — `210 10% 55%`
- `primary` — `38 95% 55%` (bullseye amber/gold) — also `--ring`, `--sidebar-primary`
- `accent` — `38 30% 18%` (deep amber, surface tint)
- `destructive` — `0 72% 45%`
- `chart-1` — `38 95% 55%` (amber, same as primary)
- `chart-2` — `195 85% 50%` (cyan, used for secondary teams)
- `chart-3` — `270 60% 55%` (violet)
- `chart-4` — `140 50% 50%` (emerald)
- `chart-5` — `15 75% 55%` (coral)

### Typography
- Sans: Inter / DM Sans / system-ui
- Mono: JetBrains Mono / Fira Code (used for all scores, stats, winner names)
- Serif: Georgia (unused in app currently)

### Radii
- `sm` 3px / `md` 6px / `lg` 9px / `--radius` 8px

### Spacing & shadow
- Tailwind defaults; shadows are mostly nulled out (`0px 2px 0px 0px hsl(0 0% 0% / 0)`) — surfaces rely on borders, not elevation.

## Color Strategy

**Restrained-leaning-Committed.** Tinted-navy neutrals carry the room; one saturated amber primary anchors brand and winner attribution. Secondary teams pull from the chart palette (cyan, violet, emerald, coral) but only as labels, never as fills.

The post-game screen is the one surface where the strategy moves toward **Committed** — amber drives 30%+ of the surface for the win moment, then snaps back to Restrained for the stats list and footer.

## Typography Hierarchy

- **Display** — winner name. Mono, weight 700, very large (`text-5xl`+ on mobile, `text-7xl`+ where space allows). Letter-spacing tightened.
- **H1 / score** — final score numerals. Mono, weight 700, `text-3xl`–`text-5xl`.
- **H2 / section label** — uppercase tracked sans, `text-xs`, muted.
- **Row / stat label** — sans, `text-sm` weight 500, muted-foreground for label, foreground for value.
- **Mono everywhere for numerals.** Never use sans for digits.

## Motion Vocabulary

- Framer Motion driven.
- Ease-out exponential curves only (no bounce, no elastic).
- The post-game enter sequence stages: trophy/winner first, scores second, stats third, footer last. Total budget: ~700ms.
- Numerals can count up. Decorative motion (e.g., the bullseye ring expanding) plays once and settles — never loops.

## Components in Use

- `@/components/ui/button` (shadcn new-york)
- `@/components/ui/card` (rarely; the app prefers borders + sections to nested cards)
- `framer-motion` for screen transitions and post-game stagger
- `lucide-react` for icons (Trophy, RotateCcw, Home, etc.)

## Surface Patterns

- Full-height column with header + scrollable body + sticky footer for action buttons.
- Section dividers via `border-b border-border`, not nested cards.
- Stat rows are `bg-muted/20` with `rounded-md`; MVP row gets `bg-primary/8` + `border border-primary/20`. (This is the pattern we are pushing harder in the bolder pass.)

## Source

Reverse-engineered from `client/src/index.css`, `tailwind.config.ts`, and existing screen components (2026-05-01). To regenerate, run `$impeccable document`.
