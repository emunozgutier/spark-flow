/**
 * Engineering notation formatting and parsing helpers.
 * Handles power notation with common SI prefixes (f, p, n, u, m, k, M, G).
 */

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
