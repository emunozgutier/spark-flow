const elementsText = `R1.190.-50~R2.360.0..50~GND1.130.200..slate~R3.210.60..10~T.join-1780645267972.152.137.16.16.amber.join~W.GND1.t.join-1780645267972.b.amber~T.join-1780645279085.152.72.16.16.amber.join~W.R1.l.join-1780645279085.t.amber~W.join-1780645279085.b.join-1780645267972.t.amber~W.R3.l.join-1780645279085.r.amber~T.join-1780647108155.296.12.16.16.amber.join~W.R1.r.join-1780647108155.l.amber~W.join-1780647108155.b.R3.r.amber~W.R2.l.join-1780647108155.r.amber~D1.610.0~R4.510.0~W.D1.l.R4.r.amber~V1.430.60.90~T.join-1780900970320.462.12.16.16.amber.join~W.R2.r.join-1780900970320.l.amber.straight~W.join-1780900970320.r.R4.l.amber.straight~W.V1.l.join-1780900970320.b.sapphire~T.join-1780900972000.462.137.16.16.amber.join~W.join-1780645267972.r.join-1780900972000.l.amber~W.join-1780900972000.r.D1.r.amber~W.V1.r.join-1780900972000.t.sapphire`;

const codeToSocket = (code) => {
  if (code === 'l') return 'left';
  if (code === 'r') return 'right';
  if (code === 't') return 'top';
  if (code === 'b') return 'bottom';
  return 'left';
};

const deserializeElements = (stateStr) => {
  const elements = [];
  const parts = stateStr.trim().split('~').map(p => p.trim()).filter(Boolean);

  parts.forEach((part) => {
    const fields = part.split('.');
    const type = fields[0];

    if (type === 'W') {
      const fromShort = fields[1] || '';
      const fromId = /^\d+$/.test(fromShort) ? `card-${fromShort}` : fromShort;
      const fromSocket = codeToSocket(fields[2]);
      const toShort = fields[3] || '';
      const toId = /^\d+$/.test(toShort) ? `card-${toShort}` : toShort;
      const toSocket = codeToSocket(fields[4]);
      elements.push({ id: `arrow-${Date.now()}`, type: 'arrow', fromId, fromSocket, toId, toSocket });
    } else if (type === 'T') {
      const shortId = fields[1] || '';
      const id = /^\d+$/.test(shortId) ? `card-${shortId}` : shortId;
      const x = parseInt(fields[2]) || 0;
      const y = parseInt(fields[3]) || 0;
      elements.push({ id, type: 'box', x, y, title: fields[7] });
    } else if (/^R\d+$/.test(type)) {
      const id = type;
      const value = fields[4] ? parseFloat(fields[4]) : 1000;
      elements.push({ id, type: 'box', componentType: 'resistor', value, isGroup2: true }); // SET isGroup2 TO TRUE
    } else if (/^D\d+$/.test(type)) {
      elements.push({ id: type, type: 'box', componentType: 'diode' });
    } else if (/^GND\d*$/.test(type)) {
      elements.push({ id: type, type: 'box', componentType: 'ground' });
    } else if (/^V\d+$/.test(type)) {
      const value = fields[4] ? parseFloat(fields[4]) : 5;
      elements.push({ id: type, type: 'box', componentType: 'voltage', value });
    }
  });
  return elements;
};

const cards = deserializeElements(elementsText).filter(e => e.type === 'box');
const arrows = deserializeElements(elementsText).filter(e => e.type === 'arrow');

class UF {
  parent = {};
  find(id) {
    if (!this.parent[id]) this.parent[id] = id;
    if (this.parent[id] === id) return id;
    this.parent[id] = this.find(this.parent[id]);
    return this.parent[id];
  }
  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX !== rootY) this.parent[rootX] = rootY;
  }
}

const uf = new UF();
cards.forEach((card) => {
  if (card.id.startsWith('join') || card.title === 'join') {
    uf.union(`${card.id}-top`, `${card.id}-right`);
    uf.union(`${card.id}-top`, `${card.id}-bottom`);
    uf.union(`${card.id}-top`, `${card.id}-left`);
  }
});

arrows.forEach((w) => {
  if (w.fromId && w.fromSocket && w.toId && w.toSocket) {
    uf.union(`${w.fromId}-${w.fromSocket}`, `${w.toId}-${w.toSocket}`);
  }
});

const groups = {};
cards.forEach((card) => {
  const isGround = card.componentType === 'ground';
  const isJoin = card.id.startsWith('join') || card.title === 'join';
  const portsList = isGround ? ['top'] : (isJoin ? ['top', 'right', 'bottom', 'left'] : ['left', 'right']);
  
  portsList.forEach((socket) => {
    const pin = `${card.id}-${socket}`;
    const root = uf.find(pin);
    if (!groups[root]) groups[root] = [];
    groups[root].push(pin);
  });
});

