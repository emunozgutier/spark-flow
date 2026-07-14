/**
 * Matrix.ts
 * Class wrapping 2D array representation of a matrix.
 * Supports row/column referencing either by numeric indices or dimension string labels.
 */
export class Matrix {
  public data: number[][];
  public rows: number;
  public cols: number;
  private dimMap: Map<string, number> = new Map();

  constructor(rows: number, cols: number, data?: number[][], dimensions?: string[]) {
    this.rows = rows;
    this.cols = cols;
    if (data) {
      this.data = data;
    } else {
      this.data = Array.from({ length: rows }, () => new Array(cols).fill(0));
    }
    if (dimensions) {
      dimensions.forEach((dim, idx) => {
        this.dimMap.set(dim, idx);
      });
    }
  }

  private getIndex(dim: string | number): number {
    if (typeof dim === 'number') {
      return dim;
    }
    const idx = this.dimMap.get(dim);
    if (idx === undefined) {
      throw new Error(`Dimension "${dim}" not found in matrix.`);
    }
    return idx;
  }

  get(row: string | number, col: string | number): number {
    const r = this.getIndex(row);
    const c = this.getIndex(col);
    return this.data[r][c];
  }

  set(row: string | number, col: string | number, value: number): void {
    const r = this.getIndex(row);
    const c = this.getIndex(col);
    this.data[r][c] = value;
  }

  isEmpty(): boolean {
    return this.data.every(row => row.every(val => val === 0 || Number.isNaN(val)));
  }

  add(other: Matrix): void {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error("Matrix dimensions must match for addition");
    }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.data[r][c] += other.data[r][c];
      }
    }
  }
}
