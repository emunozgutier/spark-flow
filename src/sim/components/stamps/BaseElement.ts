/**
 * BaseElement.ts
 * Defines the common interface for all modular SPICE element stamp classes.
 */

import type { MnaModel } from '../../../utils/mnaModel';

export interface BaseElement {
  name: string;
  type: 'resistor' | 'capacitor' | 'inductor' | 'voltage' | 'current';
  node1: string;
  node2: string;
  value: number;
  isGroup2: boolean;

  /**
   * Returns the number of auxiliary equations (and current variables) this element introduces in MNA.
   */
  getGroup2Count(): number;

  /**
   * Stamps the element's coefficients into the global MNA system matrices.
   * @param matrix The MnaModel coordinator managing the matrix and RHS entries
   * @param nodeMap Map from active node name to 1-based index
   * @param group2Idx The index of the auxiliary equation row/column dedicated to this element's first branch variable
   */
  applyStamp(matrix: MnaModel, nodeMap: Map<string, number>, group2Idx: number): void;
}
