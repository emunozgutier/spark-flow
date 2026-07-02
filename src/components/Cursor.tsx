import React, { useState, useEffect } from 'react';
import { useEditMode } from '../store/useEditMode';
import type { EditSubmodeType } from '../store/useEditMode';

export const Cursor: React.FC = () => {
  const { editMode, editSubmode } = useEditMode();
  
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHoveringDeletable, setIsHoveringDeletable] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });

      const container = document.querySelector('.canvas-container');
      const isOverContainer = container && container.contains(e.target as Node);
      // Exclude overlay UI panels so custom cursor doesn't render on top of menus
      const isOverUI = !!(e.target as HTMLElement).closest(
        '.interactive-panel, .sidebar-panel, .floating-overlay, .settings-menu, .toast-notification'
      );

      const shouldBeVisible = !!(isOverContainer && !isOverUI);
      setIsVisible(shouldBeVisible);

      if (container) {
        if (shouldBeVisible) {
          container.classList.add('custom-cursor-active');
        } else {
          container.classList.remove('custom-cursor-active');
        }
      }

      if (shouldBeVisible) {
        const isDeletable = !!(e.target as HTMLElement).closest('.canvas-card, .deletable-wire');
        setIsHoveringDeletable(isDeletable);
      }
    };

    const handleMouseDown = () => setIsMouseDown(true);
    const handleMouseUp = () => setIsMouseDown(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      
      const container = document.querySelector('.canvas-container');
      if (container) {
        container.classList.remove('custom-cursor-active');
      }
    };
  }, []);

  if (!isVisible) return null;

  const renderComponentPreview = (sub: EditSubmodeType) => {
    const strokeColor = 'var(--theme-amethyst)';
    const strokeWidth = 3.5;

    switch (sub) {
      case 'resistor':
        return (
          <svg width="50" height="30" viewBox="0 0 100 30" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 0 15 L 20 15 L 25 5 L 35 25 L 45 5 L 55 25 L 65 5 L 75 25 L 80 15 L 100 15" />
          </svg>
        );
      case 'capacitor':
        return (
          <svg width="50" height="30" viewBox="0 0 100 40" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 0 20 L 43 20 M 57 20 L 100 20" />
            <path d="M 43 5 L 43 35 M 57 5 L 57 35" />
          </svg>
        );
      case 'inductor':
        return (
          <svg width="50" height="30" viewBox="0 0 100 30" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 0 15 L 20 15 C 20 5, 32 5, 32 15 C 32 5, 44 5, 44 15 C 44 5, 56 5, 56 15 C 56 5, 68 5, 68 15 C 68 5, 80 5, 80 15 L 100 15" />
          </svg>
        );
      case 'ground':
        return (
          <svg width="40" height="40" viewBox="0 0 60 60" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 30 0 L 30 25" />
            <path d="M 20 25 L 40 25" />
            <path d="M 24 33 L 36 33" />
            <path d="M 28 41 L 32 41" />
          </svg>
        );
      case 'voltage':
        return (
          <svg width="50" height="30" viewBox="0 0 100 40" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 0 20 L 35 20 M 65 20 L 100 20" />
            <circle cx="50" cy="20" r="15" />
            <path d="M 40 20 H 46 M 43 17 V 23" strokeWidth="2.5" />
            <path d="M 54 20 H 60" strokeWidth="2.5" />
          </svg>
        );
      case 'acvoltage':
        return (
          <svg width="50" height="30" viewBox="0 0 100 40" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 0 20 L 35 20 M 65 20 L 100 20" />
            <circle cx="50" cy="20" r="15" />
            <path d="M 44 20 Q 47 13, 50 20 T 56 20" strokeWidth="2.5" />
          </svg>
        );
      case 'current':
        return (
          <svg width="50" height="30" viewBox="0 0 100 40" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 0 20 L 35 20 M 65 20 L 100 20" />
            <circle cx="50" cy="20" r="15" />
            <path d="M 42 20 H 58" strokeWidth="2.5" />
            <path d="M 52 15 L 58 20 L 52 25" strokeWidth="2.5" strokeLinejoin="miter" />
          </svg>
        );
      case 'diode':
        return (
          <svg width="50" height="30" viewBox="0 0 100 40" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 0 20 L 38 20 M 55 20 L 100 20" />
            <path d="M 38 10 L 38 30 L 55 20 Z" fill={strokeColor} />
            <path d="M 55 10 L 55 30" />
          </svg>
        );
      case 'bjt':
        return (
          <svg width="40" height="40" viewBox="0 0 60 60" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 0 30 L 22 30" />
            <path d="M 22 16 L 22 44" strokeWidth="4" />
            <path d="M 30 0 L 30 16 L 22 23" />
            <path d="M 22 37 L 30 44 L 30 60" />
          </svg>
        );
      case 'mosfet':
        return (
          <svg width="40" height="40" viewBox="0 0 60 60" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 0 30 L 20 30" />
            <path d="M 20 16 L 20 44" strokeWidth="4" />
            <path d="M 25 16 L 25 44" strokeWidth="3" />
            <path d="M 30 0 L 30 18 L 25 18" />
            <path d="M 25 42 L 30 42 L 30 60" />
          </svg>
        );
      case 'text':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7V4h16v3M9 20h6M12 4v16" />
          </svg>
        );
      default:
        return null;
    }
  };

  const renderCursor = () => {
    // 1. Add mode cursor (element preview or + for wire)
    if (editMode === 'add' || editMode === 'annotate') {
      if (editSubmode === 'wire' || editSubmode === 'arrow') {
        return (
          <div style={{ transform: 'translate(-50%, -50%)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        );
      }
      return (
        <div style={{ transform: 'translate(-50%, -50%)', filter: 'drop-shadow(0 0 6px var(--theme-amethyst-glow))', opacity: 0.85 }}>
          {renderComponentPreview(editSubmode)}
        </div>
      );
    }

    // 2. Delete mode cursor (red/grey X)
    if (editMode === 'delete') {
      const color = isHoveringDeletable ? 'var(--theme-coral)' : '#64748b';
      return (
        <div style={{ transform: 'translate(-50%, -50%)', filter: isHoveringDeletable ? 'drop-shadow(0 0 6px var(--theme-coral-glow))' : 'none' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      );
    }

    // 3. Move/Drag mode cursor (open/closed hand)
    if (editMode === 'move') {
      return (
        <div style={{ transform: 'translate(-50%, -50%)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
          {isMouseDown ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 15V9a2 2 0 0 0-4 0v2m-2 0V7a2 2 0 0 0-4 0v4m-2 0V9a2 2 0 0 0-4 0v5a7 7 0 0 0 14 0v-2" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 11V6a2 2 0 0 0-4 0v5m-2 0V4a2 2 0 0 0-4 0v7m-2 0V8a2 2 0 0 0-4 0v7a7 7 0 0 0 14 0v-4" />
            </svg>
          )}
        </div>
      );
    }

    // 4. Select/Edit mode cursor (pointer arrow)
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" stroke="#10121b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))' }}>
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="M13 13l6 6" />
      </svg>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        zIndex: 999999,
        transform: `translate(${position.x}px, ${position.y}px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {renderCursor()}
    </div>
  );
};
