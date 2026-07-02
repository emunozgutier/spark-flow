/**
 * Engineering notation formatting and parsing helpers.
 * Handles power notation with common SI prefixes (f, p, n, u, m, k, M, G).
 */
import type { ESeries } from '../store/useProjectSettings';

export const formatEngineering = (val: number | undefined): string => {
  if (val === undefined || isNaN(val)) return '';
  if (val === 0) return '0';
  
  const absVal = Math.abs(val);
  const prefixes = [
    { value: 1e9, symbol: 'G' },
    { value: 1e6, symbol: 'M' },
    { value: 1e3, symbol: 'k' },
    { value: 1, symbol: '' },
    { value: 1e-3, symbol: 'm' },
    { value: 1e-6, symbol: 'u' },
    { value: 1e-9, symbol: 'n' },
    { value: 1e-12, symbol: 'p' },
    { value: 1e-15, symbol: 'f' }
  ];

  for (let i = 0; i < prefixes.length; i++) {
    const p = prefixes[i];
    if (absVal >= p.value) {
      const num = val / p.value;
      const formattedNum = parseFloat(num.toFixed(3));
      return `${formattedNum}${p.symbol}`;
    }
  }
  
  return val.toExponential(2);
};

export const parseEngineering = (str: string): number => {
  const trimmed = str.trim();
  if (!trimmed) return 0;
  
  const match = trimmed.match(/^([+-]?\d*(?:\.\d+)?)\s*([a-zA-Zµ]?)$/);
  if (!match) return parseFloat(trimmed) || 0;
  
  const [_, numStr, suffix] = match;
  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;
  
  switch (suffix) {
    case 'f': return num * 1e-15;
    case 'p': return num * 1e-12;
    case 'n': return num * 1e-9;
    case 'u':
    case 'µ': return num * 1e-6;
    case 'm': return num * 1e-3;
    case 'k': return num * 1e3;
    case 'M': return num * 1e6;
    case 'G': return num * 1e9;
    default: return num;
  }
};

export const parseInstanceNumber = (str: string, prefixChar: string): number => {
  const numStr = str.replace(new RegExp(`^${prefixChar}`, 'i'), '').trim();
  const parsed = parseInt(numStr, 10);
  return isNaN(parsed) ? 1 : parsed;
};

/**
 * Parses a string representing an electrical value with engineering notations.
 * Translates SPICE-specific case-insensitive 'meg' to standard 'M' and delegates to parseEngineering.
 */
export const parseEngineeringValue = (str: string): number => {
  let normalized = str.trim();
  if (!normalized) return 0;
  
  // SPICE mega suffix is 'meg' (case-insensitive)
  if (normalized.toLowerCase().endsWith('meg')) {
    normalized = normalized.substring(0, normalized.length - 3) + 'M';
  } else if (normalized.toLowerCase().endsWith('k')) {
    normalized = normalized.substring(0, normalized.length - 1) + 'k';
  } else if (normalized.toLowerCase().endsWith('m')) {
    // In SPICE, 'm' represents milli, which maps to 'm' in parseEngineering.
    // 'M' in parseEngineering represents Mega. 
    normalized = normalized.substring(0, normalized.length - 1) + 'm';
  }
  
  return parseEngineering(normalized);
};


const VOLTAGE_STEPS = [-12, -10, -8, -5, -3.3, -1.8, -1.2, -0.8, 0, 0.8, 1.2, 1.8, 3.3, 5, 8, 10, 12];

export const getNextVoltageValue = (currentVal: number, direction: 'up' | 'down'): number => {
  let closestIndex = 0;
  let minDiff = Infinity;
  for (let i = 0; i < VOLTAGE_STEPS.length; i++) {
    const diff = Math.abs(VOLTAGE_STEPS[i] - currentVal);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }

  if (direction === 'up') {
    return VOLTAGE_STEPS[Math.min(VOLTAGE_STEPS.length - 1, closestIndex + 1)];
  } else {
    return VOLTAGE_STEPS[Math.max(0, closestIndex - 1)];
  }
};

export const E_SERIES_VALUES: Record<ESeries, number[]> = {
  E3: [1.0, 2.2, 4.7],
  E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]
};

export const getNextDecadeValue = (
  currentVal: number,
  direction: 'up' | 'down',
  series: ESeries
): number => {
  let val = currentVal;
  if (val <= 0 || isNaN(val)) {
    val = 1.0;
  }

  const decade = Math.floor(Math.log10(val));
  const multiplier = Math.pow(10, decade);
  const normalized = val / multiplier;
  const seriesValues = E_SERIES_VALUES[series];

  let closestIndex = 0;
  let minDiff = Infinity;
  for (let i = 0; i < seriesValues.length; i++) {
    const diff = Math.abs(seriesValues[i] - normalized);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }

  const rawRes = direction === 'up'
    ? (closestIndex < seriesValues.length - 1 ? seriesValues[closestIndex + 1] * multiplier : seriesValues[0] * multiplier * 10)
    : (closestIndex > 0 ? seriesValues[closestIndex - 1] * multiplier : seriesValues[seriesValues.length - 1] * multiplier / 10);

  return parseFloat(rawRes.toPrecision(12));
};

