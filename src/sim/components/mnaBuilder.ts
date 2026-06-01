/**
 * mnaBuilder.ts
 * Formulates and compiles the MnaModel system equations (coefficient matrix and RHS vector)
 * by applying element stamps from parsed SPICE circuit components.
 */

import { MnaModel } from '../../utils/mnaModel';
import type { BaseElement } from './stamps/BaseElement';

export interface MnaBuildResult {
  mnaModel: MnaModel;
  nodeMap: Map<string, number>;
  group2Elements: BaseElement[];
}

/**
 * Builds the complete MNA system from a list of parsed elements and a standardized nodes tracking array.
 */
export function buildMna(elementsList: BaseElement[], nodes: string[]): MnaBuildResult {
  // Map active nodes (nodes excluding GND / "0") to 1-based indices
  const activeNodes = nodes.filter(n => n !== '0' && n.toUpperCase() !== 'GND');
  const nodeMap = new Map<string, number>();
  activeNodes.forEach((nodeName, index) => {
    nodeMap.set(nodeName, index + 1);
  });

  const N = activeNodes.length;

  // Filter elements that introduce Group 2 variables (voltage sources, inductors, etc.)
  const group2Elements: BaseElement[] = [];
  elementsList.forEach(el => {
    if (el.getGroup2Count() > 0) {
      group2Elements.push(el);
    }
  });

  const M = group2Elements.length;

  // Instantiate MnaModel representing system matrix A and vector B
  const mnaModel = new MnaModel(N, M);

  // Apply stamps for each element by adding their separate local matrices and RHS vectors
  elementsList.forEach(el => {
    const g2Idx = el.getGroup2Count() > 0 ? N + group2Elements.indexOf(el) : 0;
    const stamp = el.getStamp(nodeMap, g2Idx);

    for (let r = 0; r < stamp.A.length; r++) {
      const globalRow = stamp.globalIndices[r];
      if (globalRow === -1) continue;

      mnaModel.addRhs(globalRow, stamp.B[r]);

      for (let c = 0; c < stamp.A[r].length; c++) {
        const globalCol = stamp.globalIndices[c];
        if (globalCol === -1) continue;

        mnaModel.add(globalRow, globalCol, stamp.A[r][c]);
      }
    }
  });

  return {
    mnaModel,
    nodeMap,
    group2Elements
  };
}
