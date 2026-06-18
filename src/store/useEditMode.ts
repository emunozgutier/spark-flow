import { create } from 'zustand';
import { useCanvas } from './useCanvas';

export type EditModeType = 'select' | 'delete' | 'move' | 'add' | 'annotate' | 'edit';
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
  | 'box'
  | 'arrow'
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
    if (get().editMode === 'edit' && mode !== 'edit') {
      (useCanvas.getState() as any).setSelectedId(null);
    }
    const submode =
      mode === 'add'
        ? (get().editSubmode && ['box', 'arrow', 'text'].indexOf(get().editSubmode as string) === -1 ? get().editSubmode : 'resistor')
        : mode === 'annotate'
        ? (get().editSubmode && ['box', 'arrow', 'text'].indexOf(get().editSubmode as string) !== -1 ? get().editSubmode : 'box')
        : null;
    set({ editMode: mode, editSubmode: submode });
    const tool = editModeToTool(mode, submode);
    if ((useCanvas.getState() as any).activeTool !== tool) {
      (useCanvas.getState() as any).setActiveTool(tool);
    }
  },
  setEditSubmode: (submode) => {
    set({ editSubmode: submode });
    if (submode !== null) {
      const isAnnotate = submode === 'box' || submode === 'arrow' || submode === 'text';
      const expectedMode = isAnnotate ? 'annotate' : 'add';
      if (get().editMode !== expectedMode) {
        set({ editMode: expectedMode });
      }
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
  if (mode === 'edit') return 'select';
  if (mode === 'move') return 'hand';
  if (mode === 'delete') return 'select';
  if (mode === 'add') {
    if (submode === null) return 'resistor';
    return submode === 'wire' ? 'arrow' : submode;
  }
  if (mode === 'annotate') {
    if (submode === 'box') return 'text';
    if (submode === 'arrow') return 'arrow';
    if (submode === 'text') return 'text';
    return 'text';
  }
  return 'select';
};

const toolToEditMode = (tool: string): { mode: EditModeType; submode: EditSubmodeType } => {
  if (tool === 'select') return { mode: 'select', submode: null };
  if (tool === 'hand') return { mode: 'move', submode: null };
  if (tool === 'arrow') return { mode: 'annotate', submode: 'arrow' };
  if (tool === 'text') return { mode: 'annotate', submode: 'box' };
  const submode = tool as EditSubmodeType;
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

// Subscribe to selectedId changes to switch into/out of 'edit' mode automatically
let prevSelectedId: string | null = null;
useCanvas.subscribe((state) => {
  const selectedId = (state as any).selectedId;
  if (selectedId !== prevSelectedId) {
    const { editMode } = useEditMode.getState();
    if (selectedId !== null) {
      if (editMode !== 'edit') {
        useEditMode.setState({ editMode: 'edit', editSubmode: null });
      }
    } else {
      if (editMode === 'edit') {
        useEditMode.setState({ editMode: 'select', editSubmode: null });
      }
    }
    prevSelectedId = selectedId;
  }
});

// Subscribe to editMode changes to deselect the canvas element when changing mode away from 'edit'
let prevEditMode = useEditMode.getState().editMode;
useEditMode.subscribe((state) => {
  if (prevEditMode === 'edit' && state.editMode !== 'edit') {
    const { selectedId, setSelectedId } = useCanvas.getState() as any;
    if (selectedId !== null) {
      setSelectedId(null);
    }
  }
  prevEditMode = state.editMode;
});
