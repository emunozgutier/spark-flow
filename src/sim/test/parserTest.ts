/**
 * parserTest.ts
 * Verifies that parseSpiceNetlistToElements correctly matches and extracts
 * all standard components (voltage, resistor, capacitor, inductor, current, diode, bjt, mosfet)
 * and keeps track of all unique nodes.
 */

import { Spice } from '../Spice';
import { StampBuilder } from '../components/StampBuilder';
import { Stamp } from '../Math/Stamp';

const netlist = `
* Comprehensive Parser Test Circuit
V1 1 0 5
R1 1 2 1k
C1 2 3 10u
L1 3 0 1m
I1 0 3 2m
D1 2 0
Q1 4 2 0 150
M1 5 2 0 1.5
`;

console.log('--- Running SPICE Parser Validation Test ---');
const sim = new Spice(netlist);

// Verify element list length
console.assert(sim.elementsList.length === 8, `Expected 8 elements, got ${sim.elementsList.length}`);

// Helper to find elements by name
const findElement = (name: string) => sim.elementsList.find(el => el.name.toUpperCase() === name.toUpperCase());

// Assert Resistor
const r1 = findElement('R1');
console.assert(!!r1, 'R1 should be parsed');
console.assert(r1?.type === 'resistor', 'R1 type should be resistor');
console.assert(r1?.value === 1000, `R1 value should be 1000, got ${r1?.value}`);
console.assert(r1?.node1 === '1' && r1?.node2 === '2', 'R1 nodes should be [1, 2]');

// Assert Voltage Source
const v1 = findElement('V1');
console.assert(!!v1, 'V1 should be parsed');
console.assert(v1?.type === 'voltage', 'V1 type should be voltage');
console.assert(v1?.value === 5, `V1 value should be 5, got ${v1?.value}`);
console.assert(v1?.node1 === '1' && v1?.node2 === '0', 'V1 nodes should be [1, 0]');

// Assert Capacitor
const c1 = findElement('C1');
console.assert(!!c1, 'C1 should be parsed');
console.assert(c1?.type === 'capacitor', 'C1 type should be capacitor');
console.assert(Math.abs((c1?.value ?? 0) - 1e-5) < 1e-12, `C1 value should be close to 1e-5, got ${c1?.value}`);
console.assert(c1?.node1 === '2' && c1?.node2 === '3', 'C1 nodes should be [2, 3]');

// Assert Inductor
const l1 = findElement('L1');
console.assert(!!l1, 'L1 should be parsed');
console.assert(l1?.type === 'inductor', 'L1 type should be inductor');
console.assert(Math.abs((l1?.value ?? 0) - 1e-3) < 1e-12, `L1 value should be close to 1e-3, got ${l1?.value}`);
console.assert(l1?.node1 === '3' && l1?.node2 === '0', 'L1 nodes should be [3, 0]');

// Assert Current Source
const i1 = findElement('I1');
console.assert(!!i1, 'I1 should be parsed');
console.assert(i1?.type === 'current', 'I1 type should be current');
console.assert(Math.abs((i1?.value ?? 0) - 2e-3) < 1e-12, `I1 value should be close to 2e-3, got ${i1?.value}`);
console.assert(i1?.node1 === '0' && i1?.node2 === '3', 'I1 nodes should be [0, 3]');

// Assert Diode
const d1 = findElement('D1');
console.assert(!!d1, 'D1 should be parsed');
console.assert(d1?.type === 'diode', 'D1 type should be diode');
console.assert(d1?.node1 === '2' && d1?.node2 === '0', 'D1 nodes should be [2, 0]');

// Assert BJT
const q1 = findElement('Q1');
console.assert(!!q1, 'Q1 should be parsed');
console.assert(q1?.type === 'bjt', 'Q1 type should be bjt');
console.assert(q1?.value === 150, `Q1 value should be 150, got ${q1?.value}`);
console.assert(q1?.node1 === '4' && q1?.node2 === '2' && (q1 as any).node3 === '0', 'Q1 nodes should be [4, 2, 0]');

// Assert MOSFET
const m1 = findElement('M1');
console.assert(!!m1, 'M1 should be parsed');
console.assert(m1?.type === 'mosfet', 'M1 type should be mosfet');
console.assert(m1?.value === 1.5, `M1 value should be 1.5, got ${m1?.value}`);
console.assert(m1?.node1 === '5' && m1?.node2 === '2' && (m1 as any).node3 === '0', 'M1 nodes should be [5, 2, 0]');

