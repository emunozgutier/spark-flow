/**
 * mnaBuilder.ts
 * Formulates and compiles the MnaModel system equations (coefficient matrix and RHS vector)
 * by applying element stamps from parsed SPICE circuit components.
 */

import { MnaModel } from '../../utils/mnaModel';
import type { BaseElement, ElementStamp } from './stamps/BaseElement';

export interface MnaBuildResult {
  mnaModel: MnaModel;
  nodeMap: Map<string, number>;
  group2Elements: BaseElement[];
}

/**
 * Builds the complete MNA system from a list of parsed elements and a standardized nodes tracking array.
 */
export function buildMna(elementsList: BaseElement[], nodes: string[], voltages?: Record<string, number>): MnaBuildResult {
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
    let stamp: ElementStamp;
    if (el.getGroup2Count() > 0) {
      const g2Idx = N + group2Elements.indexOf(el);
      stamp = el.getStampGroup2(nodeMap, g2Idx, voltages);
    } else {
      stamp = el.getStampGroup1(nodeMap, voltages);
    }

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

import { solveNonLinearMna } from './mnaSolver';

export interface NonLinearSolveResult {
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  iterations: number;
  converged: boolean;
  residual: number[];
}

/**
 * Iteratively solves non-linear MNA systems (e.g. networks with diodes) using Newton-Raphson.
 * Verifies convergence using residual tolerances (1mV for voltage, 1uA for current).
 */
export function solveNonLinearCircuit(
  elementsList: BaseElement[],
  nodes: string[],
  maxIterations = 50,
  tolV = 1e-3,
  tolI = 1e-6
): NonLinearSolveResult {
  const activeNodes = nodes.filter(n => n !== '0' && n.toUpperCase() !== 'GND');
  
  const group2Elements: BaseElement[] = [];
  elementsList.forEach(el => {
    if (el.getGroup2Count() > 0) {
      group2Elements.push(el);
    }
  });

  const compileSystem = (voltages: Record<string, number>) => {
    const { mnaModel } = buildMna(elementsList, nodes, voltages);
    return {
      A: mnaModel.getMatrix(),
      B: mnaModel.getRhs()
    };
  };

  const group2Names = group2Elements.map(el => el.name);

  const { solution, iterations, converged, residual } = solveNonLinearMna(
    compileSystem,
    activeNodes,
    group2Names,
    maxIterations,
    tolV,
    tolI
  );

  const nodeVoltages: Record<string, number> = { '0': 0 };
  activeNodes.forEach((name, idx) => {
    nodeVoltages[name] = solution[idx] || 0;
  });

  const branchCurrents: Record<string, number> = {};
  group2Elements.forEach((el, idx) => {
    branchCurrents[el.name] = solution[activeNodes.length + idx] || 0;
  });

  // Calculate Diode currents (Group 1 elements) if any
  elementsList.forEach((el) => {
    if (el.type === 'diode') {
      const v1 = nodeVoltages[el.node1] || 0;
      const v2 = nodeVoltages[el.node2] || 0;
      const vd = v1 - v2;
      const vdClamped = Math.max(-1.0, Math.min(0.8, vd));
      const Is = 1e-14;
      const Vt = 0.026;
      branchCurrents[el.name] = Is * (Math.exp(vdClamped / Vt) - 1);
    }
  });

  return {
    nodeVoltages,
    branchCurrents,
    iterations,
    converged,
    residual
  };
}
