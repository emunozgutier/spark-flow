/**
 * diodeTest.ts
 * Test for non-linear MNA solver using a diode and resistor circuit.
 */

import { Spice } from '../Spice';

const netlist = `
* Diode Series Circuit
V1 1 0 5
R1 1 2 1000
D1 2 0
`;

console.log('--- Instantiating Modular SPICE Simulator with Diode Netlist ---');
const sim = new Spice(netlist);

console.log('\n--- Parsed Component Elements ---');
sim.elementsList.forEach(el => {
  const g2Info = el.getGroup2Count() > 0 ? ' [Group 2]' : '';
  console.log(`- Element: ${el.name}, Type: ${el.type}${g2Info}, Nodes: [${el.node1}, ${el.node2}], Value: ${el.value}`);
});

console.log('\n--- Running Non-linear Operating Point Simulation ---');
const results = sim.solve();

console.log(results.matrixReport);
console.log('--- Solver Successful! ---');
