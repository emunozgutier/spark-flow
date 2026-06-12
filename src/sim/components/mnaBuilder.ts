/**
 * mnaBuilder.ts
 * Formulates and compiles the MnaModel system equations (coefficient matrix and RHS vector)
 * by applying element stamps from parsed SPICE circuit components.
 * Decouples linear contributions (G, s) and non-linear contributions (H, g, J_g).
 */

import { MnaModel } from '../../utils/mnaModel';
import type { BaseElement, ElementStamp } from './stamps/BaseElement';

export interface MnaBuildResult {
  mnaModel: MnaModel;
  nodeMap: Map<string, number>;
  group2Elements: BaseElement[];
  // Decoupled matrices and vectors:
  G: number[][];      // Linear conductance matrix
  s: number[];        // Linear independent source vector
  H: number[][];      // Nonlinear mapping matrix
  g_val: number[];    // Nonlinear element current function values
  J_g: number[][];    // Nonlinear element Jacobian
}

/**
 * Builds the complete MNA system from a list of parsed elements and a standardized nodes tracking array.
 * Decouples elements into linear components (G, s) and non-linear components (H, g, J_g).
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
  const size = N + M;

  // 1. Compile all stamps first to determine the number of nonlinear equations
  const stamps = elementsList.map(el => {
    if (el.getGroup2Count() > 0) {
      const g2Idx = N + group2Elements.indexOf(el);
      return el.getStampGroup2(nodeMap, g2Idx, voltages);
    } else {
      return el.getStampGroup1(nodeMap, voltages);
    }
  });

  // Count total nonlinear equations (P_total)
  let P_total = 0;
  const elementPIndex = new Map<number, number>(); // maps elementsList index to starting p-index in global vectors
  stamps.forEach((stamp, index) => {
    if (stamp.g_local && stamp.g_local.length > 0) {
      elementPIndex.set(index, P_total);
      P_total += stamp.g_local.length;
    }
  });

  // 2. Instantiate G, H, J_g, s, g_val matrices and vectors
  const G = Array.from({ length: size }, () => new Array(size).fill(0.0));
  const s = new Array(size).fill(0.0);
  const H = Array.from({ length: size }, () => new Array(P_total).fill(0.0));
  const g_val = new Array(P_total).fill(0.0);
  const J_g = Array.from({ length: P_total }, () => new Array(size).fill(0.0));

  // 3. Assemble local stamps into global G, H, J_g, s, g_val matrices
  stamps.forEach((stamp, index) => {
    const globalIndices = stamp.globalIndices;
    const localSize = globalIndices.length;

    // Assemble linear G_local matrix
    if (stamp.G_local) {
      for (let r = 0; r < localSize; r++) {
        const gr = globalIndices[r];
        if (gr === -1) continue;
        for (let c = 0; c < localSize; c++) {
          const gc = globalIndices[c];
          if (gc === -1) continue;
          G[gr][gc] += stamp.G_local[r][c];
        }
      }
    }

    // Assemble linear source vector s_local
    if (stamp.s_local) {
      for (let r = 0; r < localSize; r++) {
        const gr = globalIndices[r];
        if (gr === -1) continue;
        s[gr] += stamp.s_local[r];
      }
    }

    // Assemble nonlinear contributions
    if (stamp.g_local && stamp.g_local.length > 0) {
      const pStart = elementPIndex.get(index)!;
      const P_local = stamp.g_local.length;

      // Assemble g(x_k) values
      for (let p = 0; p < P_local; p++) {
        g_val[pStart + p] = stamp.g_local[p];
      }

      // Assemble H mapping matrix
      if (stamp.H_local) {
        for (let r = 0; r < localSize; r++) {
          const gr = globalIndices[r];
          if (gr === -1) continue;
          for (let p = 0; p < P_local; p++) {
            H[gr][pStart + p] += stamp.H_local[r][p];
          }
        }
      }

      // Assemble J_g Jacobian matrix
      if (stamp.Jg_local) {
        for (let p = 0; p < P_local; p++) {
          for (let c = 0; c < localSize; c++) {
            const gc = globalIndices[c];
            if (gc === -1) continue;
            J_g[pStart + p][gc] += stamp.Jg_local[p][c];
          }
        }
      }
    }
  });

  // 4. Construct state vector xState from voltages lookup for companion model calculations
  const xState = new Array(size).fill(0.0);
  if (voltages) {
    activeNodes.forEach((name, idx) => {
      xState[idx] = voltages[name] || 0.0;
    });
  }

  // 5. Compute the combined Jacobian J_f = G + H * J_g
  const H_Jg = Array.from({ length: size }, () => new Array(size).fill(0.0));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let sum = 0.0;
      for (let p = 0; p < P_total; p++) {
        sum += H[r][p] * J_g[p][c];
      }
      H_Jg[r][c] = sum;
    }
  }

  const A = G.map((row, r) => row.map((val, c) => val + H_Jg[r][c]));

  // 6. Compute the companion RHS vector B_eq = s - H * (g - J_g * xState)
  const Jg_x = new Array(P_total).fill(0.0);
  for (let p = 0; p < P_total; p++) {
    let sum = 0.0;
    for (let c = 0; c < size; c++) {
      sum += J_g[p][c] * xState[c];
    }
    Jg_x[p] = sum;
  }

  const g_minus_Jg_x = g_val.map((gp, p) => gp - Jg_x[p]);

  const H_g_minus_Jg_x = new Array(size).fill(0.0);
  for (let r = 0; r < size; r++) {
    let sum = 0.0;
    for (let p = 0; p < P_total; p++) {
      sum += H[r][p] * g_minus_Jg_x[p];
    }
    H_g_minus_Jg_x[r] = sum;
  }

  const B = s.map((sr, r) => sr - H_g_minus_Jg_x[r]);

  // 7. Load into standard MnaModel to satisfy Spice.ts API
  const mnaModel = new MnaModel(N, M);
  for (let r = 0; r < size; r++) {
    mnaModel.setRhs(r, B[r]);
    for (let c = 0; c < size; c++) {
      mnaModel.set(r, c, A[r][c]);
    }
  }

  return {
    mnaModel,
    nodeMap,
    group2Elements,
    G,
    s,
    H,
    g_val,
    J_g
  };
}

import { solveLinearSystem } from './mnaSolver';

export interface NonLinearSolveResult {
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  iterations: number;
  converged: boolean;
  residual: number[];
}

/**
 * Iteratively solves non-linear MNA systems (e.g., networks with BJTs, diodes) using the Newton-Raphson method.
 * Unifies compilation and linear system solving in a single iteration loop matching these 3 equations:
 * 
 * 1) Residual Equation:
 *    f(x) = G * x + H * g(x) - s
 *    Where:
 *      x: State vector containing active node voltages and branch currents.
 *      G: Constant conduction matrix for linear elements.
 *      H * g(x): Non-linear element current/voltage contribution.
 *      s: Independent source vector (voltage and current sources).
 *      f(x): The residual vector of the system equations (we solve for f(x) = 0).
 * 
 * 2) System Jacobian:
 *    J_f(x) = G + H * J_g(x)
 *    Where:
 *      J_g(x): The Jacobian (conductances/derivatives) of the non-linear elements.
 *      J_f(x): The total Jacobian matrix.
 * 
 * 3) Newton Iteration (Direct Solver Step):
 *    J_f(x_k) * x_(k+1) = B_eq
 *    Where:
 *      B_eq: Companion-model equivalent RHS source vector:
 *            B_eq = s - H * (g(x_k) - J_g(x_k) * x_k)
 *      x_(k+1): The next state vector solved directly using Gaussian Elimination.
 * 
 * Convergence is checked by verifying that the residual f(x_k) is within tolerances:
 *   - tolI (1uA) for KCL nodes (current equations, indices < N)
 *   - tolV (1mV) for KVL nodes (voltage equations, indices >= N)
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

  const N = activeNodes.length;
  const M = group2Elements.length;
  const size = N + M;

  // Initialize state vector x (representing x_k at iteration k = 0) with all zeros
  let x = new Array(size).fill(0.0);
  let converged = false;
  let iterations = 0;
  let residual = new Array(size).fill(0.0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // 1. Map state vector x_k to node voltages lookup dictionary
    const voltages: Record<string, number> = { '0': 0 };
    activeNodes.forEach((name, idx) => {
      voltages[name] = x[idx];
    });

    // 2. Build the decoupled system G, H, J_g, s, g_val
    const { G, s, H, g_val, J_g } = buildMna(elementsList, nodes, voltages);
    const P_total = g_val.length;

    // 3. Compute Equation 1: Residual vector f(x_k) = G * x_k + H * g(x_k) - s
    //    We explicitly perform the matrix multiplications for clear traceability
    
    // H * g(x_k) (size: size)
    const H_g = new Array(size).fill(0.0);
    for (let r = 0; r < size; r++) {
      let sum = 0.0;
      for (let p = 0; p < P_total; p++) {
        sum += H[r][p] * g_val[p];
      }
      H_g[r] = sum;
    }

    // G * x_k (size: size)
    const G_x = new Array(size).fill(0.0);
    for (let r = 0; r < size; r++) {
      let sum = 0.0;
      for (let c = 0; c < size; c++) {
        sum += G[r][c] * x[c];
      }
      G_x[r] = sum;
    }

    // f(x_k) = G * x_k + H * g(x_k) - s
    const f_xk = new Array(size).fill(0.0);
    for (let r = 0; r < size; r++) {
      f_xk[r] = G_x[r] + H_g[r] - s[r];
    }
    
    residual = f_xk;

    // 4. Check Convergence using f(x_k)
    let allConverged = true;
    for (let i = 0; i < size; i++) {
      if (i < N) {
        // First N equations correspond to node KCL (currents, check against tolI)
        if (Math.abs(residual[i]) >= tolI) {
          allConverged = false;
          break;
        }
      } else {
        // Remaining M equations correspond to branch KVL (voltages, check against tolV)
        if (Math.abs(residual[i]) >= tolV) {
          allConverged = false;
          break;
        }
      }
    }

    if (allConverged) {
      converged = true;
      break;
    }

    // 5. Compute Equation 2: System Jacobian J_f(x_k) = G + H * J_g(x_k)
    const H_Jg = Array.from({ length: size }, () => new Array(size).fill(0.0));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        let sum = 0.0;
        for (let p = 0; p < P_total; p++) {
          sum += H[r][p] * J_g[p][c];
        }
        H_Jg[r][c] = sum;
      }
    }

    const J_f = G.map((row, r) => row.map((val, c) => val + H_Jg[r][c]));

    // 6. Compute Equation 3: B_eq = s - H * (g(x_k) - J_g(x_k) * x_k)
    // J_g * x_k (size: P_total)
    const Jg_x = new Array(P_total).fill(0.0);
    for (let p = 0; p < P_total; p++) {
      let sum = 0.0;
      for (let c = 0; c < size; c++) {
        sum += J_g[p][c] * x[c];
      }
      Jg_x[p] = sum;
    }

    const g_minus_Jg_x = g_val.map((gp, p) => gp - Jg_x[p]);

    // H * (g - J_g * x_k) (size: size)
    const H_g_minus_Jg_x = new Array(size).fill(0.0);
    for (let r = 0; r < size; r++) {
      let sum = 0.0;
      for (let p = 0; p < P_total; p++) {
        sum += H[r][p] * g_minus_Jg_x[p];
      }
      H_g_minus_Jg_x[r] = sum;
    }

    const B_eq = s.map((sr, r) => sr - H_g_minus_Jg_x[r]);

    // Solve J_f * x_(k+1) = B_eq
    let xNext: number[];
    try {
      xNext = solveLinearSystem(J_f, B_eq);
    } catch (err) {
      break;
    }

    // Move to next step: x_k = x_(k+1)
    x = xNext;
    iterations = iter + 1;
  }

  // Map solution vector back to node voltages and branch currents
  const nodeVoltages: Record<string, number> = { '0': 0 };
  activeNodes.forEach((name, idx) => {
    nodeVoltages[name] = x[idx] || 0;
  });

  const branchCurrents: Record<string, number> = {};
  group2Elements.forEach((el, idx) => {
    branchCurrents[el.name] = x[activeNodes.length + idx] || 0;
  });

  // Calculate Diode and BJT currents (Group 1 elements) if any
  elementsList.forEach((el) => {
    if (el.type === 'diode') {
      const v1 = nodeVoltages[el.node1] || 0;
      const v2 = nodeVoltages[el.node2] || 0;
      const vd = v1 - v2;
      const vdClamped = Math.max(-1.0, Math.min(0.8, vd));
      const Is = 1e-14;
      const Vt = 0.026;
      branchCurrents[el.name] = Is * (Math.exp(vdClamped / Vt) - 1);
    } else if (el.type === 'bjt') {
      const vC = nodeVoltages[el.node1] || 0;
      const vB = nodeVoltages[el.node2] || 0;
      const vE = nodeVoltages[el.node3 || ''] || 0;
      const vbe = vB - vE;
      const vbc = vB - vC;
      const vbeClamped = Math.max(-1.0, Math.min(0.8, vbe));
      const vbcClamped = Math.max(-1.0, Math.min(0.8, vbc));
      const Is = 1e-14;
      const Vt = 0.026;
      const If = Is * (Math.exp(vbeClamped / Vt) - 1);
      const Ir = Is * (Math.exp(vbcClamped / Vt) - 1);
      const betaR = 1;
      const Ic = If - Ir - Ir / betaR;
      branchCurrents[el.name] = Ic;
    } else if (el.type === 'mosfet') {
      const vD = nodeVoltages[el.node1] || 0;
      const vG = nodeVoltages[el.node2] || 0;
      const vS = nodeVoltages[el.node3 || ''] || 0;
      const Vth = el.value;
      const beta = 1e-3;
      let Id = 0;
      if (vD >= vS) {
        const vgs = Math.max(-10, Math.min(10, vG - vS));
        const vds = Math.max(0, Math.min(10, vD - vS));
        if (vgs >= Vth) {
          if (vds < vgs - Vth) {
            Id = beta * ((vgs - Vth) * vds - 0.5 * vds * vds);
          } else {
            Id = 0.5 * beta * (vgs - Vth) * (vgs - Vth);
          }
        }
      } else {
        const vgd = Math.max(-10, Math.min(10, vG - vD));
        const vsd = Math.max(0, Math.min(10, vS - vD));
        if (vgd >= Vth) {
          if (vsd < vgd - Vth) {
            Id = -beta * ((vgd - Vth) * vsd - 0.5 * vsd * vsd);
          } else {
            Id = -0.5 * beta * (vgd - Vth) * (vgd - Vth);
          }
        }
      }
      branchCurrents[el.name] = Id;
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
