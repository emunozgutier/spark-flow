import React, { useEffect, useRef } from 'react';
import { useEditMode } from '../../store/useEditMode';

interface KeyListnerProps {
  undo: () => void;
  redo: () => void;
}

export const KeyListner: React.FC<KeyListnerProps> = ({ undo, redo }) => {
  const pendingAddRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key cancels active tools, blurs inputs, and resets to select mode
      if (e.key === 'Escape') {
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          activeEl.blur();
        }
        pendingAddRef.current = false;
        useEditMode.getState().setEditMode('select');
        return;
      }

      // Ignore key binds if typing in input textareas
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Undo / Redo
      if (cmdKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (cmdKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      const key = e.key.toLowerCase();
      const editModeState = useEditMode.getState();

      if (pendingAddRef.current) {
        pendingAddRef.current = false;
        e.preventDefault();
        switch (key) {
          case 'r':
            editModeState.setEditSubmode('resistor');
            break;
          case 'w':
            editModeState.setEditSubmode('wire');
            break;
          case 'c':
            editModeState.setEditSubmode('capacitor');
            break;
          case 'l':
            editModeState.setEditSubmode('inductor');
            break;
          case 'g':
            editModeState.setEditSubmode('ground');
            break;
          case 'v':
            editModeState.setEditSubmode('voltage');
            break;
          case 'o':
            editModeState.setEditSubmode('acvoltage');
            break;
          case 'i':
            editModeState.setEditSubmode('current');
            break;
          case 'd':
            editModeState.setEditSubmode('diode');
            break;
          case 'q':
            editModeState.setEditSubmode('bjt');
            break;
          case 'm':
            editModeState.setEditSubmode('mosfet');
            break;
          case 't':
            editModeState.setEditSubmode('text');
            break;
          case 's':
            editModeState.setEditMode('select');
            break;
          default:
            // Cancel pending add if any other key is pressed
            break;
        }
        return;
      }

      // Normal Mode (Vim-like single key)
      switch (key) {
        case 's':
          editModeState.setEditMode('select');
          break;
        case 'd':
          editModeState.setEditMode('delete');
          break;
        case 'm':
          editModeState.setEditMode('move');
          break;
        case 'w':
          editModeState.setEditMode('add');
          editModeState.setEditSubmode('wire');
          break;
        case 't':
          editModeState.setEditMode('add');
          editModeState.setEditSubmode('text');
          break;
        case 'g':
          editModeState.setEditMode('add');
          editModeState.setEditSubmode('ground');
          break;
        case 'a':
          pendingAddRef.current = true;
          // Set editMode to 'add' so the user sees the submode dropdown immediately!
          editModeState.setEditMode('add');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return null;
};
