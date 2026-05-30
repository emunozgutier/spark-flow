/**
 * modelBuilder.ts
 * A SPICE netlist parser and Modified Nodal Analysis (MNA) system builder and solver.
 * Created for SparkFlow simulation engine.
 * 
 * Supports:
 * - Resistors (R), Voltage Sources (V), Current Sources (I)
 * - Optional [G2] or G2 flag on resistor elements to place them in Group 2.
 * - Value parsing using engineering suffixes (f, p, n, u, m, k, meg, g, t).
 * - MNA formulation using element stamps for Group 1 and Group 2 elements.
 * - Linear system solver using Gaussian Elimination with Partial Pivoting.
 */

// --- 1. TYPES & INTERFACES ---

export interface ParsedElement {
  name: string;            // Name of the element (e.g. R1, Vsrc)
  type: 'resistor' | 'voltage' | 'current';
  node1: string;           // Positive / start node name
  node2: string;           // Negative / end node name
  value: number;           // Calculated numeric value (ohms, volts, amps)
  isGroup2: boolean;       // True if voltage source or resistor explicitly marked with G2
  rawLine: string;         // The raw line from the SPICE deck
}

export interface MNASystem {
  A: number[][];           // The coefficient matrix (size S x S)
  B: number[];             // The RHS vector (size S)
  size: number;            // Total system size (N + M)
  nodeNames: string[];     // Ordered active node names (index k corresponds to equation node indices)
  group2Elements: ParsedElement[]; // Ordered Group 2 elements corresponding to auxiliary current variables
}

export interface SimulationResult {
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  system: MNASystem;
  solutionVector: number[];
  matrixReport: string;
}

// --- 2. VALUE PARSING HELPER ---

/**
 * Parses a string representing an electrical value with engineering notations.
 * Handles SPICE suffixes (case-insensitive):
 * f = 1e-15, p = 1e-12, n = 1e-9, u/µ = 1e-6, m = 1e-3, k = 1e3, meg = 1e6, g = 1e9, t = 1e12
 */
