/**
 * Vector.ts
 * Class wrapping 1D array representation of a vector.
 */
export class Vector {
  public data: number[];
  public size: number;

  constructor(size: number, data?: number[]) {
    this.size = size;
    if (data) {
      this.data = data;
    } else {
      this.data = new Array(size).fill(0);
    }
  }

  get(index: number): number {
    return this.data[index];
  }

  set(index: number, value: number): void {
    this.data[index] = value;
  }

  isEmpty(): boolean {
    return this.data.every(val => val === 0 || Number.isNaN(val));
  }
}
