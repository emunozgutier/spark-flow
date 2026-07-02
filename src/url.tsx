import type { CanvasElement, CardElement, ArrowElement } from './dataTypes/AnotateType';

// Socket direction compression helpers
const socketToCode = (socket?: string): string => {
  if (socket === 'left') return 'l';
  if (socket === 'right') return 'r';
  if (socket === 'top') return 't';
  if (socket === 'bottom') return 'b';
  return '';
};

const codeToSocket = (code?: string): 'left' | 'right' | 'top' | 'bottom' => {
  if (code === 'l') return 'left';
  if (code === 'r') return 'right';
  if (code === 't') return 'top';
  if (code === 'b') return 'bottom';
  return 'left';
};

// ID compression helpers
const getCompactId = (card: CardElement): string => {
  if (card.componentType === 'resistor') {
    return `R${card.instanceNumber || 1}`;
  }
  if (card.componentType === 'capacitor') {
    return `C${card.instanceNumber || 1}`;
  }
  if (card.componentType === 'inductor') {
    return `L${card.instanceNumber || 1}`;
  }
  if (card.componentType === 'voltage') {
    return `V${card.instanceNumber || 1}`;
  }
  if (card.componentType === 'acvoltage') {
    return `Vac${card.instanceNumber || 1}`;
  }
  if (card.componentType === 'current') {
    return `I${card.instanceNumber || 1}`;
  }
  if (card.componentType === 'diode') {
    return `D${card.instanceNumber || 1}`;
  }
  if (card.componentType === 'bjt') {
    return `Q${card.instanceNumber || 1}`;
  }
  if (card.componentType === 'mosfet') {
    return `M${card.instanceNumber || 1}`;
  }
  if (card.componentType === 'ground') {
    return card.instanceNumber ? `GND${card.instanceNumber}` : 'GND';
  }
  if (card.id.startsWith('card-')) {
    return card.id.substring(5);
  }
  return card.id;
};

const getCompactIdById = (id: string | undefined, elements: CanvasElement[]): string => {
  if (!id) return '';
  const el = elements.find((e) => e.id === id);
  if (el && el.type === 'box') {
    return getCompactId(el as CardElement);
  }
  if (id.startsWith('card-')) {
    return id.substring(5);
  }
  return id;
};

/**
 * Lossless, ultra-compact dot/tilde representation of the board state.
 * Uses only URL-safe characters (. and ~) to completely avoid URL encoding expansion.
 * Omit default values, and simplify elements:
 * - Resistor R1 at (250, 40) -> R1.250.40
 * - Wire between R1 right socket and C2 left socket -> W.R1.r.C2.l
 */
