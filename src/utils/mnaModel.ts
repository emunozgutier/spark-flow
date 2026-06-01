/**
 * mnaModel.ts
 * MnaModel class representing the system coefficient matrix and RHS vector for Modified Nodal Analysis (MNA).
 */

export class MnaModel {
  private size: number;
  private matrix: number[][];
  private rhs: number[];

  constructor(voltageCount: number, currentCount: number) {
    this.size = voltageCount + currentCount;
    this.matrix = Array.from({ length: this.size }, () => new Array(this.size).fill(0));
    this.rhs = new Array(this.size).fill(0);
  }

  /**
   * Returns the total dimension (power) of the matrix.
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Returns the underlying matrix array of arrays.
   */
  getMatrix(): number[][] {
    return this.matrix;
  }

  /**
   * Returns the underlying RHS vector.
   */
  getRhs(): number[] {
    return this.rhs;
  }

  /**
   * Sets a value in the coefficient matrix at the specified 0-indexed row and column.
   */
  set(row: number, col: number, value: number): void {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
      this.matrix[row][col] = value;
    }
  }

  /**
   * Adds a value to the coefficient matrix entry at the specified 0-indexed row and column.
   */
  add(row: number, col: number, value: number): void {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
      this.matrix[row][col] += value;
    }
  }

  /**
   * Sets a value in the RHS vector at the specified 0-indexed row.
   */
  setRhs(row: number, value: number): void {
    if (row >= 0 && row < this.size) {
      this.rhs[row] = value;
    }
  }

  /**
   * Adds a value to the RHS vector entry at the specified 0-indexed row.
   */
  addRhs(row: number, value: number): void {
    if (row >= 0 && row < this.size) {
      this.rhs[row] += value;
    }
  }
}
