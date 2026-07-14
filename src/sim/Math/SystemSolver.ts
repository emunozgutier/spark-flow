import { Stamp } from './Stamp';
import { Vector } from './Vector';

/**
 * SystemSolver.ts
 * Solves mathematical equations derived from the stamped SystemBuilder.
 */
export class SystemSolver {
  /**
   * Solves the linear equation G * x - s = 0 (equivalent to G * x = s)
   * using Gaussian elimination with partial pivoting.
   * Returns the solution Vector x.
   */
  solveAlgebraicEquation(stamp: Stamp): Vector {
    const dims = stamp.dimensions;
    const n = dims.length;

    // Enforce V0 is GND (0V) if present
    const gndIdx = dims.indexOf('V0');
    if (gndIdx !== -1) {
      for (let c = 0; c < n; c++) {
        stamp.G.set('V0', dims[c], c === gndIdx ? 1 : 0);
      }
      stamp.S.set('V0', 0);
    }

    const A = stamp.G.data.map(row => [...row]);
    const B = [...stamp.S.data];

    for (let i = 0; i < n; i++) {
      // 1. Partial Pivoting
      let maxEl = Math.abs(A[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > maxEl) {
          maxEl = Math.abs(A[k][i]);
          maxRow = k;
        }
      }

      // Swap rows in A and B
      const tempRow = A[maxRow];
      A[maxRow] = A[i];
      A[i] = tempRow;

      const tempVal = B[maxRow];
      B[maxRow] = B[i];
      B[i] = tempVal;

      // Singular check/perturbation
      if (Math.abs(A[i][i]) < 1e-12) {
        A[i][i] = 1e-12;
      }

      // 2. Elimination
      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / A[i][i];
        for (let j = i; j < n; j++) {
          if (i === j) {
            A[k][j] = 0;
          } else {
            A[k][j] += c * A[i][j];
          }
        }
        B[k] += c * B[i];
      }
    }

    // 3. Back substitution
    const xData = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = B[i];
      for (let j = i + 1; j < n; j++) {
        sum -= A[i][j] * xData[j];
      }
      xData[i] = sum / A[i][i];
    }

    return new Vector(n, xData, dims);
  }
}
