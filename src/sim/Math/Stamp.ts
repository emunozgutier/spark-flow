import { Matrix } from './Matrix';
import { Vector } from './Vector';

/**
 * Stamp class representing a mathematical stamp configuration.
 * Contains G, H, Jf, and Jg matrices of dimension (D x D) and S vector of size D.
 * The size and mapping are based on mathematical dimensions from SystemBuilder.
 */
export class Stamp {
  public G: Matrix;
  public H: Matrix;
  public Jf: Matrix;
  public Jg: Matrix;
  public S: Vector;
  public dimensions: string[];

  constructor(dimensions: string[]) {
    this.dimensions = dimensions;
    const D = dimensions.length;
    
    this.G = new Matrix(D, D, undefined, dimensions);
    this.H = new Matrix(D, D, undefined, dimensions);
    this.Jf = new Matrix(D, D, undefined, dimensions);
    this.Jg = new Matrix(D, D, undefined, dimensions);
    this.S = new Vector(D, undefined, dimensions);
  }

  makeEmptyStamp(): Stamp {
    return new Stamp(this.dimensions);
  }

  add(other: Stamp): void {
    this.G.add(other.G);
    this.H.add(other.H);
    this.Jf.add(other.Jf);
    this.Jg.add(other.Jg);
    this.S.add(other.S);
  }
}
