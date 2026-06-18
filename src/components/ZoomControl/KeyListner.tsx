import React, { useEffect, useRef } from 'react';
import { useEditMode } from '../../store/useEditMode';
import type { EditSubmodeType } from '../../store/useEditMode';

interface KeyListnerProps {
  undo: () => void;
  redo: () => void;
}

const getNextSubmode = (key: string, currentSubmode: EditSubmodeType): EditSubmodeType => {
  switch (key) {
    case 'r':
      return 'resistor';
    case 'w':
      return 'wire';
    case 'c':
      return 'capacitor';
    case 'l':
      return 'inductor';
    case 'g':
      return 'ground';
    case 'v':
      return currentSubmode === 'voltage' ? 'acvoltage' : 'voltage';
    case 'o':
      return currentSubmode === 'acvoltage' ? 'voltage' : 'acvoltage';
    case 'i':
      return 'current';
    case 'd':
      return 'diode';
    case 'q':
      return currentSubmode === 'bjt' ? 'mosfet' : 'bjt';
    case 't':
      return 'text';
    case 'n':
      if (currentSubmode === 'box') return 'arrow';
      if (currentSubmode === 'arrow') return 'text';
      if (currentSubmode === 'text') return 'box';
      return 'box';
    default:
      return null;
  }
};

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
        if (key === 's') {
          e.preventDefault();
          editModeState.setEditMode('select');
          return;
        }
        const submode = getNextSubmode(key, editModeState.editSubmode);
        if (submode) {
          e.preventDefault();
          editModeState.setEditSubmode(submode);
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
        case 'a':
          pendingAddRef.current = true;
          // Set editMode to 'add' so the user sees the submode dropdown immediately!
          editModeState.setEditMode('add');
          break;
        case 'n': {
          const submode = getNextSubmode('n', editModeState.editSubmode);
          editModeState.setEditMode('annotate');
          editModeState.setEditSubmode(submode);
          break;
        }
        default: {
          const submode = getNextSubmode(key, editModeState.editSubmode);
          if (submode) {
            const isAnnotate = submode === 'box' || submode === 'arrow' || submode === 'text';
            editModeState.setEditMode(isAnnotate ? 'annotate' : 'add');
            editModeState.setEditSubmode(submode);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return null;
};
