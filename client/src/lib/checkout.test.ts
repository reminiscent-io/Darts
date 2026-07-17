import { describe, it, expect } from 'vitest';
import { getCheckoutRoute, segmentValue } from './checkout';

// Every throwable segment, for the brute-force reference.
const ALL_SEGMENTS: string[] = [
  ...Array.from({ length: 20 }, (_, i) => `S${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `D${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `T${i + 1}`),
  'SB',
  'DB',
];

const isDouble = (seg: string) => seg === 'DB' || seg.startsWith('D');

function bruteForceFinishable(remaining: number, dartsLeft: number, doubleOut: boolean): boolean {
  if (remaining <= 0 || dartsLeft <= 0) return false;
  for (const seg of ALL_SEGMENTS) {
    const value = segmentValue(seg);
    if (value === remaining && (!doubleOut || isDouble(seg))) return true;
    if (value < remaining && bruteForceFinishable(remaining - value, dartsLeft - 1, doubleOut)) {
      return true;
    }
  }
  return false;
}

describe('getCheckoutRoute', () => {
  for (const doubleOut of [true, false]) {
    describe(doubleOut ? 'double out' : 'single out', () => {
      for (let dartsLeft = 1; dartsLeft <= 3; dartsLeft++) {
        it(`is valid and complete for all scores with ${dartsLeft} dart(s) left`, () => {
          for (let remaining = 2; remaining <= 170; remaining++) {
            const route = getCheckoutRoute(remaining, dartsLeft, doubleOut);
            const finishable = bruteForceFinishable(remaining, dartsLeft, doubleOut);
            if (route === null) {
              expect(finishable, `${remaining} with ${dartsLeft} darts is finishable but got null`).toBe(false);
              continue;
            }
            expect(finishable).toBe(true);
            expect(route.length).toBeGreaterThan(0);
            expect(route.length).toBeLessThanOrEqual(dartsLeft);
            const total = route.reduce((sum, seg) => sum + segmentValue(seg), 0);
            expect(total, `${remaining}: ${route.join(' ')} sums to ${total}`).toBe(remaining);
            if (doubleOut) {
              expect(isDouble(route[route.length - 1]), `${remaining}: ${route.join(' ')} must end on a double`).toBe(true);
            }
            for (const seg of route) {
              expect(ALL_SEGMENTS).toContain(seg);
            }
          }
        });
      }
    });
  }

  it('suggests the conventional big finishes', () => {
    expect(getCheckoutRoute(170, 3, true)).toEqual(['T20', 'T20', 'DB']);
    expect(getCheckoutRoute(167, 3, true)).toEqual(['T20', 'T19', 'DB']);
    expect(getCheckoutRoute(61, 3, true)).toEqual(['T15', 'D8']);
    expect(getCheckoutRoute(40, 3, true)).toEqual(['D20']);
    expect(getCheckoutRoute(32, 1, true)).toEqual(['D16']);
    expect(getCheckoutRoute(50, 1, true)).toEqual(['DB']);
  });

  it('returns null for bogey numbers with double out', () => {
    for (const bogey of [159, 162, 163, 165, 166, 168, 169]) {
      expect(getCheckoutRoute(bogey, 3, true)).toBeNull();
    }
  });

  it('adapts to darts remaining in the turn', () => {
    // 99 needs three darts; with two left there is no out.
    expect(getCheckoutRoute(99, 3, true)).toEqual(['T19', 'S10', 'D16']);
    expect(getCheckoutRoute(99, 2, true)).toBeNull();
    // 110 is a two-dart finish.
    expect(getCheckoutRoute(110, 2, true)).toEqual(['T20', 'DB']);
    expect(getCheckoutRoute(110, 1, true)).toBeNull();
  });
});
