export interface ElementStamp {
  globalIndices: number[];
  
  // Linear contributions:
  G_local?: number[][]; // Local linear conductance matrix (size x size)
  s_local?: number[];   // Local independent source vector (size)

  // Nonlinear contributions:
  g_local?: number[];    // Local nonlinear function values (P_local)
  Jg_local?: number[][]; // Local nonlinear Jacobian matrix (P_local x size)
  H_local?: number[][];  // Local nonlinear map matrix (size x P_local)
}

export interface BaseElement {
  name: string;
  type: 'resistor' | 'capacitor' | 'inductor' | 'voltage' | 'current' | 'diode' | 'bjt';
  node1: string;
  node2: string;
  node3?: string;
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