export const serializeElements = (elements: CanvasElement[]): string => {
  const parts = elements.map((el) => {
    if (el.type === 'box') {
      const card = el as CardElement;
      
      if (card.componentType) {
        const compactId = getCompactId(card);
        const rotationStr = card.rotation ? String(card.rotation) : '';
        
        let defaultVal = 0;
        let defaultColor = '';
        if (card.componentType === 'resistor') {
          defaultVal = 1000;
          defaultColor = 'amber';
        } else if (card.componentType === 'capacitor') {
          defaultVal = 10e-6;
          defaultColor = 'sapphire';
        } else if (card.componentType === 'inductor') {
          defaultVal = 10e-3;
          defaultColor = 'amethyst';
        } else if (card.componentType === 'voltage') {
          defaultVal = 5;
          defaultColor = 'sapphire';
        } else if (card.componentType === 'acvoltage') {
          defaultVal = 5;
          defaultColor = 'sapphire';
        } else if (card.componentType === 'current') {
          defaultVal = 0.001;
          defaultColor = 'amethyst';
        } else if (card.componentType === 'ground') {
          defaultColor = 'amethyst';
        } else if (card.componentType === 'diode') {
          defaultColor = 'amber';
        } else if (card.componentType === 'bjt') {
          defaultVal = 100;
          defaultColor = 'amethyst';
        } else if (card.componentType === 'mosfet') {
          defaultVal = 2.0; // Vth = 2.0V
          defaultColor = 'amethyst';
        }

        const valStr = card.value !== undefined && card.value !== defaultVal ? String(card.value) : '';
        const colorStr = card.color !== defaultColor ? card.color : '';

        // Fields: [compactId, x, y, rotationStr, valueStr (if not ground/diode), colorStr]
        const fields = [
          compactId,
          String(card.x),
          String(card.y),
          rotationStr
        ];

        if (card.componentType !== 'ground' && card.componentType !== 'diode') {
          fields.push(valStr);
          if (card.componentType === 'acvoltage') {
            const freqStr = card.frequency !== undefined && card.frequency !== 60 ? String(card.frequency) : '';
            fields.push(freqStr);
          }
        }
        fields.push(colorStr);

        // Trim empty trailing fields
        while (fields.length > 3 && fields[fields.length - 1] === '') {
          fields.pop();
        }

        return fields.join('.');
      } else {
        // Custom text card
        const fields = [
          'T',
          getCompactId(card),
          String(card.x),
          String(card.y),
          card.width !== 200 ? String(card.width) : '',
          card.height !== 120 ? String(card.height) : '',
          card.color !== 'amethyst' ? card.color : '',
          card.title ? encodeURIComponent(card.title) : '',
          card.content ? encodeURIComponent(card.content) : ''
        ];

        while (fields.length > 4 && fields[fields.length - 1] === '') {
          fields.pop();
        }

        return fields.join('.');
      }
    } else {
      const arrow = el as ArrowElement;
      
      const fromCompactId = getCompactIdById(arrow.fromId, elements);
      const toCompactId = getCompactIdById(arrow.toId, elements);
      const fromSocketCode = socketToCode(arrow.fromSocket);
      const toSocketCode = socketToCode(arrow.toSocket);

      const fields = [
        'W',
        fromCompactId,
        fromSocketCode,
        toCompactId,
        toSocketCode,
        arrow.color !== 'slate' ? arrow.color : '',
        arrow.style !== 'curved' ? arrow.style : '',
        arrow.label ? encodeURIComponent(arrow.label) : ''
      ];

      while (fields.length > 5 && fields[fields.length - 1] === '') {
        fields.pop();
      }

      return fields.join('.');
    }
  });

  return parts.join('~\n');
};

/**
 * Deserializes elements from URL. Fully supports older JSON arrays, older comma/plus-separated strings,
 * verbose dot/tilde strings, and the new ultra-compact format for 100% perfect backward-compatibility.
 */
