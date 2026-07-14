/**
 * Vector.ts
 * Class wrapping 1D array representation of a vector.
 * Supports element referencing either by numeric indices or dimension string labels.
 */
export class Vector {
  public data: number[];
  public size: number;
  private dimMap: Map<string, number> = new Map();

  constructor(size: number, data?: number[], dimensions?: string[]) {
    this.size = size;
    if (data) {
      this.data = data;
    } else {
      this.data = new Array(size).fill(0);
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
      throw new Error(`Dimension "${dim}" not found in vector.`);
    }
    return idx;
  }

  get(index: string | number): number {
    const i = this.getIndex(index);
    return this.data[i];
  }

  set(index: string | number, value: number): void {
    const i = this.getIndex(index);
    this.data[i] = value;
  }

  isEmpty(): boolean {
    return this.data.every(val => val === 0 || Number.isNaN(val));
  }
}
