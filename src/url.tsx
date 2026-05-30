import { useEffect, useRef } from 'react';
import type { CanvasElement, CardElement, ArrowElement } from './dataTypes/AnotateType';
import { useCanvas } from './store/useCanvas';

interface UseURLStateProps {
  loadElements: (elements: CanvasElement[]) => void;
  setToast: (toast: { message: string; type: 'success' | 'info' } | null) => void;
}

/**
 * Lossless, ultra-compact dot/tilde representation of the board state.
 * Uses only URL-safe characters (. and ~) to completely avoid URL encoding expansion.
 * format: b.id.x.y.w.h.color.compType.instNum.value.rotation.title.content ~ a.id.fromId.fromSocket...
 */
export const serializeElements = (elements: CanvasElement[]): string => {
  const parts = elements.map((el) => {
    if (el.type === 'box') {
      const card = el as CardElement;
      const fields = [
        'b',
        card.id,
        String(card.x),
        String(card.y),
        String(card.width),
        String(card.height),
        card.color || '',
        card.componentType || '',
        card.instanceNumber !== undefined ? String(card.instanceNumber) : '',
        card.value !== undefined ? String(card.value) : '',
        card.rotation !== undefined ? String(card.rotation) : '',
        card.title ? encodeURIComponent(card.title) : '',
        card.content ? encodeURIComponent(card.content) : ''
      ];
      // Trim empty trailing fields
      while (fields.length > 7 && fields[fields.length - 1] === '') {
        fields.pop();
      }
      return fields.join('.');
    } else {
      const arrow = el as ArrowElement;
      const fields = [
        'a',
        arrow.id,
        arrow.fromId || '',
        arrow.fromSocket || '',
        arrow.toId || '',
        arrow.toSocket || '',
        arrow.color || '',
        arrow.style || '',
        arrow.label ? encodeURIComponent(arrow.label) : ''
      ];
      while (fields.length > 6 && fields[fields.length - 1] === '') {
        fields.pop();
      }
      return fields.join('.');
    }
  });

  return parts.join('~');
};

/**
 * Deserializes elements from URL. Fully supports older JSON arrays, older comma/plus-separated strings,
 * and the new ultra-compact dot/tilde format for 100% perfect backward-compatibility.
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
      if (type === 'R' || type === 'C' || type === 'L' || type === 'G') {
        const componentType =
          type === 'R' ? 'resistor' :
          type === 'C' ? 'capacitor' :
          type === 'L' ? 'inductor' : 'ground';
        
        const instanceNumber = parseInt(fields[1], 10) || 1;
        const x = parseInt(fields[2], 10) || 0;
        const y = parseInt(fields[3], 10) || 0;
        const rotation = fields[4] ? parseInt(fields[4], 10) : 0;

        let defaultVal: any = undefined;
        let defaultColor = '';
        if (componentType === 'resistor') { defaultVal = 1000; defaultColor = 'amber'; }
        else if (componentType === 'capacitor') { defaultVal = 10e-6; defaultColor = 'sapphire'; }
        else if (componentType === 'inductor') { defaultVal = 10e-3; defaultColor = 'emerald'; }
        else if (componentType === 'ground') { defaultColor = 'slate'; }

        const value = fields[5] ? parseFloat(fields[5]) : defaultVal;
        const color = (fields[6] || defaultColor) as any;

        const prefix = type === 'R' ? 'R' : type === 'C' ? 'C' : type === 'L' ? 'L' : 'GND';
        const cardId = `${prefix}${instanceNumber}`;

        let ports = undefined;
        if (componentType === 'ground') {
          ports = [{ id: `${cardId}-top`, direction: 'top' as const, isConnected: false }];
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
        const fromId = (fromShort.match(/^[RCLG]/) || fromShort === 'GND') ? fromShort : `card-${fromShort}`;
        const fromSocket = fields[2] as any;
        const toShort = fields[3];
        const toId = (toShort.match(/^[RCLG]/) || toShort === 'GND') ? toShort : `card-${toShort}`;
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

  // 3. New ultra-compact tilde/dot lossless format
  const elements: CanvasElement[] = [];
  const parts = trimmed.split('~');

  parts.forEach((part) => {
    const fields = part.split('.');
    if (fields.length < 3) return;

    const type = fields[0];
    if (type === 'b') {
      const id = fields[1];
      const x = parseInt(fields[2], 10) || 0;
      const y = parseInt(fields[3], 10) || 0;
      const width = fields[4] ? parseInt(fields[4], 10) : 60;
      const height = fields[5] ? parseInt(fields[5], 10) : 60;
      const color = fields[6] || 'slate';
      const componentType = fields[7] || undefined;
      const instanceNumber = fields[8] ? parseInt(fields[8], 10) : undefined;
      const value = fields[9] ? parseFloat(fields[9]) : undefined;
      const rotation = fields[10] ? parseInt(fields[10], 10) : 0;
      const title = fields[11] ? decodeURIComponent(fields[11]) : undefined;
      const content = fields[12] ? decodeURIComponent(fields[12]) : undefined;

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
    } else if (type === 'a') {
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

export const useURLState = ({ loadElements, setToast }: UseURLStateProps) => {
  const initialLoadDoneRef = useRef(false);
  const elements = useCanvas((state) => state.elements);

  // 1. One-time initial load from URL on mount
  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      let stateStr = urlParams.get('state');
      
      // Fallback to hash-based state
      if (!stateStr && window.location.hash.startsWith('#state=')) {
        stateStr = window.location.hash.substring(7);
      } else if (!stateStr && window.location.hash.startsWith('#/state=')) {
        stateStr = window.location.hash.substring(8);
      }

      if (stateStr) {
        // Decode state from compact representation
        const decodedElements = deserializeElements(decodeURIComponent(stateStr));
        if (Array.isArray(decodedElements) && decodedElements.length > 0) {
          loadElements(decodedElements);
          setToast({
            message: '🎉 Board successfully loaded from shared URL link!',
            type: 'success'
          });
        }
      }
    } catch (err) {
      console.error('Failed to load state from URL:', err);
    }
  }, [loadElements, setToast]);

  // 2. Synchronize store elements to URL bar in debug mode whenever elements change
  useEffect(() => {
    const hasDebugInPath = window.location.pathname.includes('/debug');
    const hasDebugInQuery = window.location.search.includes('debug');
    const hasDebugInHash = window.location.hash.includes('debug');

    if (hasDebugInPath || hasDebugInQuery || hasDebugInHash) {
      try {
        const stateStr = serializeElements(elements);
        const encodedState = encodeURIComponent(stateStr);

        // Check if the URL parameter already matches to avoid redundant history replacement
        const urlParams = new URLSearchParams(window.location.search);
        const currentStateParam = urlParams.get('state');

        if (currentStateParam !== stateStr) {
          const debugPath = window.location.pathname.includes('/debug')
            ? window.location.pathname
            : (window.location.pathname.endsWith('/') ? window.location.pathname + 'debug' : window.location.pathname + '/debug');
          const shareUrl = window.location.origin + debugPath + '?state=' + encodedState;
          
          window.history.replaceState({}, document.title, shareUrl);
        }
      } catch (err) {
        console.error('Failed to sync elements to URL:', err);
      }
    }
  }, [elements]);
};
