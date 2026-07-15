import React from 'react';
import type { CardElement, ArrowElement, ToolType } from '../../../dataTypes/AnotateType';

interface BorderProps {
  card: CardElement;
  activeTool: ToolType;
  arrows: ArrowElement[];
  initiateArrowDraw: (card: CardElement, socketDir: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
}

export const Border: React.FC<BorderProps> = ({
  card,
  activeTool,
  arrows,
  initiateArrowDraw
}) => {
  const isTwoPort = card.componentType && 
                    card.componentType !== 'ground' && 
                    card.componentType !== 'bjt' && 
                    card.componentType !== 'mosfet';
  
  const isHorizontal = Math.abs(card.rotation || 0) % 180 === 0;

  const isResistor = card.componentType === 'resistor';

  const borderStyle: React.CSSProperties = isResistor
    ? (isHorizontal
      ? { left: '-10px', right: '-10px', top: '-6px', bottom: '-6px', borderRadius: '6px' }
      : { left: '-6px', right: '-6px', top: '-6px', bottom: '-6px', borderRadius: '6px' })
    : (isTwoPort && isHorizontal)
      ? { left: '-25px', right: '-25px', top: '-15px', bottom: '-15px', borderRadius: '16px' }
      : { left: '-15px', right: '-15px', top: '-15px', bottom: '-15px', borderRadius: '16px' };

  return (
    <>
      <div className="component-border-overlay" style={borderStyle} />
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
          ) : (card.componentType === 'bjt' || card.componentType === 'mosfet') ? (
            <>
              {/* Left Lead Port (Base) */}
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
                style={{ top: '30px' }}
              />

              {/* Top Lead Port (Collector) */}
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

              {/* Bottom Lead Port (Emitter) */}
              <div
                className={`card-socket bottom ${
                  !arrows.some(
                    (arrow) =>
                      (arrow.fromId === card.id && arrow.fromSocket === 'bottom') ||
                      (arrow.toId === card.id && arrow.toSocket === 'bottom')
                  )
                    ? 'open-port'
                    : ''
                }`}
                data-card-id={card.id}
                data-socket-dir="bottom"
                onMouseDown={(e) => initiateArrowDraw(card, 'bottom', e)}
              />
            </>
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
