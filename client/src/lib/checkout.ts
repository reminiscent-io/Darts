// Checkout route suggestions for X01. Routes follow the conventional
// pub/league out-chart (T20-first, standard leaves like D16/D20) rather
// than arbitrary valid combinations, so players see the finishes they
// already know. Segment notation matches formatDart: S9, D16, T20, SB, DB.

export type CheckoutSegment = string;

export function segmentValue(seg: CheckoutSegment): number {
  if (seg === 'SB') return 25;
  if (seg === 'DB') return 50;
  const mult = seg[0] === 'T' ? 3 : seg[0] === 'D' ? 2 : 1;
  return mult * Number(seg.slice(1));
}

// Conventional routes, 61-170. Entries of length 2 double as the 2-dart
// chart. Bogey numbers (159, 162, 163, 165, 166, 168, 169) are absent.
const OUT_CHART: Record<number, CheckoutSegment[]> = {
  61: ['T15', 'D8'], 62: ['T10', 'D16'], 63: ['T13', 'D12'], 64: ['T16', 'D8'],
  65: ['SB', 'D20'], 66: ['T10', 'D18'], 67: ['T17', 'D8'], 68: ['T20', 'D4'],
  69: ['T19', 'D6'], 70: ['T18', 'D8'], 71: ['T13', 'D16'], 72: ['T16', 'D12'],
  73: ['T19', 'D8'], 74: ['T14', 'D16'], 75: ['T17', 'D12'], 76: ['T20', 'D8'],
  77: ['T19', 'D10'], 78: ['T18', 'D12'], 79: ['T13', 'D20'], 80: ['T20', 'D10'],
  81: ['T19', 'D12'], 82: ['T14', 'D20'], 83: ['T17', 'D16'], 84: ['T20', 'D12'],
  85: ['T15', 'D20'], 86: ['T18', 'D16'], 87: ['T17', 'D18'], 88: ['T16', 'D20'],
  89: ['T19', 'D16'], 90: ['T18', 'D18'], 91: ['T17', 'D20'], 92: ['T20', 'D16'],
  93: ['T19', 'D18'], 94: ['T18', 'D20'], 95: ['T19', 'D19'], 96: ['T20', 'D18'],
  97: ['T19', 'D20'], 98: ['T20', 'D19'], 99: ['T19', 'S10', 'D16'],
  100: ['T20', 'D20'], 101: ['T17', 'DB'], 102: ['T20', 'S10', 'D16'],
  103: ['T19', 'S6', 'D20'], 104: ['T18', 'DB'], 105: ['T20', 'S13', 'D16'],
  106: ['T20', 'S6', 'D20'], 107: ['T19', 'DB'], 108: ['T20', 'S16', 'D16'],
  109: ['T20', 'S9', 'D20'], 110: ['T20', 'DB'], 111: ['T20', 'S19', 'D16'],
  112: ['T20', 'S12', 'D20'], 113: ['T20', 'S13', 'D20'], 114: ['T20', 'S14', 'D20'],
  115: ['T20', 'S15', 'D20'], 116: ['T20', 'S16', 'D20'], 117: ['T20', 'S17', 'D20'],
  118: ['T20', 'S18', 'D20'], 119: ['T19', 'T10', 'D16'], 120: ['T20', 'S20', 'D20'],
  121: ['T20', 'T15', 'D8'], 122: ['T20', 'T18', 'D4'], 123: ['T19', 'T16', 'D9'],
  124: ['T20', 'T16', 'D8'], 125: ['T20', 'T19', 'D4'], 126: ['T19', 'T19', 'D6'],
  127: ['T20', 'T17', 'D8'], 128: ['T18', 'T18', 'D10'], 129: ['T19', 'T16', 'D12'],
  130: ['T20', 'T18', 'D8'], 131: ['T20', 'T13', 'D16'], 132: ['T20', 'T16', 'D12'],
  133: ['T20', 'T19', 'D8'], 134: ['T20', 'T14', 'D16'], 135: ['T20', 'T17', 'D12'],
  136: ['T20', 'T20', 'D8'], 137: ['T20', 'T19', 'D10'], 138: ['T20', 'T18', 'D12'],
  139: ['T20', 'T13', 'D20'], 140: ['T20', 'T20', 'D10'], 141: ['T20', 'T19', 'D12'],
  142: ['T20', 'T14', 'D20'], 143: ['T20', 'T17', 'D16'], 144: ['T20', 'T20', 'D12'],
  145: ['T20', 'T15', 'D20'], 146: ['T20', 'T18', 'D16'], 147: ['T20', 'T17', 'D18'],
  148: ['T20', 'T16', 'D20'], 149: ['T20', 'T19', 'D16'], 150: ['T20', 'T18', 'D18'],
  151: ['T20', 'T17', 'D20'], 152: ['T20', 'T20', 'D16'], 153: ['T20', 'T19', 'D18'],
  154: ['T20', 'T18', 'D20'], 155: ['T20', 'T19', 'D19'], 156: ['T20', 'T20', 'D18'],
  157: ['T20', 'T19', 'D20'], 158: ['T20', 'T20', 'D19'], 160: ['T20', 'T20', 'D20'],
  161: ['T20', 'T17', 'DB'], 164: ['T20', 'T18', 'DB'], 167: ['T20', 'T19', 'DB'],
  170: ['T20', 'T20', 'DB'],
};