export const deserializeElements = (stateStr: string): CanvasElement[] => {
  const trimmed = stateStr.trim();
  
  // 1. Backward-compatibility with JSON positional arrays
  if (trimmed.startsWith('[')) {
    const arrays = JSON.parse(trimmed) as any[];
    return arrays.map((arr) => {
      const typeChar = arr[0];
      if (typeChar === 'b') {
        const id = arr[1];
        const x = parseInt(arr[2], 10) || 0;
        const y = parseInt(arr[3], 10) || 0;
        const width = parseInt(arr[4], 10) || 60;
        const height = parseInt(arr[5], 10) || 60;
        const color = arr[6] || 'slate';
        const componentType = arr[7] || undefined;
        const instanceNumber = arr[8] ? parseInt(arr[8], 10) : undefined;
        const value = arr[9] !== '' ? parseFloat(arr[9]) : undefined;
        const rotation = arr[10] ? parseInt(arr[10], 10) : 0;
        const title = arr[11] ? decodeURIComponent(arr[11]) : undefined;
        const content = arr[12] ? decodeURIComponent(arr[12]) : undefined;

        let ports = undefined;
        if (componentType) {
          if (componentType === 'ground') {
            ports = [{ id: `${id}-top`, direction: 'top' as const, isConnected: false }];
          } else {
            ports = [
              { id: `${id}-left`, direction: 'left' as const, isConnected: false },
              { id: `${id}-right`, direction: 'right' as const, isConnected: false }
            ];
          }
        }

        return {
          id,
          type: 'box',
          x,
          y,
          width,
          height,
          color,
          componentType,
          instanceNumber,
          value,
          ports,
          rotation,
          title,
          content
        } as CardElement;
      } else {
        const id = arr[1];
        const color = arr[6] || 'slate';
        const fromId = arr[7];
        const fromSocket = arr[8];
        const toId = arr[9];
        const toSocket = arr[10];
        const style = arr[11] || 'curved';
        const label = arr[12] ? decodeURIComponent(arr[12]) : '';

        return {
          id,
          type: 'arrow',
          fromId,
          fromSocket,
          toId,
          toSocket,
          color,
          style,
          label
        } as ArrowElement;
      }
    });
  }

  // 2. Backward-compatibility with first prefix-based string formats (separated by plus)
  if (!trimmed.includes('.')) {
    const elements: CanvasElement[] = [];
    const parts = trimmed.split('+');

    parts.forEach((part) => {
      const fields = part.split(',');
      if (fields.length < 4) return;

      const type = fields[0];
      if (type === 'R' || type === 'C' || type === 'L' || type === 'G' || type === 'V' || type === 'Vac' || type === 'I' || type === 'D' || type === 'Q' || type === 'M') {
        const componentType =
          type === 'R' ? 'resistor' :
          type === 'C' ? 'capacitor' :
          type === 'L' ? 'inductor' :
          type === 'V' ? 'voltage' :
          type === 'Vac' ? 'acvoltage' :
          type === 'I' ? 'current' :
          type === 'D' ? 'diode' :
          type === 'Q' ? 'bjt' :
          type === 'M' ? 'mosfet' : 'ground';
        
        const instanceNumber = parseInt(fields[1], 10) || 1;
        const x = parseInt(fields[2], 10) || 0;
        const y = parseInt(fields[3], 10) || 0;
        const rotation = fields[4] ? parseInt(fields[4], 10) : 0;

        let defaultVal: any = undefined;
        let defaultColor = '';
        if (componentType === 'resistor') { defaultVal = 1000; defaultColor = 'amber'; }
        else if (componentType === 'capacitor') { defaultVal = 10e-6; defaultColor = 'sapphire'; }
        else if (componentType === 'inductor') { defaultVal = 10e-3; defaultColor = 'amethyst'; }
        else if (componentType === 'voltage') { defaultVal = 5; defaultColor = 'sapphire'; }
        else if (componentType === 'acvoltage') { defaultVal = 5; defaultColor = 'sapphire'; }
        else if (componentType === 'current') { defaultVal = 0.001; defaultColor = 'amethyst'; }
        else if (componentType === 'ground') { defaultColor = 'amethyst'; }
        else if (componentType === 'diode') { defaultColor = 'amber'; }
        else if (componentType === 'bjt') { defaultVal = 100; defaultColor = 'amethyst'; }
        else if (componentType === 'mosfet') { defaultVal = 2.0; defaultColor = 'amethyst'; }

        const value = fields[5] ? parseFloat(fields[5]) : defaultVal;
        let color = (fields[6] || defaultColor) as any;
        if (color === 'slate' || color === 'emerald' || color === 'coral') {
          color = 'amethyst';
        }

        const prefix = type === 'R' ? 'R' : type === 'C' ? 'C' : type === 'L' ? 'L' : type === 'V' ? 'V' : type === 'Vac' ? 'Vac' : type === 'I' ? 'I' : type === 'D' ? 'D' : type === 'Q' ? 'Q' : type === 'M' ? 'M' : 'GND';
        const cardId = `${prefix}${instanceNumber}`;

        let ports = undefined;
        if (componentType === 'ground') {
          ports = [{ id: `${cardId}-top`, direction: 'top' as const, isConnected: false }];
        } else if (componentType === 'bjt' || componentType === 'mosfet') {
          ports = [
            { id: `${cardId}-left`, direction: 'left' as const, isConnected: false },
            { id: `${cardId}-top`, direction: 'top' as const, isConnected: false },
            { id: `${cardId}-bottom`, direction: 'bottom' as const, isConnected: false }
          ];
        } else {
          ports = [
            { id: `${cardId}-left`, direction: 'left' as const, isConnected: false },
            { id: `${cardId}-right`, direction: 'right' as const, isConnected: false }
          ];
        }

        elements.push({
          id: cardId,
          type: 'box',
          x,
          y,
          width: 60,
          height: 60,
          color,
          componentType,
          instanceNumber,
          value,
          ports,
          rotation
        } as CardElement);

      } else if (type === 'T') {
        const shortId = fields[1];
        const id = shortId.startsWith('card-') ? shortId : `card-${shortId}`;
        const x = parseInt(fields[2], 10) || 0;
        const y = parseInt(fields[3], 10) || 0;
        const width = parseInt(fields[4], 10) || 200;
        const height = parseInt(fields[5], 10) || 120;
        const color = (fields[6] || 'amethyst') as any;
        const title = decodeURIComponent(fields[7] || '');
        const content = decodeURIComponent(fields[8] || '');

        elements.push({
          id,
          type: 'box',
          x,
          y,
          width,
          height,
          color,
          title,
          content
        } as CardElement);

      } else if (type === 'W') {
        const fromShort = fields[1];
        const fromId = (fromShort.match(/^[RCLGVQM]/) || fromShort.startsWith('Vac') || fromShort.startsWith('I') || fromShort.startsWith('D') || fromShort === 'GND') ? fromShort : `card-${fromShort}`;
        const fromSocket = fields[2] as any;
        const toShort = fields[3];
        const toId = (toShort.match(/^[RCLGVQM]/) || toShort.startsWith('Vac') || toShort.startsWith('I') || toShort.startsWith('D') || toShort === 'GND') ? toShort : `card-${toShort}`;
        const toSocket = fields[4] as any;
        const color = (fields[5] || 'slate') as any;
        const style = (fields[6] || 'curved') as any;
        const label = fields[7] ? decodeURIComponent(fields[7]) : '';

        elements.push({
          id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'arrow',
          fromId,
          fromSocket,
          toId,
          toSocket,
          color,
          style,
          label
        } as ArrowElement);
      }
    });

    return elements;
  }

  // 3. Dot/tilde format (supports new super-compact format and old b/a dot format)
  const elements: CanvasElement[] = [];
  const parts = trimmed.split('~').map(p => p.trim()).filter(Boolean);

  parts.forEach((part) => {
    const fields = part.split('.');
    if (fields.length === 0 || fields[0] === '') return;

    const type = fields[0];

    // Check new formats first:
    // W -> Wire
    if (type === 'W') {
      const fromShort = fields[1] || '';
      const fromId = /^\d+$/.test(fromShort) ? `card-${fromShort}` : fromShort;
      const fromSocket = codeToSocket(fields[2]);
      
      const toShort = fields[3] || '';
      const toId = /^\d+$/.test(toShort) ? `card-${toShort}` : toShort;
      const toSocket = codeToSocket(fields[4]);
      
      const color = fields[5] || 'slate';
      const style = fields[6] || 'curved';
      const label = fields[7] ? decodeURIComponent(fields[7]) : '';

      elements.push({
        id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'arrow',
        fromId,
        fromSocket,
        toId,
        toSocket,
        color,
        style,
        label
      } as ArrowElement);
    }
    // T -> Custom Card
    else if (type === 'T') {
      const shortId = fields[1] || '';
      const id = /^\d+$/.test(shortId) ? `card-${shortId}` : shortId;
      const x = parseInt(fields[2], 10) || 0;
      const y = parseInt(fields[3], 10) || 0;
      const width = fields[4] ? parseInt(fields[4], 10) : 200;
      const height = fields[5] ? parseInt(fields[5], 10) : 120;
      const color = fields[6] || 'amethyst';
      const title = fields[7] ? decodeURIComponent(fields[7]) : undefined;
      const content = fields[8] ? decodeURIComponent(fields[8]) : undefined;

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width,
        height,
        color,
        title,
        content
      } as CardElement);
    }
    // R[num] -> Resistor
    else if (/^R\d+$/.test(type)) {
      const id = type;
      const instanceNumber = parseInt(type.substring(1), 10) || 1;
      const x = parseInt(fields[1], 10) || 0;
      const y = parseInt(fields[2], 10) || 0;
      const rotation = fields[3] ? parseInt(fields[3], 10) : 0;
      
      const rawVal = fields[4];
      const value = (rawVal !== undefined && rawVal !== '' && !isNaN(parseFloat(rawVal))) ? parseFloat(rawVal) : 1000;
      
      let color = fields[5] || 'amber';
      if (color === 'slate' || color === 'emerald' || color === 'coral') {
        color = 'amber';
      }

      const ports = [
        { id: `${id}-left`, direction: 'left' as const, isConnected: false },
        { id: `${id}-right`, direction: 'right' as const, isConnected: false }
      ];

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width: 60,
        height: 60,
        color,
        componentType: 'resistor',
        instanceNumber,
        value,
        ports,
        rotation
      } as CardElement);
    }
    // C[num] -> Capacitor
    else if (/^C\d+$/.test(type)) {
      const id = type;
      const instanceNumber = parseInt(type.substring(1), 10) || 1;
      const x = parseInt(fields[1], 10) || 0;
      const y = parseInt(fields[2], 10) || 0;
      const rotation = fields[3] ? parseInt(fields[3], 10) : 0;
      
      const rawVal = fields[4];
      const value = (rawVal !== undefined && rawVal !== '' && !isNaN(parseFloat(rawVal))) ? parseFloat(rawVal) : 10e-6;
      
      let color = fields[5] || 'sapphire';
      if (color === 'slate' || color === 'emerald' || color === 'coral') {
        color = 'sapphire';
      }

      const ports = [
        { id: `${id}-left`, direction: 'left' as const, isConnected: false },
        { id: `${id}-right`, direction: 'right' as const, isConnected: false }
      ];

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width: 60,
        height: 60,
        color,
        componentType: 'capacitor',
        instanceNumber,
        value,
        ports,
        rotation
      } as CardElement);
    }
    // L[num] -> Inductor
    else if (/^L\d+$/.test(type)) {
      const id = type;
      const instanceNumber = parseInt(type.substring(1), 10) || 1;
      const x = parseInt(fields[1], 10) || 0;
      const y = parseInt(fields[2], 10) || 0;
      const rotation = fields[3] ? parseInt(fields[3], 10) : 0;
      
      const rawVal = fields[4];
      const value = (rawVal !== undefined && rawVal !== '' && !isNaN(parseFloat(rawVal))) ? parseFloat(rawVal) : 10e-3;
      
      let color = fields[5] || 'amethyst';
      if (color === 'slate' || color === 'emerald' || color === 'coral') {
        color = 'amethyst';
      }

      const ports = [
        { id: `${id}-left`, direction: 'left' as const, isConnected: false },
        { id: `${id}-right`, direction: 'right' as const, isConnected: false }
      ];

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width: 60,
        height: 60,
        color,
        componentType: 'inductor',
        instanceNumber,
        value,
        ports,
        rotation
      } as CardElement);
    }
    // V[num] -> Voltage Source
    else if (/^V\d+$/.test(type)) {
      const id = type;
      const instanceNumber = parseInt(type.substring(1), 10) || 1;
      const x = parseInt(fields[1], 10) || 0;
      const y = parseInt(fields[2], 10) || 0;
      const rotation = fields[3] ? parseInt(fields[3], 10) : 0;
      
      const rawVal = fields[4];
      const value = (rawVal !== undefined && rawVal !== '' && !isNaN(parseFloat(rawVal))) ? parseFloat(rawVal) : 5;
      
      let color = fields[5] || 'sapphire';
      if (color === 'slate' || color === 'emerald' || color === 'coral') {
        color = 'sapphire';
      }

      const ports = [
        { id: `${id}-left`, direction: 'left' as const, isConnected: false },
        { id: `${id}-right`, direction: 'right' as const, isConnected: false }
      ];

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width: 60,
        height: 60,
        color,
        componentType: 'voltage',
        instanceNumber,
        value,
        ports,
        rotation
      } as CardElement);
    }
    // Vac[num] -> AC Voltage Source
    else if (/^Vac\d+$/.test(type)) {
      const id = type;
      const instanceNumber = parseInt(type.substring(3), 10) || 1;
      const x = parseInt(fields[1], 10) || 0;
      const y = parseInt(fields[2], 10) || 0;
      const rotation = fields[3] ? parseInt(fields[3], 10) : 0;
      
      const rawVal = fields[4];
      const value = (rawVal !== undefined && rawVal !== '' && !isNaN(parseFloat(rawVal))) ? parseFloat(rawVal) : 5;
      
      let frequency = 60;
      let color = 'sapphire';
      if (fields[5] !== undefined && fields[5] !== '') {
        if (!isNaN(parseFloat(fields[5]))) {
          frequency = parseFloat(fields[5]);
          if (fields[6] !== undefined && fields[6] !== '') {
            color = fields[6];
          }
        } else {
          color = fields[5];
        }
      }
      if (color === 'slate' || color === 'emerald' || color === 'coral') {
        color = 'sapphire';
      }

      const ports = [
        { id: `${id}-left`, direction: 'left' as const, isConnected: false },
        { id: `${id}-right`, direction: 'right' as const, isConnected: false }
      ];

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width: 60,
        height: 60,
        color,
        componentType: 'acvoltage',
        instanceNumber,
        value,
        frequency,
        ports,
        rotation
      } as CardElement);
    }
    // I[num] -> Current Source
    else if (/^I\d+$/.test(type)) {
      const id = type;
      const instanceNumber = parseInt(type.substring(1), 10) || 1;
      const x = parseInt(fields[1], 10) || 0;
      const y = parseInt(fields[2], 10) || 0;
      const rotation = fields[3] ? parseInt(fields[3], 10) : 0;
      
      const rawVal = fields[4];
      const value = (rawVal !== undefined && rawVal !== '' && !isNaN(parseFloat(rawVal))) ? parseFloat(rawVal) : 0.001;
      
      let color = fields[5] || 'amethyst';
      if (color === 'slate' || color === 'emerald' || color === 'coral') {
        color = 'amethyst';
      }

      const ports = [
        { id: `${id}-left`, direction: 'left' as const, isConnected: false },
        { id: `${id}-right`, direction: 'right' as const, isConnected: false }
      ];

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width: 60,
        height: 60,
        color,
        componentType: 'current',
        instanceNumber,
        value,
        ports,
        rotation
      } as CardElement);
    }
    // GND or GND[num] -> Ground
    else if (/^GND\d*$/.test(type)) {
      const id = type;
      const instanceNumber = type.length > 3 ? (parseInt(type.substring(3), 10) || undefined) : undefined;
      const x = parseInt(fields[1], 10) || 0;
      const y = parseInt(fields[2], 10) || 0;
      const rotation = fields[3] ? parseInt(fields[3], 10) : 0;
      let color = fields[4] || 'amethyst';
      if (color === 'slate' || color === 'emerald' || color === 'coral') {
        color = 'amethyst';
      }

      const ports = [
        { id: `${id}-top`, direction: 'top' as const, isConnected: false }
      ];

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width: 60,
        height: 60,
        color,
        componentType: 'ground',
        instanceNumber,
        ports,
        rotation
      } as CardElement);
    }
    // D[num] -> Diode
    else if (/^D\d+$/.test(type)) {
      const id = type;
      const instanceNumber = parseInt(type.substring(1), 10) || 1;
      const x = parseInt(fields[1], 10) || 0;
      const y = parseInt(fields[2], 10) || 0;
      const rotation = fields[3] ? parseInt(fields[3], 10) : 0;
      let color = fields[4] || 'amber';
      if (color === 'slate' || color === 'emerald' || color === 'coral') {
        color = 'amber';
      }

      const ports = [
        { id: `${id}-left`, direction: 'left' as const, isConnected: false },
        { id: `${id}-right`, direction: 'right' as const, isConnected: false }
      ];

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width: 60,
        height: 60,
        color,
        componentType: 'diode',
        instanceNumber,
        ports,
        rotation
      } as CardElement);
    }
    // Q[num] -> BJT
    else if (/^Q\d+$/.test(type)) {
      const id = type;
      const instanceNumber = parseInt(type.substring(1), 10) || 1;
      const x = parseInt(fields[1], 10) || 0;
      const y = parseInt(fields[2], 10) || 0;
      const rotation = fields[3] ? parseInt(fields[3], 10) : 0;
      
      const rawVal = fields[4];
      const value = (rawVal !== undefined && rawVal !== '' && !isNaN(parseFloat(rawVal))) ? parseFloat(rawVal) : 100;
      
      let color = 'amethyst';
      if (fields[5] !== undefined && fields[5] !== '') {
        color = fields[5];
      } else if (fields[4] !== undefined && fields[4] !== '' && isNaN(parseFloat(fields[4]))) {
        color = fields[4];
      }
      if (color === 'slate' || color === 'emerald' || color === 'coral') {
        color = 'amethyst';
      }

      const ports = [
        { id: `${id}-left`, direction: 'left' as const, isConnected: false },
        { id: `${id}-top`, direction: 'top' as const, isConnected: false },
        { id: `${id}-bottom`, direction: 'bottom' as const, isConnected: false }
      ];

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width: 60,
        height: 60,
        color,
        componentType: 'bjt',
        instanceNumber,
        value,
        ports,
        rotation
      } as CardElement);
    }
    // M[num] -> MOSFET
    else if (/^M\d+$/.test(type)) {
      const id = type;
      const instanceNumber = parseInt(type.substring(1), 10) || 1;
      const x = parseInt(fields[1], 10) || 0;
      const y = parseInt(fields[2], 10) || 0;
      const rotation = fields[3] ? parseInt(fields[3], 10) : 0;
      
      const rawVal = fields[4];
      const value = (rawVal !== undefined && rawVal !== '' && !isNaN(parseFloat(rawVal))) ? parseFloat(rawVal) : 2.0;
      
      let color = 'amethyst';
      if (fields[5] !== undefined && fields[5] !== '') {
        color = fields[5];
      } else if (fields[4] !== undefined && fields[4] !== '' && isNaN(parseFloat(fields[4]))) {
        color = fields[4];
      }
      if (color === 'slate' || color === 'emerald' || color === 'coral') {
        color = 'amethyst';
      }

      const ports = [
        { id: `${id}-left`, direction: 'left' as const, isConnected: false },
        { id: `${id}-top`, direction: 'top' as const, isConnected: false },
        { id: `${id}-bottom`, direction: 'bottom' as const, isConnected: false }
      ];

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width: 60,
        height: 60,
        color,
        componentType: 'mosfet',
        instanceNumber,
        value,
        ports,
        rotation
      } as CardElement);
    }
    // Backward compatibility: Old 'b' (box) format
    else if (type === 'b') {
      const id = fields[1];
      const x = parseInt(fields[2], 10) || 0;
      const y = parseInt(fields[3], 10) || 0;
      const width = fields[4] ? parseInt(fields[4], 10) : 60;
      const height = fields[5] ? parseInt(fields[5], 10) : 60;
      let color = fields[6] || 'slate';
      const componentType = fields[7] as any || undefined;
      if (componentType !== undefined) {
        if (color === 'slate' || color === 'emerald' || color === 'coral') {
          color = 'amethyst';
        }
      }
      const instanceNumber = fields[8] ? parseInt(fields[8], 10) : undefined;
      const value = fields[9] ? parseFloat(fields[9]) : undefined;
      const rotation = fields[10] ? parseInt(fields[10], 10) : 0;
      const title = fields[11] ? decodeURIComponent(fields[11]) : undefined;
      const content = fields[12] ? decodeURIComponent(fields[12]) : undefined;

      let ports = undefined;
      if (componentType) {
        if (componentType === 'ground') {
          ports = [{ id: `${id}-top`, direction: 'top' as const, isConnected: false }];
        } else if (componentType === 'bjt' || componentType === 'mosfet') {
          ports = [
            { id: `${id}-left`, direction: 'left' as const, isConnected: false },
            { id: `${id}-top`, direction: 'top' as const, isConnected: false },
            { id: `${id}-bottom`, direction: 'bottom' as const, isConnected: false }
          ];
        } else {
          ports = [
            { id: `${id}-left`, direction: 'left' as const, isConnected: false },
            { id: `${id}-right`, direction: 'right' as const, isConnected: false }
          ];
        }
      }

      elements.push({
        id,
        type: 'box',
        x,
        y,
        width,
        height,
        color,
        componentType,
        instanceNumber,
        value,
        ports,
        rotation,
        title,
        content
      } as CardElement);
    }
    // Backward compatibility: Old 'a' (arrow) format
    else if (type === 'a') {
      const id = fields[1];
      const fromId = fields[2];
      const fromSocket = fields[3] as any;
      const toId = fields[4];
      const toSocket = fields[5] as any;
      const color = fields[6] || 'slate';
      const style = fields[7] || 'curved';
      const label = fields[8] ? decodeURIComponent(fields[8]) : '';

      elements.push({
        id,
        type: 'arrow',
        fromId,
        fromSocket,
        toId,
        toSocket,
        color,
        style,
        label
      } as ArrowElement);
    }
  });

  return elements;
};


