export interface ElementStamp {
  A: number[][];
  B: number[];
  globalIndices: number[];
}

export interface BaseElement {
  name: string;
  type: 'resistor' | 'capacitor' | 'inductor' | 'voltage' | 'current' | 'diode';
  node1: string;
  node2: string;
  value: number;
  isGroup2: boolean;

  /**
   * Returns the number of auxiliary equations (and current variables) this element introduces in MNA.
   */
  getGroup2Count(): number;

  /**
   * Returns the element's local matrix, RHS vector, and global mapping indices for Group 1 formulation.
   * @param nodeMap Map from active node name to 1-based index
   * @param voltages Optional map of current node voltages for non-linear elements
   */
  getStampGroup1(nodeMap: Map<string, number>, voltages?: Record<string, number>): ElementStamp;

  /**
   * Returns the element's local matrix, RHS vector, and global mapping indices for Group 2 formulation.
   * @param nodeMap Map from active node name to 1-based index
   * @param group2Idx The index of the auxiliary equation row/column dedicated to this element's first branch variable
   * @param voltages Optional map of current node voltages for non-linear elements
   */
  getStampGroup2(nodeMap: Map<string, number>, group2Idx: number, voltages?: Record<string, number>): ElementStamp;
}
