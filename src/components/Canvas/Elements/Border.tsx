import React from 'react';
import type { CardElement, ArrowElement, ToolType } from '../../../dataTypes/AnotateType';

interface BorderProps {
  card: CardElement;
  isSelected: boolean;
  activeTool: ToolType;
  arrows: ArrowElement[];
  initiateArrowDraw: (card: CardElement, socketDir: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
}

export const Border: React.FC<BorderProps> = ({
  card,
  isSelected,
  activeTool,
  arrows,
  initiateArrowDraw
}) => {
  return (
    <>
      {/* Sockets for Wire connections */}
      {(activeTool === 'select' || activeTool === 'arrow' || activeTool === 'hand') && (
        <>
          {card.componentType === 'ground' ? (
            /* Top Lead Port for Ground */
            <div
              className={`card-socket top ${
                !arrows.some(
                  (arrow) =>
                    (arrow.fromId === card.id && arrow.fromSocket === 'top') ||
                    (arrow.toId === card.id && arrow.toSocket === 'top')
                )
                  ? 'open-port'
                  : ''
              }`}
              data-card-id={card.id}
              data-socket-dir="top"
              onMouseDown={(e) => initiateArrowDraw(card, 'top', e)}
            />
          ) : (
            <>
              {/* Left Lead Port */}
              <div
                className={`card-socket left ${
                  !arrows.some(
                    (arrow) =>
                      (arrow.fromId === card.id && arrow.fromSocket === 'left') ||
                      (arrow.toId === card.id && arrow.toSocket === 'left')
                  )
                    ? 'open-port'
                    : ''
                }`}
                data-card-id={card.id}
                data-socket-dir="left"
                onMouseDown={(e) => initiateArrowDraw(card, 'left', e)}
                style={{ top: '20px' }}
              />

              {/* Right Lead Port */}
              <div
                className={`card-socket right ${
                  !arrows.some(
                    (arrow) =>
                      (arrow.fromId === card.id && arrow.fromSocket === 'right') ||
                      (arrow.toId === card.id && arrow.toSocket === 'right')
                  )
                    ? 'open-port'
                    : ''
                }`}
                data-card-id={card.id}
                data-socket-dir="right"
                onMouseDown={(e) => initiateArrowDraw(card, 'right', e)}
                style={{ top: '20px' }}
              />
            </>
          )}
        </>
      )}
    </>
  );
};
