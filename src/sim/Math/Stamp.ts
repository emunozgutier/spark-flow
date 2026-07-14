import { Matrix } from './Matrix';
import { Vector } from './Vector';

/**
 * Stamp class representing a mathematical stamp configuration.
 * Contains G and H matrices of dimension (elemCnt x nodeCnt) and S vector of size nodeCnt.
 */
export class Stamp {
  public G: Matrix;
  public H: Matrix;
  public Jf: Matrix;
  public Jg: Matrix;
  public S: Vector;
  public nodeCnt: number;
  public elemCnt: number;

  constructor(nodeCnt: number, elemCnt: number) {
    this.nodeCnt = nodeCnt;
    this.elemCnt = elemCnt;
    // vertical rows are set by elemCnt, horizontal cols are set by nodeCnt
    this.G = new Matrix(elemCnt, nodeCnt);
    this.H = new Matrix(elemCnt, nodeCnt);
    this.Jf = new Matrix(elemCnt, nodeCnt);
    this.Jg = new Matrix(elemCnt, nodeCnt);
    this.S = new Vector(nodeCnt);
  }

  makeEmptyStamp(): Stamp {
    return new Stamp(this.nodeCnt, this.elemCnt);
  }
}
