/**
 * Matrix.ts
 * Class wrapping 2D array representation of a matrix.
 */
export class Matrix {
  public data: number[][];
  public rows: number;
  public cols: number;

  constructor(rows: number, cols: number, data?: number[][]) {
    this.rows = rows;
    this.cols = cols;
    if (data) {
      this.data = data;
    } else {
      this.data = Array.from({ length: rows }, () => new Array(cols).fill(0));
    }
  }

  get(row: number, col: number): number {
    return this.data[row][col];
  }

  set(row: number, col: number, value: number): void {
    this.data[row][col] = value;
  }

  isEmpty(): boolean {
    return this.data.every(row => row.every(val => val === 0 || Number.isNaN(val)));
  }
}
