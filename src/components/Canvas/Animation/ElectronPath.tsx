import type { Point, ArrowElement, CardElement } from '../../../dataTypes/AnotateType';
import { getAbsoluteDirection, getOrthogonalPathPoints } from '../Connections';

export interface Segment {
  id: string;
  path: Point[];
  length: number;
  speed: number;
  spawnAccumulator: number;
  startsAtJunction?: boolean;
}

const MAX_SPEED = 180; // pixels per second
const MIN_SPEED = 2;  // pixels per second (for low but non-zero currents)

export const getSocketPosition = (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left'): Point => {
  let basePt = { x: 0, y: 0 };
  const isPassive = !!card.componentType;
  switch (socket) {
    case 'top':
      basePt = { x: card.x + card.width / 2, y: card.y };
      break;
    case 'right':
      basePt = {
        x: card.x + card.width,
        y: isPassive && card.componentType !== 'ground' ? card.y + 20 : card.y + card.height / 2
      };
      break;
    case 'bottom':
      basePt = { x: card.x + card.width / 2, y: card.y + card.height };
      break;
    case 'left':
      basePt = {
        x: card.x,
        y: isPassive && card.componentType !== 'ground' ? card.y + 20 : card.y + card.height / 2
      };
      break;
  }

  if (card.rotation && card.rotation !== 0) {
    const cx = card.x + card.width / 2;
    const cy = card.y + card.height / 2;
    const rad = (card.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = basePt.x - cx;
    const dy = basePt.y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos
    };
  }
  return basePt;
};

export const getWirePoints = (
  wire: ArrowElement,
  isForward: boolean,
  cards: CardElement[]
): Point[] => {
  let startPt = wire.fromPoint || { x: 0, y: 0 };
  let endPt = wire.toPoint || { x: 0, y: 0 };

  const fromCard = cards.find((c) => c.id === wire.fromId);
  const toCard = cards.find((c) => c.id === wire.toId);

  if (wire.fromId && fromCard && wire.fromSocket) {
    startPt = getSocketPosition(fromCard, wire.fromSocket);
  }
  if (wire.toId && toCard && wire.toSocket) {
    endPt = getSocketPosition(toCard, wire.toSocket);
  }

  const absFromDir = getAbsoluteDirection(wire.fromSocket, fromCard?.rotation || 0);
  const absToDir = getAbsoluteDirection(wire.toSocket, toCard?.rotation || 0);
  const pathPoints = getOrthogonalPathPoints(startPt, endPt, absFromDir, absToDir, wire.id);

  return isForward ? pathPoints : [...pathPoints].reverse();
};

export const getPathLength = (path: Point[]): number => {
  let len = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
};

export const getPositionAlongPath = (path: Point[], progress: number): Point => {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];

  let remaining = progress;
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (remaining <= dist) {
      const ratio = dist > 0 ? remaining / dist : 0;
      return {
        x: p1.x + dx * ratio,
        y: p1.y + dy * ratio
      };
    }
    remaining -= dist;
  }
  return path[path.length - 1];
};

export const getSpeedForCurrent = (current: number, maxI: number): number => {
  if (current < 1e-9) return 0;
  const ratio = Math.min(1.0, current / maxI);
  return MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED);
};

export const mergePaths = (paths: Point[][]): Point[] => {
  const merged: Point[] = [];
  paths.forEach((path) => {
    path.forEach((pt) => {
      if (merged.length === 0) {
        merged.push(pt);
      } else {
        const last = merged[merged.length - 1];
        const dx = pt.x - last.x;
        const dy = pt.y - last.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.1) {
          merged.push(pt);
        }
      }
    });
  });
  return merged;
};