function doubleOutFinishDart(n: number): CheckoutSegment | null {
  if (n === 50) return 'DB';
  if (n >= 2 && n <= 40 && n % 2 === 0) return `D${n / 2}`;
  return null;
}

function singleOutFinishDart(n: number): CheckoutSegment | null {
  if (n < 1) return null;
  if (n <= 20) return `S${n}`;
  if (n === 25) return 'SB';
  if (n === 50) return 'DB';
  if (n <= 40 && n % 2 === 0) return `D${n / 2}`;
  if (n <= 60 && n % 3 === 0) return `T${n / 3}`;
  return null;
}

// Conventional setups below 61: throw a single that leaves a standard double.
function lowDoubleOutRoute(n: number): CheckoutSegment[] | null {
  for (const leave of [32, 40, 16, 8, 4, 2]) {
    const setup = n - leave;
    if (setup >= 1 && setup <= 20) return [`S${setup}`, `D${leave / 2}`];
  }
  return null;
}

// First-dart candidates for solver fallbacks, in preference order.
const SETUP_DARTS: CheckoutSegment[] = [
  ...Array.from({ length: 20 }, (_, i) => `T${20 - i}`),
  ...Array.from({ length: 20 }, (_, i) => `S${20 - i}`),
  'SB',
];

function solve(
  n: number,
  dartsLeft: number,
  finishDart: (n: number) => CheckoutSegment | null
): CheckoutSegment[] | null {
  const direct = finishDart(n);
  if (direct) return [direct];
  if (dartsLeft <= 1) return null;
  for (const setup of SETUP_DARTS) {
    const value = segmentValue(setup);
    if (value >= n) continue;
    const rest = solve(n - value, dartsLeft - 1, finishDart);
    if (rest) return [setup, ...rest];
  }
  return null;
}

/**
 * The suggested checkout route for the current thrower, or null when the
 * score can't be finished with the darts remaining in this turn.
 */
export function getCheckoutRoute(
  remaining: number,
  dartsLeft: number,
  doubleOut: boolean
): CheckoutSegment[] | null {
  if (dartsLeft <= 0 || remaining <= 0) return null;
  if (!doubleOut) {
    if (remaining > 60 * dartsLeft) return null;
    return solve(remaining, Math.min(dartsLeft, 3), singleOutFinishDart);
  }
  if (remaining < 2 || remaining > 170) return null;
  const direct = doubleOutFinishDart(remaining);
  if (direct) return [direct];
  if (dartsLeft < 2) return null;
  if (remaining <= 60) return lowDoubleOutRoute(remaining);
  const charted = OUT_CHART[remaining];
  if (charted && charted.length <= dartsLeft) return charted;
  return solve(remaining, Math.min(dartsLeft, 3), doubleOutFinishDart);
}
