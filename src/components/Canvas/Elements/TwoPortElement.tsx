import React from 'react';
import type { CardElement } from '../../../dataTypes/AnotateType';

interface TwoPortElementProps {
  card: CardElement;
}

export const TwoPortElement: React.FC<TwoPortElementProps> = ({ card }) => {
  if (card.componentType === 'resistor') {
    return (
      <svg
        width="100%"
        height="30"
        viewBox="0 0 100 30"
        fill="none"
        stroke="var(--theme-color)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          top: '5px',
          left: 0,
          filter: 'drop-shadow(0 0 4px var(--theme-color-glow))'
        }}
      >
        <path d="M 0 15 L 20 15 L 25 5 L 35 25 L 45 5 L 55 25 L 65 5 L 75 25 L 80 15 L 100 15" />
      </svg>
    );
  }
  if (card.componentType === 'capacitor') {
    return (
      <svg
        width="100%"
        height="30"
        viewBox="0 0 100 40"
        fill="none"
        stroke="var(--theme-color)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          top: '5px',
          left: 0,
          filter: 'drop-shadow(0 0 4px var(--theme-color-glow))'
        }}
      >
        <path d="M 0 20 L 43 20 M 57 20 L 100 20" />
        <path d="M 43 5 L 43 35 M 57 5 L 57 35" />
      </svg>
    );
  }
  if (card.componentType === 'inductor') {
    return (
      <svg
        width="100%"
        height="30"
        viewBox="0 0 100 30"
        fill="none"
        stroke="var(--theme-color)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          top: '5px',
          left: 0,
          filter: 'drop-shadow(0 0 4px var(--theme-color-glow))'
        }}
      >
        <path d="M 0 15 L 20 15 C 20 5, 32 5, 32 15 C 32 5, 44 5, 44 15 C 44 5, 56 5, 56 15 C 56 5, 68 5, 68 15 C 68 5, 80 5, 80 15 L 100 15" />
      </svg>
    );
  }
  if (card.componentType === 'ground') {
    return (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 60 60"
        fill="none"
        stroke="var(--theme-color)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          filter: 'drop-shadow(0 0 4px var(--theme-color-glow))'
        }}
      >
        <path d="M 30 0 L 30 25" />
        <path d="M 20 25 L 40 25" />
        <path d="M 24 33 L 36 33" />
        <path d="M 28 41 L 32 41" />
      </svg>
    );
  }
  if (card.componentType === 'voltage') {
    const isVertical = Math.abs(card.rotation || 0) % 180 === 90;
    return (
      <svg
        width="100%"
        height="30"
        viewBox="0 0 100 40"
        fill="none"
        stroke="var(--theme-color)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          top: '5px',
          left: 0,
          filter: 'drop-shadow(0 0 4px var(--theme-color-glow))'
        }}
      >
        <path d="M 0 20 L 35 20 M 65 20 L 100 20" />
        <circle cx="50" cy="20" r="15" />
        <path d="M 40 20 H 46 M 43 17 V 23" strokeWidth="2.5" />
        <path
          d="M 54 20 H 60"
          strokeWidth="2.5"
          transform={isVertical ? "rotate(90 57 20)" : undefined}
        />
      </svg>
    );
  }
  if (card.componentType === 'acvoltage') {
    return (
      <svg
        width="100%"
        height="30"
        viewBox="0 0 100 40"
        fill="none"
        stroke="var(--theme-color)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          top: '5px',
          left: 0,
          filter: 'drop-shadow(0 0 4px var(--theme-color-glow))'
        }}
      >
        <path d="M 0 20 L 35 20 M 65 20 L 100 20" />
        <circle cx="50" cy="20" r="15" />
        <path d="M 42 20 Q 46 12, 50 20 T 58 20" strokeWidth="2.5" />
      </svg>
    );
  }
  if (card.componentType === 'current') {
    return (
      <svg
        width="100%"
        height="30"
        viewBox="0 0 100 40"
        fill="none"
        stroke="var(--theme-color)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          top: '5px',
          left: 0,
          filter: 'drop-shadow(0 0 4px var(--theme-color-glow))'
        }}
      >
        <path d="M 0 20 L 35 20 M 65 20 L 100 20" />
        <circle cx="50" cy="20" r="15" />
        <path d="M 42 20 H 58" strokeWidth="2.5" />
        <path d="M 52 15 L 58 20 L 52 25" strokeWidth="2.5" strokeLinejoin="miter" />
      </svg>
    );
  }
  if (card.componentType === 'diode') {
    return (
      <svg
        width="100%"
        height="30"
        viewBox="0 0 100 40"
        fill="none"
        stroke="var(--theme-color)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          top: '5px',
          left: 0,
          filter: 'drop-shadow(0 0 4px var(--theme-color-glow))'
        }}
      >
        <path d="M 0 20 L 38 20 M 55 20 L 100 20" />
        <path d="M 38 10 L 38 30 L 55 20 Z" fill="var(--theme-color)" />
        <path d="M 55 10 L 55 30" />
      </svg>
    );
  }
  return null;
};
