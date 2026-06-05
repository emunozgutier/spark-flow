import type { Point, CardElement, ArrowElement } from '../../../dataTypes/AnotateType';

export class Proton {
  id: string;
  points: Point[];
  pointIndex: number;
  currentX: number;
  currentY: number;
  speed: number;
  nextCardId: string;
  nextPort: string;
  visitedCards: Set<string>;

  constructor(
    points: Point[],
    speed: number,
    nextCardId: string,
    nextPort: string,
    visitedCards: Set<string>
  ) {
    this.id = `pr-${Date.now()}-${Math.random()}`;
    this.points = points;
    this.pointIndex = 1;
    this.currentX = points[0]?.x || 0;
    this.currentY = points[0]?.y || 0;
    this.speed = speed;
    this.nextCardId = nextCardId;
    this.nextPort = nextPort;
    this.visitedCards = visitedCards;
  }

  // Draw the proton as a glowing particle on the canvas context
  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.currentX, this.currentY, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Advance position by flat distance (sub-frame movement)
  move(dist: number) {
    if (dist <= 0) return;
    while (dist > 0 && this.pointIndex < this.points.length) {
      const targetPt = this.points[this.pointIndex];
      const dx = targetPt.x - this.currentX;
      const dy = targetPt.y - this.currentY;
      const segDist = Math.sqrt(dx * dx + dy * dy);

      if (segDist <= dist) {
        dist -= segDist;
        this.currentX = targetPt.x;
        this.currentY = targetPt.y;
        this.pointIndex++;
      } else {
        const ratio = dist / segDist;
        this.currentX += dx * ratio;
        this.currentY += dy * ratio;
        dist = 0;
      }
    }
  }

  // Updates the proton's position. Returns false if the proton is destroyed/sinked.
  update(
    dt: number,
    cards: CardElement[],
    arrows: ArrowElement[],
    solvedResults: Record<string, { voltageDrop: number; branchCurrent: number; vLeft?: number; vRight?: number; signedCurrent?: number }>,
    maxI: number,
    getSocketPos: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point,
    getWirePoints: (wire: ArrowElement, isForward: boolean) => Point[],
    calculateSpeedForWire: (wire: ArrowElement) => number,
    onSplit: (newProtons: Proton[]) => void
  ): boolean {
    let moveDist = this.speed * dt;

    while (moveDist > 0) {
      const targetPt = this.points[this.pointIndex];
      if (!targetPt) break;

      const dx = targetPt.x - this.currentX;
      const dy = targetPt.y - this.currentY;
      const segDist = Math.sqrt(dx * dx + dy * dy);

      if (segDist <= moveDist) {
        moveDist -= segDist;
        this.currentX = targetPt.x;
        this.currentY = targetPt.y;
        this.pointIndex++;

        if (this.pointIndex >= this.points.length) {
          // Reached the end of the current wire path, perform a transition to the next element
          return this.transition(
            moveDist,
            cards,
            arrows,
            solvedResults,
            maxI,
            getSocketPos,
            getWirePoints,
            calculateSpeedForWire,
            onSplit
          );
        }
      } else {
        const ratio = moveDist / segDist;
        this.currentX += dx * ratio;
        this.currentY += dy * ratio;
        moveDist = 0;
      }
    }

    return this.pointIndex < this.points.length;
  }

  // Transitions the proton into the next connected element
  private transition(
    extraDist: number,
    cards: CardElement[],
    arrows: ArrowElement[],
    _solvedResults: Record<string, { voltageDrop: number; branchCurrent: number; vLeft?: number; vRight?: number; signedCurrent?: number }>,
    _maxI: number,
    getSocketPos: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point,
    getWirePoints: (wire: ArrowElement, isForward: boolean) => Point[],
    calculateSpeedForWire: (wire: ArrowElement) => number,
    onSplit: (newProtons: Proton[]) => void
  ): boolean {
    const nextCard = cards.find((c) => c.id === this.nextCardId);
    if (!nextCard || !nextCard.componentType) return false;

    // Prevent circular loops
    if (this.visitedCards.has(nextCard.id) || this.visitedCards.size > 40) return false;
    this.visitedCards.add(nextCard.id);

    // Ground acts as a sink
    if (nextCard.componentType === 'ground') return false;

    // Split junction traversal
    if (nextCard.id.startsWith('join') || nextCard.title === 'join') {
      const otherWires = arrows.filter(
        (w) => w.fromId === nextCard.id || w.toId === nextCard.id
      );

      const splitProtons: Proton[] = [];

      otherWires.forEach((w) => {
        const isForward = w.fromId === nextCard.id;
        const otherCardId = isForward ? w.toId : w.fromId;
        const otherPort = isForward ? w.toSocket : w.fromSocket;

        if (!otherCardId || !otherPort) return;
        if (this.visitedCards.has(otherCardId)) return;

        const points = getWirePoints(w, isForward);
        if (points.length < 2) return;

        const newSpeed = calculateSpeedForWire(w);
        if (newSpeed < 5) return;

        const splitPr = new Proton(
          points,
          newSpeed,
          otherCardId,
          otherPort,
          new Set(this.visitedCards)
        );

        splitPr.move(extraDist);
        splitProtons.push(splitPr);
      });

      if (splitProtons.length > 0) {
        onSplit(splitProtons);
      }
      return false; // Parent proton is destroyed/replaced by splits
    }

    // Two-terminal component traversal (resistor, capacitor, inductor, sources)
    const oppositePort = this.nextPort === 'left' ? 'right' : 'left';
    const startPt = getSocketPos(nextCard, this.nextPort as any);
    const endPt = getSocketPos(nextCard, oppositePort as any);

    const outgoingWire = arrows.find(
      (w) =>
        (w.fromId === nextCard.id && w.fromSocket === oppositePort) ||
        (w.toId === nextCard.id && w.toSocket === oppositePort)
    );

    if (!outgoingWire) return false;

    const isForward = outgoingWire.fromId === nextCard.id;
    const otherCardId = isForward ? outgoingWire.toId : outgoingWire.fromId;
    const otherPort = isForward ? outgoingWire.toSocket : outgoingWire.fromSocket;

    if (!otherCardId || !otherPort) return false;
    if (this.visitedCards.has(otherCardId)) return false;

    const wirePoints = getWirePoints(outgoingWire, isForward);
    const combinedPoints = [startPt, endPt, ...wirePoints];

    this.points = combinedPoints;
    this.pointIndex = 1;
    this.currentX = startPt.x;
    this.currentY = startPt.y;
    this.speed = calculateSpeedForWire(outgoingWire);
    this.nextCardId = otherCardId;
    this.nextPort = otherPort;

    this.move(extraDist);
    return true; // Still active on new path
  }
}
