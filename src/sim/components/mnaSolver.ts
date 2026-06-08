/**
 * mnaSolver.ts
 * Shareable linear system solver utilizing Gaussian Elimination with Partial Pivoting.
 */

/**
 * Solves a system of linear equations A * x = B using Gaussian Elimination with Partial (Row) Pivoting.
 * Performs deep copy to avoid modifying the input matrices.
 * @throws Error if the matrix is singular or highly ill-conditioned.
 */
export const solveLinearSystem = (A: number[][], B: number[]): number[] => {
  const n = B.length;
  // Deep copy A and B
  const a = A.map(row => [...row]);
  const b = [...B];

  for (let i = 0; i < n; i++) {
    // 1. Partial Pivoting: Find row with maximum absolute value in current column
    let maxEl = Math.abs(a[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > maxEl) {
        maxEl = Math.abs(a[k][i]);
        maxRow = k;
      }
    }
    
    // Swap rows in A and B
    if (maxRow !== i) {
      const tempRow = a[i];
      a[i] = a[maxRow];
      a[maxRow] = tempRow;

      const tempVal = b[i];
      b[i] = b[maxRow];
      b[maxRow] = tempVal;
    }
    
    // Check if the matrix is singular
    if (Math.abs(a[i][i]) < 1e-12) {
      throw new Error(`MNA system matrix is singular or highly ill-conditioned. Zero pivot found at row/col ${i}.`);
    }
    
    // 2. Eliminate entries below pivot
    for (let k = i + 1; k < n; k++) {
      const factor = a[k][i] / a[i][i];
      a[k][i] = 0; // Explicitly zero out
      for (let j = i + 1; j < n; j++) {
        a[k][j] -= factor * a[i][j];
      }
      b[k] -= factor * b[i];
    }
  }
  
  // 3. Back Substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= a[i][j] * x[j];
    }
    x[i] = sum / a[i][i];
  }
  
  return x;
};

/**
 * Solves a non-linear system using Newton-Raphson.
 * @param compileSystem Callback to compile the system matrix A and RHS B for a given voltage record.
 * @param nodeNames The active node names.
 * @param group2Names The names of Group 2 elements.
 * @param maxIterations Maximum Newton-Raphson iterations.
 * @param tolV Voltage tolerance (1mV).
 * @param tolI Current tolerance (1uA).
 */
export function solveNonLinearMna(
  compileSystem: (voltages: Record<string, number>) => { A: number[][]; B: number[] },
  nodeNames: string[],
  group2Names: string[],
  maxIterations = 50,
  tolV = 1e-3,
  tolI = 1e-6
): {
  solution: number[];
  iterations: number;
  converged: boolean;
  residual: number[];
} {
  const N = nodeNames.length;
  const M = group2Names.length;
  const size = N + M;

  // Initial guess: all zeros
  let voltages: Record<string, number> = { '0': 0 };
  nodeNames.forEach(name => {
    voltages[name] = 0.0;
  });

  let x = new Array(size).fill(0);
  let converged = false;
  let iterations = 0;
  let residual = new Array(size).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;
    const { A, B } = compileSystem(voltages);
    if (A.length === 0) {
      break;
    }

    // Solve for the next guess: A * xNext = B
    let xNext: number[];
    try {
      xNext = solveLinearSystem(A, B);
    } catch (err) {
      // If linear system fails to solve, stop
      break;
    }

    // Update state to xNext
    x = xNext;

    // Update voltages for next iteration and residual calculation
    const nextVoltages: Record<string, number> = { '0': 0 };
    nodeNames.forEach((name, idx) => {
      nextVoltages[name] = x[idx];
    });
    voltages = nextVoltages;

    // Compile at the new voltages to compute residual f(xNext)
    const compiledNext = compileSystem(voltages);
    const A_next = compiledNext.A;
    const B_next = compiledNext.B;

    residual = new Array(size).fill(0);
    for (let r = 0; r < size; r++) {
      let sum = 0;
      for (let c = 0; c < size; c++) {
        sum += A_next[r][c] * x[c];
      }
      residual[r] = sum - B_next[r];
    }

    // Check convergence of the new state residual
    let allConverged = true;
    for (let i = 0; i < size; i++) {
      if (i < N) {
        if (Math.abs(residual[i]) >= tolI) {
          allConverged = false;
          break;
        }
      } else {
        if (Math.abs(residual[i]) >= tolV) {
          allConverged = false;
          break;
        }
      }
    }

    if (allConverged) {
      converged = true;
      break;
    }
  }

  return {
    solution: x,
    iterations,
    converged,
    residual
  };
}
