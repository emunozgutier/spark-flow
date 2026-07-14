import { Stamp } from '../Math/Stamp';
import { Vector } from '../Math/Vector';
import type { SystemBuilder } from './SystemBuilder';
import type { BaseElement } from './stamps/BaseElement';

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
  solveLinearAlgebraicEquation(stamp: Stamp): Vector {
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

  /**
   * Main entry point to solve the equation system.
   * Runs the Newton-Raphson nonlinear solver.
   */
  solve(
    builder: SystemBuilder,
    elementList: BaseElement[],
    dimensions: string[],
    initialVoltages?: Record<string, number>
  ): Vector {
    return this.solveNonLinearAlgebraicEquation(builder, elementList, dimensions, initialVoltages);
  }

  /**
   * Newton-Raphson algorithm to solve the nonlinear algebraic equation system.
   */
  solveNonLinearAlgebraicEquation(
    builder: SystemBuilder,
    elementList: BaseElement[],
    dimensions: string[],
    initialVoltages?: Record<string, number>
  ): Vector {
    const maxIterations = 50;
    const tolerance = 1e-4;

    let currentVoltages: Record<string, number> = { ...initialVoltages };
    let lastSolution: Vector | null = null;

    for (let iter = 0; iter < maxIterations; iter++) {
      const stamp = builder.buildFinalStamp(elementList, dimensions, currentVoltages);
      const solution = this.solveLinearAlgebraicEquation(stamp);

      if (lastSolution) {
        let converged = true;
        for (let i = 0; i < solution.dimensions.length; i++) {
          const dim = solution.dimensions[i];
          if (dim.startsWith('V')) {
            const diff = Math.abs(solution.data[i] - lastSolution.data[i]);
            if (diff > tolerance) {
              converged = false;
              break;
            }
          }
        }
        if (converged) {
          return solution;
        }
      }

      lastSolution = solution;
      currentVoltages = {};
      for (let i = 0; i < solution.dimensions.length; i++) {
        const dim = solution.dimensions[i];
        if (dim.startsWith('V')) {
          const nodeName = dim.substring(1);
          currentVoltages[nodeName] = solution.data[i];
        }
      }
    }

    return lastSolution!;
  }
}
