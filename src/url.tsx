import { useEffect } from 'react';
import type { CanvasElement, CardElement, ArrowElement } from './dataTypes/AnotateType';
import { useCanvas } from './store/useCanvas';

interface UseURLStateProps {
  loadElements: (elements: CanvasElement[]) => void;
  setToast: (toast: { message: string; type: 'success' | 'info' } | null) => void;
}

/**
 * Helper to get the shortened ID of a card.
 * If passive: e.g. R1, C2, GND1.
 * If text card: strips the 'card-' prefix.
 */
const getShortId = (cardId: string, elements: CanvasElement[]): string => {
  const card = elements.find((el) => el.type === 'box' && el.id === cardId) as CardElement | undefined;
  if (!card) return cardId.replace('card-', '');
  
  if (card.componentType) {
    const prefix =
      card.componentType === 'resistor' ? 'R' :
      card.componentType === 'capacitor' ? 'C' :
      card.componentType === 'inductor' ? 'L' : 'GND';
    return `${prefix}${card.instanceNumber || 1}`;
  }
  
  return card.id.replace('card-', '');
};

/**
 * Serializes the board elements array into a super-short, custom compact representation:
 * format: R,instance,x,y,rotation,val,color + C,instance,x,y... + W,fromId,fromSocket,toId,toSocket
 * Omit default values (like default value and color) to keep URL extremely short.
 */
export const serializeElements = (elements: CanvasElement[]): string => {
  const parts: string[] = [];

  elements.forEach((el) => {
    if (el.type === 'box') {
      const card = el as CardElement;
      if (card.componentType) {
        // Passive Element
        const typeChar =
          card.componentType === 'resistor' ? 'R' :
          card.componentType === 'capacitor' ? 'C' :
          card.componentType === 'inductor' ? 'L' : 'G';
        
        const instNum = card.instanceNumber || 1;
        const x = card.x;
        const y = card.y;
        const rot = card.rotation || 0;
        const val = card.value !== undefined ? card.value : '';
        const color = card.color || '';

        // Omit default values to keep it super short
        let defaultVal: any = undefined;
        let defaultColor = '';
        if (card.componentType === 'resistor') { defaultVal = 1000; defaultColor = 'amber'; }
        else if (card.componentType === 'capacitor') { defaultVal = 10e-6; defaultColor = 'sapphire'; }
        else if (card.componentType === 'inductor') { defaultVal = 10e-3; defaultColor = 'emerald'; }
        else if (card.componentType === 'ground') { defaultColor = 'slate'; }

        const rotStr = rot !== 0 ? String(rot) : '';
        const valStr = val !== defaultVal ? String(val) : '';
        const colorStr = color !== defaultColor ? color : '';

        // format: TYPE,instanceNumber,x,y,rotation,value,color
        let fields = [typeChar, String(instNum), String(x), String(y), rotStr, valStr, colorStr];
        while (fields.length > 4 && fields[fields.length - 1] === '') {
          fields.pop();
        }
        parts.push(fields.join(','));
      } else {
        // Text Card
        // format: T,id,x,y,width,height,color,title,content
        const id = card.id.replace('card-', '');
        const title = encodeURIComponent(card.title || '');
        const content = encodeURIComponent(card.content || '');
        const fields = ['T', id, String(card.x), String(card.y), String(card.width), String(card.height), card.color || '', title, content];
        parts.push(fields.join(','));
      }
    } else if (el.type === 'arrow') {
      const arrow = el as ArrowElement;
      // format: W,fromId,fromSocket,toId,toSocket,color,style,label
      const fromId = getShortId(arrow.fromId || '', elements);
      const toId = getShortId(arrow.toId || '', elements);
      const color = arrow.color !== 'slate' ? arrow.color : ''; // slate is default
      const style = arrow.style !== 'curved' ? arrow.style : ''; // curved is default
      const label = arrow.label ? encodeURIComponent(arrow.label) : '';

      let fields = ['W', fromId, arrow.fromSocket || '', toId, arrow.toSocket || '', color, style, label];
      while (fields.length > 5 && fields[fields.length - 1] === '') {
        fields.pop();
      }
      parts.push(fields.join(','));
    }
  });

  return parts.join('+');
};

/**
 * Deserializes elements from our super-short custom representation back to CanvasElement[].
 */
export const deserializeElements = (stateStr: string): CanvasElement[] => {
  const elements: CanvasElement[] = [];
  const parts = stateStr.split('+');

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
};

export const useURLState = ({ loadElements, setToast }: UseURLStateProps) => {
  useEffect(() => {
    // Run this logic ONCE on mount to completely avoid infinite rendering loops & blinking!
    let stateLoaded = false;
    
    // 1. Check if the URL has a saved state to load
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
          stateLoaded = true;
          setToast({
            message: '🎉 Board successfully loaded from shared URL link!',
            type: 'success'
          });
          
          // Clear query/hash to keep the URL clean but preserve path
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }
    } catch (err) {
      console.error('Failed to load state from URL:', err);
    }

    // 2. Check if user typed '/debug' anywhere in the URL path, query, or hash (only if we didn't just load a state)
    if (!stateLoaded) {
      const hasDebugInPath = window.location.pathname.includes('/debug');
      const hasDebugInQuery = window.location.search.includes('debug');
      const hasDebugInHash = window.location.hash.includes('debug');

      if (hasDebugInPath || hasDebugInQuery || hasDebugInHash) {
        try {
          // Read the latest elements directly from Zustand store
          const currentElements = useCanvas.getState().elements;
          const stateStr = serializeElements(currentElements);
          
          // Keep the debug path in the shareable URL
          const debugPath = window.location.pathname.includes('/debug')
            ? window.location.pathname
            : (window.location.pathname.endsWith('/') ? window.location.pathname + 'debug' : window.location.pathname + '/debug');
          const shareUrl = window.location.origin + debugPath + '?state=' + encodeURIComponent(stateStr);
          
          // Try to copy to clipboard
          navigator.clipboard.writeText(shareUrl)
            .then(() => {
              setToast({
                message: '⚡ Board saved to URL & copied to clipboard! Share it with Antigravity!',
                type: 'success'
              });
            })
            .catch(() => {
              setToast({
                message: '⚡ Board saved to URL! Copy the URL from browser address bar to share.',
                type: 'info'
              });
            });
            
          // Update URL bar without reloading
          window.history.replaceState({}, document.title, shareUrl);
        } catch (err) {
          console.error('Failed to save state to URL:', err);
        }
      }
    }
  }, [loadElements, setToast]); // Run exactly once on mount
};
