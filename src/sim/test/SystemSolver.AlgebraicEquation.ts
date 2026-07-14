/**
 * SystemSolver.AlgebraicEquation.ts
 * Unit tests validating algebraic equations on various resistor/voltage circuits.
 */

import { Spice } from '../Spice';

console.log('=== Running SystemSolver Algebraic Equation Tests ===');

// --- Case 1: 3 resistors in parallel ---
console.log('\n--- Case 1: 3 Resistors in Parallel ---');
const netlist1 = `
V1 1 0 10
R1 1 0 1000
R2 1 0 2000
R3 1 0 5000
`;
const sim1 = new Spice(netlist1);
const sol1 = sim1.solve();

const v1_1 = sol1.get('V1');
const v0_1 = sol1.get('V0');
const iV1_1 = sol1.get('i_V1'); // current flowing from node 0 to node 1 inside source

console.log(`V(1) = ${v1_1.toFixed(4)} V (Expected: 10.0000 V)`);
console.log(`V(0) = ${v0_1.toFixed(4)} V (Expected: 0.0000 V)`);
console.log(`I(V1) = ${iV1_1.toFixed(6)} A (Expected: -0.017000 A)`);

console.assert(Math.abs(v1_1 - 10) < 1e-5, 'Case 1: V(1) should be 10V');
console.assert(Math.abs(v0_1 - 0) < 1e-5, 'Case 1: V(0) should be 0V');
console.assert(Math.abs(iV1_1 - (-0.017)) < 1e-5, 'Case 1: Current through V1 should be -17mA');


// --- Case 2: 2 resistors in parallel + series resistor ---
console.log('\n--- Case 2: 2 Resistors in Parallel + Series Resistor ---');
const netlist2 = `
V1 1 0 12
R1 1 2 1000
R2 1 2 1000
R3 2 0 500
`;
const sim2 = new Spice(netlist2);
const sol2 = sim2.solve();

const v1_2 = sol2.get('V1');
const v2_2 = sol2.get('V2');
const v0_2 = sol2.get('V0');
const iV1_2 = sol2.get('i_V1');

console.log(`V(1) = ${v1_2.toFixed(4)} V (Expected: 12.0000 V)`);
console.log(`V(2) = ${v2_2.toFixed(4)} V (Expected: 6.0000 V)`);
console.log(`V(0) = ${v0_2.toFixed(4)} V (Expected: 0.0000 V)`);
console.log(`I(V1) = ${iV1_2.toFixed(6)} A (Expected: -0.012000 A)`);

console.assert(Math.abs(v1_2 - 12) < 1e-5, 'Case 2: V(1) should be 12V');
console.assert(Math.abs(v2_2 - 6) < 1e-5, 'Case 2: V(2) should be 6V');
console.assert(Math.abs(v0_2 - 0) < 1e-5, 'Case 2: V(0) should be 0V');
console.assert(Math.abs(iV1_2 - (-0.012)) < 1e-5, 'Case 2: Current through V1 should be -12mA');


// --- Case 3: Complex Wheatstone Bridge network ---
console.log('\n--- Case 3: Complex Wheatstone Bridge Network ---');
const netlist3 = `
V1 1 0 10
R1 1 2 1000
R2 1 3 2000
R3 2 3 500
R4 2 0 2000
R5 3 0 1000
`;
const sim3 = new Spice(netlist3);
const sol3 = sim3.solve();

const v1_3 = sol3.get('V1');
const v2_3 = sol3.get('V2');
const v3_3 = sol3.get('V3');
const v0_3 = sol3.get('V0');

const expectedV2 = 60 / 11; // ~5.4545V
const expectedV3 = 50 / 11; // ~4.5454V

console.log(`V(1) = ${v1_3.toFixed(4)} V (Expected: 10.0000 V)`);
console.log(`V(2) = ${v2_3.toFixed(4)} V (Expected: ${expectedV2.toFixed(4)} V)`);
console.log(`V(3) = ${v3_3.toFixed(4)} V (Expected: ${expectedV3.toFixed(4)} V)`);
console.log(`V(0) = ${v0_3.toFixed(4)} V (Expected: 0.0000 V)`);

console.assert(Math.abs(v1_3 - 10) < 1e-5, 'Case 3: V(1) should be 10V');
console.assert(Math.abs(v2_3 - expectedV2) < 1e-5, `Case 3: V(2) should be ${expectedV2.toFixed(4)}V`);
console.assert(Math.abs(v3_3 - expectedV3) < 1e-5, `Case 3: V(3) should be ${expectedV3.toFixed(4)}V`);
console.assert(Math.abs(v0_3 - 0) < 1e-5, 'Case 3: V(0) should be 0V');

console.log('\n=== All SystemSolver Algebraic Equation tests passed successfully! ===');
