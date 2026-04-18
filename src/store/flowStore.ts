import { create } from 'zustand'
import type { DisplaySettings, FlowEdge, FlowNode, ParsedCell } from '../types'

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  numberDecimals: 0,
  percentMode: true,
  percentDecimals: 2,
  simplifyOperators: true,
}

export interface FlowStore {
  fileName: string | null
  error: string | null
  isLoading: boolean
  nodes: FlowNode[]
  edges: FlowEdge[]
  parsedCells: ParsedCell[] | null
  displaySettings: DisplaySettings
  setLoading: (value: boolean) => void
  setError: (message: string | null) => void
  setDisplaySettings: (patch: Partial<DisplaySettings>) => void
  setFlowData: (
    fileName: string,
    nodes: FlowNode[],
    edges: FlowEdge[],
    parsedCells: ParsedCell[],
  ) => void
  resetFlow: () => void
}

export const useFlowStore = create<FlowStore>((set) => ({
  fileName: null,
  error: null,
  isLoading: false,
  nodes: [],
  edges: [],
  parsedCells: null,
  displaySettings: DEFAULT_DISPLAY_SETTINGS,

  setLoading: (value) => set({ isLoading: value }),
  setError: (message) => set({ error: message, isLoading: false }),
  setDisplaySettings: (patch) =>
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        ...patch,
      },
    })),
  setFlowData: (fileName, nodes, edges, parsedCells) =>
    set({
      fileName,
      nodes,
      edges,
      parsedCells,
      error: null,
      isLoading: false,
    }),
  resetFlow: () =>
    set({
      fileName: null,
      error: null,
      isLoading: false,
      nodes: [],
      edges: [],
      parsedCells: null,
    }),
}))
