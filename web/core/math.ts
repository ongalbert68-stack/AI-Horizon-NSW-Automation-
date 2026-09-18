export const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Convert a prior probability into log-odds, so evidence can be added linearly. */
export const toLogit = (p: number) => {
  const safe = clamp(p, 0.001, 0.999);
  return Math.log(safe / (1 - safe));
};

/** 0..100 -> 0..5 stars, rounded to the nearest half then floored to an integer. */
export const toStars = (score0to100: number) =>
  Math.max(0, Math.min(5, Math.round((score0to100 / 100) * 5)));

export const pct = (p: number) => Math.round(p * 100);

/** Coefficient of variation - the dispersion measure behind size consistency. */
export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}
