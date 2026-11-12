export type SequenceItem = number | 'real';

// One public timeline: totals, lap differences and resume all use this value.
export function captureTime(elapsedMs: number, previousTotalMs: number, value: SequenceItem, minimumTotalMs = previousTotalMs) {
  const minimum = Math.max(previousTotalMs, minimumTotalMs);
  const elapsed = Math.floor(Math.max(minimum, elapsedMs) / 10) * 10;
  let totalMs = value === 'real' ? elapsed : Math.floor(elapsed / 1000) * 1000 + value * 10;
  // A very quick tap must not produce a negative lap when the chosen hundredths wrap.
  if (totalMs < minimum) totalMs += 1000;
  return { totalMs, lapMs: totalMs - previousTotalMs };
}