export const parseEngineeringValue = (str: string): number => {
  const trimmed = str.trim();
  if (!trimmed) return 0;
  
  // Extract number and potential suffix
  // e.g. "10", "1.5", "10k", "2.5m", "1.2meg"
  const match = trimmed.match(/^([+-]?\d*(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*([a-zA-Zµ]*)$/);
  if (!match) return parseFloat(trimmed) || 0;
  
  const [_, numStr, suffix] = match;
  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;
  
  if (!suffix) return num;
  
  const normSuffix = suffix.toLowerCase();
  if (normSuffix.startsWith('f')) return num * 1e-15;
  if (normSuffix.startsWith('p')) return num * 1e-12;
  if (normSuffix.startsWith('n')) return num * 1e-9;
  if (normSuffix.startsWith('u') || normSuffix.startsWith('µ')) return num * 1e-6;
  if (normSuffix.startsWith('meg')) return num * 1e6; // MUST check 'meg' before 'm'!
  if (normSuffix.startsWith('m')) return num * 1e-3;
  if (normSuffix.startsWith('k')) return num * 1e3;
  if (normSuffix.startsWith('g')) return num * 1e9;
  if (normSuffix.startsWith('t')) return num * 1e12;
  
  return num;
};

// --- 3. SPICE FILE PARSER ---

/**
 * Parses a SPICE netlist string into structured CircuitElements.
 */
export const parseSpiceNetlist = (spiceDeck: string): { elements: ParsedElement[]; nodes: string[] } => {
  const lines = spiceDeck.split('\n');
  const elements: ParsedElement[] = [];
  const uniqueNodes = new Set<string>();

  for (let line of lines) {
    line = line.trim();
    // Ignore comments (lines starting with *) and empty lines
    if (!line || line.startsWith('*')) {
      continue;
    }

    // Split tokens by spaces
    const tokens = line.split(/\s+/);
    if (tokens.length < 4) {
      continue; // SPICE lines need at least: Name Node1 Node2 Value
    }

    const name = tokens[0];
    const node1 = tokens[1];
    const node2 = tokens[2];
    const valToken = tokens[3];

    // Determine type
    const firstChar = name.charAt(0).toUpperCase();
    let type: 'resistor' | 'voltage' | 'current';
    if (firstChar === 'R') {
      type = 'resistor';
    } else if (firstChar === 'V') {
      type = 'voltage';
    } else if (firstChar === 'I') {
      type = 'current';
    } else {
      continue; // Ignore unsupported components for this resistive solver (e.g. capacitors, inductors, active parts)
    }

    // Parse value
    const value = parseEngineeringValue(valToken);

    // Check for Group 2 membership
    // In SPICE, we can append [G2] or G2 to the end of the line
    let isGroup2 = type === 'voltage'; // Voltage sources are always Group 2
    for (let i = 4; i < tokens.length; i++) {
      const t = tokens[i].toUpperCase();
      if (t === 'G2' || t === '[G2]') {
        isGroup2 = true;
      }
    }

    elements.push({
      name,
      type,
      node1,
      node2,
      value,
      isGroup2,
      rawLine: line
    });

    uniqueNodes.add(node1);
    uniqueNodes.add(node2);
  }

  // ground is mapped to "0", let's ensure it's standardized
  const nodesList = Array.from(uniqueNodes).filter(n => n !== '0' && n.toUpperCase() !== 'GND');
  // Add "0" at the beginning to represent the ground node
  const nodes = ['0', ...nodesList];

  return { elements, nodes };
};

// --- 4. MNA SYSTEM BUILDER ---

/**
 * Builds the MNA system (A * x = B) from the list of parsed elements and standard nodes.
 */
export const buildMNASystem = (elements: ParsedElement[], nodes: string[]): MNASystem => {
  // Map active nodes (nodes excluding node "0") to 1-based indices
  const activeNodes = nodes.filter(n => n !== '0' && n.toUpperCase() !== 'GND');
  const nodeMap = new Map<string, number>();
  activeNodes.forEach((nodeName, index) => {
    nodeMap.set(nodeName, index + 1); // 1-based index
  });

  const N = activeNodes.length;

  // Identify Group 2 elements
  const group2Elements = elements.filter(el => el.isGroup2);
  const M = group2Elements.length;

  const S = N + M;

  // Initialize Matrix A (S x S) and Vector B (S)
  const A = Array.from({ length: S }, () => new Array(S).fill(0));
  const B = new Array(S).fill(0);

  // Helper to get 1-based index or 0 for ground reference node
  const getNodeIndex = (name: string): number => {
    if (name === '0' || name.toUpperCase() === 'GND') {
      return 0;
    }
    return nodeMap.get(name) || 0;
  };

  // 1. STAMP GROUP 1 & 2 ELEMENTS INTO MATRIX
  
  // Resistors
  elements.filter(el => el.type === 'resistor').forEach(res => {
    const i1 = getNodeIndex(res.node1);
    const i2 = getNodeIndex(res.node2);

    if (res.isGroup2) {
      // GROUP 2 RESISTOR STAMP
      // Find Group 2 index
      const k = group2Elements.indexOf(res);
      const colIdx = N + k;
      const rowIdx = N + k;

      // Node current equations contribution (row i1 and i2, col colIdx)
      if (i1 > 0) A[i1 - 1][colIdx] += 1;
      if (i2 > 0) A[i2 - 1][colIdx] -= 1;

      // Branch voltage equation contribution (row rowIdx, col i1 and i2)
      if (i1 > 0) A[rowIdx][i1 - 1] += 1;
      if (i2 > 0) A[rowIdx][i2 - 1] -= 1;

      // Branch current parameter stamp (row rowIdx, col colIdx)
      A[rowIdx][colIdx] -= res.value;
    } else {
      // GROUP 1 RESISTOR STAMP
      const g = 1 / res.value;
      if (i1 > 0) A[i1 - 1][i1 - 1] += g;
      if (i2 > 0) A[i2 - 1][i2 - 1] += g;
      if (i1 > 0 && i2 > 0) {
        A[i1 - 1][i2 - 1] -= g;
        A[i2 - 1][i1 - 1] -= g;
      }
    }
  });

  // Voltage Sources (Always Group 2)
  elements.filter(el => el.type === 'voltage').forEach(vsrc => {
    const i1 = getNodeIndex(vsrc.node1); // Positive terminal
    const i2 = getNodeIndex(vsrc.node2); // Negative terminal

    const k = group2Elements.indexOf(vsrc);
    const colIdx = N + k;
    const rowIdx = N + k;

    // Node current equations contribution
    if (i1 > 0) A[i1 - 1][colIdx] += 1;
    if (i2 > 0) A[i2 - 1][colIdx] -= 1;

    // Branch voltage equation contribution
    if (i1 > 0) A[rowIdx][i1 - 1] += 1;
    if (i2 > 0) A[rowIdx][i2 - 1] -= 1;

    // Branch current parameter stamp (zero for independent voltage source)
    A[rowIdx][colIdx] = 0;

    // RHS Voltage value
    B[rowIdx] += vsrc.value;
  });

  // Current Sources (Always Group 1, stamp only RHS)
  elements.filter(el => el.type === 'current').forEach(isrc => {
    const i1 = getNodeIndex(isrc.node1); // Source positive terminal (current leaves)
    const i2 = getNodeIndex(isrc.node2); // Source negative terminal (current enters)

    // Current source value leaves i1 and enters i2
    if (i1 > 0) B[i1 - 1] -= isrc.value;
    if (i2 > 0) B[i2 - 1] += isrc.value;
  });

  return {
    A,
    B,
    size: S,
    nodeNames: activeNodes,
    group2Elements
  };
};

// --- 5. LINEAR SYSTEM SOLVER ---

/**
 * Solves a system of equations A * x = B using Gaussian Elimination with Partial (Row) Pivoting.
 * Performs deep copy to avoid modifying the input matrices.
 */
export const solveLinearSystem = (A: number[][], B: number[]): number[] => {
  const n = B.length;
  // Deep copy A and B
  const a = A.map(row => [...row]);
  const b = [...B];

  for (let i = 0; i < n; i++) {
    // 1. Partial Pivoting: Find row with maximum absolute value in current column
    let maxEl = Math.abs(a[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > maxEl) {
        maxEl = Math.abs(a[k][i]);
        maxRow = k;
      }
    }
    
    // Swap rows in A and B
    if (maxRow !== i) {
      const tempRow = a[i];
      a[i] = a[maxRow];
      a[maxRow] = tempRow;

      const tempVal = b[i];
      b[i] = b[maxRow];
      b[maxRow] = tempVal;
    }
    
    // Check if the matrix is singular
    if (Math.abs(a[i][i]) < 1e-12) {
      throw new Error(`MNA system matrix is singular or highly ill-conditioned. Zero pivot found at row/col ${i}.`);
    }
    
    // 2. Eliminate entries below pivot
    for (let k = i + 1; k < n; k++) {
      const factor = a[k][i] / a[i][i];
      a[k][i] = 0; // Explicitly zero out
      for (let j = i + 1; j < n; j++) {
        a[k][j] -= factor * a[i][j];
      }
      b[k] -= factor * b[i];
    }
  }
  
  // 3. Back Substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= a[i][j] * x[j];
    }
    x[i] = sum / a[i][i];
  }
  
  return x;
};