const gndRoots = new Set();
Object.keys(groups).forEach((root) => {
  const hasGndPin = groups[root].some((pin) => {
    const cardId = pin.substring(0, pin.lastIndexOf('-'));
    const card = cards.find((c) => c.id === cardId);
    return card?.componentType === 'ground';
  });
  if (hasGndPin) gndRoots.add(root);
});

const rootToNodeName = {};
let nodeCounter = 1;
gndRoots.forEach((root) => {
  rootToNodeName[root] = '0';
});

if (gndRoots.size === 0 && Object.keys(groups).length > 0) {
  const defaultGnd = Object.keys(groups)[0];
  rootToNodeName[defaultGnd] = '0';
  gndRoots.add(defaultGnd);
}

Object.keys(groups).forEach((root) => {
  if (gndRoots.has(root)) return;
  rootToNodeName[root] = String(nodeCounter++);
});

const getPinNode = (cardId, socket) => {
  const root = uf.find(`${cardId}-${socket}`);
  return rootToNodeName[root] || '0';
};

const nodeCount = nodeCounter - 1;
const voltageSources = cards.filter((c) => c.componentType === 'voltage' || c.componentType === 'acvoltage');
const group2Resistors = cards.filter((c) => c.componentType === 'resistor' && c.isGroup2);
const inductors = cards.filter((c) => c.componentType === 'inductor');
const group2Elements = [...voltageSources, ...inductors, ...group2Resistors];
const mnaSize = nodeCount + group2Elements.length;

const A_sys = Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0));
const B_sys = new Array(mnaSize).fill(0);

const g2ElementMap = {};
let g2Index = nodeCount;
group2Elements.forEach((el) => {
  g2ElementMap[el.id] = g2Index++;
});

cards.forEach((card) => {
  if (card.componentType === 'resistor') {
    const n1Str = getPinNode(card.id, 'left');
    const n2Str = getPinNode(card.id, 'right');
    const n1 = parseInt(n1Str, 10);
    const n2 = parseInt(n2Str, 10);
    const rVal = card.value || 1000;

    const idx = g2ElementMap[card.id];
    if (n1 > 0) A_sys[n1 - 1][idx] += 1;
    if (n2 > 0) A_sys[n2 - 1][idx] -= 1;
    if (n1 > 0) A_sys[idx][n1 - 1] += 1;
    if (n2 > 0) A_sys[idx][n2 - 1] -= 1;
    A_sys[idx][idx] -= rVal;
  }
});

voltageSources.forEach((vSrc) => {
  const n1Str = getPinNode(vSrc.id, 'left');
  const n2Str = getPinNode(vSrc.id, 'right');
  const n1 = parseInt(n1Str, 10);
  const n2 = parseInt(n2Str, 10);
  const val = vSrc.value || 5;
  const idx = g2ElementMap[vSrc.id];
  if (n1 > 0) A_sys[n1 - 1][idx] += 1;
  if (n2 > 0) A_sys[n2 - 1][idx] -= 1;
  if (n1 > 0) A_sys[idx][n1 - 1] += 1;
  if (n2 > 0) A_sys[idx][n2 - 1] -= 1;
  B_sys[idx] = val;
});

console.log("Matrix A (with isGroup2 = true Resistors):");
A_sys.forEach((row, r) => {
  console.log(`Row ${r}:`, row);
});

// Try to solve linear system
const solveLinearSystem = (A, B) => {
  const n = B.length;
  const a = A.map(row => [...row]);
  const b = [...B];

  for (let i = 0; i < n; i++) {
    let maxEl = Math.abs(a[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > maxEl) {
        maxEl = Math.abs(a[k][i]);
        maxRow = k;
      }
    }
    if (maxRow !== i) {
      const tempRow = a[i];
      a[i] = a[maxRow];
      a[maxRow] = tempRow;
      const tempVal = b[i];
      b[i] = b[maxRow];
      b[maxRow] = tempVal;
    }
    if (Math.abs(a[i][i]) < 1e-20) {
      throw new Error(`Zero pivot found at row/col ${i}. Pivot value: ${a[i][i]}`);
    }
    for (let k = i + 1; k < n; k++) {
      const factor = a[k][i] / a[i][i];
      a[k][i] = 0;
      for (let j = i + 1; j < n; j++) {
        a[k][j] -= factor * a[i][j];
      }
      b[k] -= factor * b[i];
    }
  }
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

try {
  const x = solveLinearSystem(A_sys, B_sys);
  console.log("Solved X:", x);
} catch (err) {
  console.error("Solver Error:", err.message);
}
