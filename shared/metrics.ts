export function percentile(values: number[], p: number) {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const i = (s.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  if (lo === hi) return s[lo]
  return s[lo] * (hi - i) + s[hi] * (i - lo)
}

export function mean(values: number[]) {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function mae(actual: number[], predicted: number[]) {
  if (!actual.length) return 0
  return mean(actual.map((v, i) => Math.abs(v - (predicted[i] ?? 0))))
}

export function seasonalNaiveForecast(series: number[], season = 7) {
  if (series.length < season) return { value: null as number | null, interval: null as [number, number] | null }
  const last = series.slice(-season)
  const value = last[last.length - 1]
  const avg = last.reduce((a, b) => a + b, 0) / last.length
  const blended = 0.6 * value + 0.4 * avg
  const spread = Math.max(1, Math.sqrt(mean(last.map((v) => (v - avg) ** 2))))
  return { value: blended, interval: [Math.max(0, blended - 1.96 * spread), blended + 1.96 * spread] as [number, number] }
}

export function estimatedFuelAndCo2e(km: number, fuelPerKmL: number, emissionKgPerL: number) {
  const litres = km * fuelPerKmL
  return { litres, co2eKg: litres * emissionKgPerL }
}