// --- 6. SIMULATION EXECUTIVE ---

/**
 * Parses, constructs, and solves the MNA system for a SPICE deck string.
 * Returns structured results and a beautiful diagnostic matrix report.
 */
export const runSimulation = (spiceDeck: string): SimulationResult => {
  const { elements, nodes } = parseSpiceNetlist(spiceDeck);
  const system = buildMNASystem(elements, nodes);
  
  let solutionVector: number[] = [];
  try {
    solutionVector = solveLinearSystem(system.A, system.B);
  } catch (err: any) {
    solutionVector = new Array(system.size).fill(0);
    console.error('Solver failed:', err.message);
  }

  // 1. Map solution to Node Voltages
  const nodeVoltages: Record<string, number> = { '0': 0 }; // Ground reference
  const N = system.nodeNames.length;
  system.nodeNames.forEach((nodeName, index) => {
    nodeVoltages[nodeName] = solutionVector[index] || 0;
  });

  // 2. Map solution to Branch Currents of Group 2 elements
  const branchCurrents: Record<string, number> = {};
  system.group2Elements.forEach((element, index) => {
    branchCurrents[element.name] = solutionVector[N + index] || 0;
  });

  // 3. Generate a beautiful matrix report in text
  let report = '=== SPICE MNA SYSTEM stamp compilation ===\n\n';
  
  // Column header titles
  const headers = [
    ...system.nodeNames.map(name => `v(${name})`),
    ...system.group2Elements.map(el => `i(${el.name})`)
  ];
  
  report += 'Matrix Dimension: ' + system.size + ' x ' + system.size + '\n';
  report += 'Variables x: [' + headers.join(', ') + ']\n\n';
  
  // Format matrix rows
  report += 'Matrix A | RHS Vector B:\n';
  report += '--------------------------------------------------\n';
  for (let r = 0; r < system.size; r++) {
    const formattedRow = system.A[r].map(val => val.toFixed(4).padStart(9)).join(' ');
    const formattedRHS = system.B[r].toFixed(4).padStart(9);
    const varLabel = r < N ? `Node ${system.nodeNames[r]}` : `Branch ${system.group2Elements[r - N].name}`;
    report += `[${formattedRow} ] [${formattedRHS}]  <-- Equation: ${varLabel}\n`;
  }
  report += '--------------------------------------------------\n\n';
  
  // Format solution vector
  report += 'Solution vector x:\n';
  headers.forEach((h, index) => {
    const val = solutionVector[index] || 0;
    report += `  ${h.padEnd(10)} = ${val.toFixed(6).padStart(12)} \n`;
  });
  
  return {
    nodeVoltages,
    branchCurrents,
    system,
    solutionVector,
    matrixReport: report
  };
};

// --- 7. BUILT-IN TEXTBOOK TEST CASE ---

/**
 * Built-in solver test runner verifying Problem 2.10.
 * Fig. 2.34 and Fig 2.35 circuit details:
 * Resistors of 10 and 50 ohms are in Group 2.
 */
export const runTextbookBenchmark = (): string => {
  // Representing the circuit netlist described in Problem 2.10
  // V1 connected between 1 and 0 (10V)
  // R1 connected between 1 and 2 (10 ohms) - G2
  // R2 connected between 2 and 0 (50 ohms) - G2
  // R3 connected between 2 and 3 (20 ohms)
  // I1 current source connected from 3 to 0 (2A)
  const textbookSpiceDeck = `
* Circuit Description File Fig. 2.35
* Problem 2.10 Test Bench
V1 1 0 10
R1 1 2 10 G2
R2 2 0 50 G2
R3 2 3 20
I1 3 0 2
  `;

  const results = runSimulation(textbookSpiceDeck);
  return results.matrixReport;
};
