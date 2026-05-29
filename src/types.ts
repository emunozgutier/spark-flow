export interface Point {
  x: number;
  y: number;
}

export type ToolType = 'select' | 'text' | 'arrow' | 'hand';

export type ThemeColor = 'amethyst' | 'emerald' | 'sapphire' | 'amber' | 'coral' | 'slate';

export interface CardElement {
  id: string;
  type: 'card';
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  content: string;
  color: ThemeColor;
}

export interface ArrowElement {
  id: string;
  type: 'arrow';
  fromId?: string; // Anchored to a card
  fromSocket?: 'top' | 'right' | 'bottom' | 'left';
  toId?: string;   // Anchored to a card
  toSocket?: 'top' | 'right' | 'bottom' | 'left';
  fromPoint?: Point; // Floating start point
  toPoint?: Point;   // Floating end point
  label?: string;
  color: ThemeColor;
  style: 'straight' | 'curved' | 'dashed';
}

export type CanvasElement = CardElement | ArrowElement;

export interface CanvasState {
  pan: Point;
  zoom: number;
  elements: CanvasElement[];
}

export interface DraggingCardState {
  id: string;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
}

export interface DrawingArrowState {
  fromId?: string;
  fromSocket?: 'top' | 'right' | 'bottom' | 'left';
  fromPoint?: Point;
  currentPoint: Point;
  color: ThemeColor;
  style: 'straight' | 'curved' | 'dashed';
}