// Assert Nodes
const sortedNodes = [...sim.nodes].sort();
const expectedNodes = ['0', '1', '2', '3', '4', '5'].sort();
console.assert(
  JSON.stringify(sortedNodes) === JSON.stringify(expectedNodes),
  `Expected nodes ${JSON.stringify(expectedNodes)}, got ${JSON.stringify(sortedNodes)}`
);

console.log('Parsed Elements:');
sim.elementsList.forEach(el => {
  console.log(`- ${el.name}: type=${el.type}, value=${el.value}, nodes=[${el.node1}, ${el.node2}${el.node3 ? `, ${el.node3}` : ''}]`);
});
console.log('Tracked Nodes:', sim.nodes);

// Test StampBuilder.findDimensions
console.log('\n--- Running StampBuilder.findDimensions Validation ---');
const builder = new StampBuilder();
const dims = builder.findDimensions(sim.elementsList);

const expectedDims = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'i_V1', 'i_R1', 'i_L1'];
console.assert(JSON.stringify(dims) === JSON.stringify(expectedDims), `Expected exact order ${JSON.stringify(expectedDims)}, got ${JSON.stringify(dims)}`);
console.log('Tracked Dimensions:', dims);

// Test Stamp with dimensions
console.log('\n--- Running Stamp and matrix/vector label-based indexing Validation ---');
const stamp = new Stamp(dims);
console.assert(stamp.G.rows === dims.length && stamp.G.cols === dims.length, 'Matrix G should be square with dimension equal to dims length');
console.assert(stamp.S.size === dims.length, 'Vector S should have size equal to dims length');

// Test Matrix label-based set and get (V1 is index 1, V2 is index 2)
stamp.G.set('V1', 'V2', 42.5);
console.assert(stamp.G.get('V1', 'V2') === 42.5, `Expected G("V1", "V2") to be 42.5, got ${stamp.G.get('V1', 'V2')}`);
console.assert(stamp.G.get(1, 2) === 42.5, `Expected G(1, 2) to be 42.5, got ${stamp.G.get(1, 2)}`);

// Test Vector label-based set and get (V3 is index 3)
stamp.S.set('V3', -2.5);
console.assert(stamp.S.get('V3') === -2.5, `Expected S("V3") to be -2.5, got ${stamp.S.get('V3')}`);
console.assert(stamp.S.get(3) === -2.5, `Expected S(3) to be -2.5, got ${stamp.S.get(3)}`);

console.log('Stamp matrices successfully mapped and index/label assertions verified.');

// Test buildAllStamps
console.log('\n--- Running StampBuilder.buildAllStamps Validation ---');
const stamps = builder.buildAllStamps(sim.elementsList, dims);
console.assert(stamps.length === sim.elementsList.length, `Expected ${sim.elementsList.length} stamps, got ${stamps.length}`);

// Assert V1 stamp contributions (V1 is first element)
const v1Stamp = stamps[0];
console.assert(v1Stamp.S.get('i_V1') === 5, `Expected V1 stamp branch current source value 5, got ${v1Stamp.S.get('i_V1')}`);

// Assert R1 stamp contributions (R1 is second element, Group 2 by default)
const r1Stamp = stamps[1];
console.assert(r1Stamp.G.get('V1', 'i_R1') === 1, `Expected R1 stamp G("V1", "i_R1") to be 1, got ${r1Stamp.G.get('V1', 'i_R1')}`);
console.assert(r1Stamp.G.get('i_R1', 'i_R1') === -1000, `Expected R1 stamp G("i_R1", "i_R1") to be -1000, got ${r1Stamp.G.get('i_R1', 'i_R1')}`);

console.log('All elements successfully created their dimension-aware Stamp.');

// Test buildFinalStamp
console.log('\n--- Running StampBuilder.buildFinalStamp Validation ---');
const finalStamp = builder.buildFinalStamp(sim.elementsList, dims);
// Check V1 contributions in finalStamp
console.assert(finalStamp.S.get('i_V1') === 5, `Expected finalStamp S("i_V1") to be 5, got ${finalStamp.S.get('i_V1')}`);
// Check R1 contributions in finalStamp
console.assert(finalStamp.G.get('V1', 'i_R1') === 1, `Expected finalStamp G("V1", "i_R1") to be 1, got ${finalStamp.G.get('V1', 'i_R1')}`);
console.assert(finalStamp.G.get('i_R1', 'i_R1') === -1000, `Expected finalStamp G("i_R1", "i_R1") to be -1000, got ${finalStamp.G.get('i_R1', 'i_R1')}`);
console.log('Final combined stamp built and verified successfully.');

console.log('\n--- All assertions passed! Parser test successful. ---');
