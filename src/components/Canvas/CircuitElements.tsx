import React from 'react';
import type { CardElement, ArrowElement, ToolType } from '../../dataTypes/AnotateType';
import { Border } from './Elements/Border';
import { TwoPortElement } from './Elements/TwoPortElement';
import { NameAndValue } from './Elements/NameAndValue';

interface CircuitElementsProps {
  card: CardElement;
  isSelected: boolean;
  activeTool: ToolType;
  arrows: ArrowElement[];
  initiateCardDrag: (card: CardElement, e: React.MouseEvent) => void;
  initiateArrowDraw: (card: CardElement, socketDir: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  updateElement: (id: string, updates: Partial<any>, record?: boolean) => void;
  finalizeDrag: () => void;
}

export const CircuitElements: React.FC<CircuitElementsProps> = ({
  card,
  isSelected,
  activeTool,
  arrows,
  initiateCardDrag,
  initiateArrowDraw,
  updateElement,
  finalizeDrag
}) => {
  return (
    <div
      className={`canvas-card passive-component ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${card.x}px`,
        top: `${card.y}px`,
        width: `${card.width}px`,
        height: `${card.height}px`,
        zIndex: isSelected ? 99 : 5,
        transform: `rotate(${card.rotation || 0}deg)`,
        '--theme-color': `var(--theme-${card.color})`,
        '--theme-color-glow': `var(--theme-${card.color}-glow)`
      } as React.CSSProperties}
      onMouseDown={(e) => initiateCardDrag(card, e)}
    >
      <Border
        card={card}
        isSelected={isSelected}
        activeTool={activeTool}
        arrows={arrows}
        initiateArrowDraw={initiateArrowDraw}
      />
      <TwoPortElement card={card} />
      <NameAndValue
        card={card}
        updateElement={updateElement}
        finalizeDrag={finalizeDrag}
      />
    </div>
  );
};
