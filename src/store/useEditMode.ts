import { create } from 'zustand';
import { useCanvas } from './useCanvas';

export type EditModeType = 'select' | 'delete' | 'move' | 'add';
export type EditSubmodeType =
  | 'resistor'
  | 'wire'
  | 'capacitor'
  | 'inductor'
  | 'ground'
  | 'voltage'
  | 'acvoltage'
  | 'current'
  | 'diode'
  | 'bjt'
  | 'mosfet'
  | 'text'
  | null;

interface EditModeState {
  editMode: EditModeType;
  editSubmode: EditSubmodeType;
  setEditMode: (mode: EditModeType) => void;
  setEditSubmode: (submode: EditSubmodeType) => void;
}

export const useEditMode = create<EditModeState>((set, get) => ({
  editMode: 'select',
  editSubmode: null,
  setEditMode: (mode) => {
    const submode = mode === 'add' ? (get().editSubmode || 'resistor') : null;
    set({ editMode: mode, editSubmode: submode });
    const tool = editModeToTool(mode, submode);
    if ((useCanvas.getState() as any).activeTool !== tool) {
      (useCanvas.getState() as any).setActiveTool(tool);
    }
  },
  setEditSubmode: (submode) => {
    set({ editSubmode: submode });
    if (submode !== null && get().editMode !== 'add') {
      set({ editMode: 'add' });
    }
    const tool = editModeToTool(get().editMode, submode);
    if ((useCanvas.getState() as any).activeTool !== tool) {
      (useCanvas.getState() as any).setActiveTool(tool);
    }
  },
}));

// Helper mappings
const editModeToTool = (mode: EditModeType, submode: EditSubmodeType): string => {
  if (mode === 'select') return 'select';
  if (mode === 'move') return 'hand';
  if (mode === 'delete') return 'select';
  if (mode === 'add') {
    if (submode === null) return 'resistor';
    return submode === 'wire' ? 'arrow' : submode;
  }
  return 'select';
};

const toolToEditMode = (tool: string): { mode: EditModeType; submode: EditSubmodeType } => {
  if (tool === 'select') return { mode: 'select', submode: null };
  if (tool === 'hand') return { mode: 'move', submode: null };
  const submode = tool === 'arrow' ? 'wire' : (tool as EditSubmodeType);
  return { mode: 'add', submode };
};

// Two-way sync: Subscribe to activeTool changes in useCanvas
useCanvas.subscribe((state) => {
  const activeTool = (state as any).activeTool;
  const { editMode, editSubmode } = useEditMode.getState();
  
  const expectedTool = editModeToTool(editMode, editSubmode);
  if (activeTool !== expectedTool) {
    const parsed = toolToEditMode(activeTool);
    // If activeTool changes to 'select', but we are already in 'delete', don't switch to 'select' mode
    if (activeTool === 'select' && editMode === 'delete') {
      return;
    }
    useEditMode.setState({
      editMode: parsed.mode,
      editSubmode: parsed.submode,
    });
  }
});
