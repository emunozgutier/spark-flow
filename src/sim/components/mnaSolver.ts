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
