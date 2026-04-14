import * as XLSX from 'xlsx'
import type { FrameRegion, ParsedCell } from '../../types'

function colIdxToLetter(idx: number): string {
  let s = ''
  let n = idx + 1
  while (n > 0) {
    n--
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}

export function extractCellData(
  workbook: XLSX.WorkBook,
  sheetName: string,
  region: FrameRegion,
  markedCells: Set<string> = new Set(),
): ParsedCell[] {
  const ws = workbook.Sheets[sheetName]
  if (!ws) return []

  const cells: ParsedCell[] = []

  for (let row = region.minRow; row <= region.maxRow; row++) {
    for (let col = region.minCol; col <= region.maxCol; col++) {
      const address = `${colIdxToLetter(col)}${row + 1}`
      const cell = ws[address] as XLSX.CellObject | undefined

      if (!cell) {
        cells.push({
          address, col, row,
          value: null, rawValue: null, formula: null,
          label: null, comment: null,
          isMarked: markedCells.has(address),
          isPercent: false,
        })
        continue
      }

      // Formula (strip leading = if stored differently)
      let formula: string | null = null
      if (cell.f) {
        formula = cell.f.startsWith('=') ? cell.f : `=${cell.f}`
      }

      // Coerce value
      let value: number | string | null = null
      if (cell.t === 'n') value = cell.v as number
      else if (cell.t === 's') value = cell.v as string
      else if (cell.t === 'b') value = (cell.v as boolean) ? 1 : 0
      else if (cell.v != null) value = String(cell.v)

      // Formatted string for display
      const rawValue = cell.w ?? (value != null ? String(value) : null)

      // Comment (if available – SheetJS places comments in ws['!comments'])
      const commentsMap = (ws as Record<string, unknown>)['!comments']
      let comment: string | null = null
      if (Array.isArray(commentsMap)) {
        // newer SheetJS format
      } else if (commentsMap && typeof commentsMap === 'object') {
        const c = (commentsMap as Record<string, {a?: string; t?: string}[]>)[address]
        if (Array.isArray(c) && c[0]?.t) comment = c[0].t
      }

      const isPercent = rawValue?.trimEnd().endsWith('%') ?? false
      cells.push({ address, col, row, value, rawValue, formula, label: null, comment, isMarked: markedCells.has(address), isPercent })
    }
  }

  // ── Label assignment pass ──────────────────────────────────────────────────
  // For each row, find text-only cells (string value, no formula) and assign
  // their text as the label of the nearest numeric/formula cell to their right.
  const labelsByRow = new Map<number, Array<{ col: number; text: string }>>()
  for (const cell of cells) {
    if (typeof cell.value === 'string' && cell.formula == null && cell.value.trim()) {
      const row = cell.row
      if (!labelsByRow.has(row)) labelsByRow.set(row, [])
      labelsByRow.get(row)!.push({ col: cell.col, text: cell.value.trim() })
    }
  }
  for (const cell of cells) {
    // Skip text-only cells themselves
    if (typeof cell.value === 'string' && cell.formula == null) continue
    const rowLabels = labelsByRow.get(cell.row)
    if (!rowLabels?.length) continue
    // Pick the label cell that is closest to the left of this cell
    const leftLabels = rowLabels.filter(l => l.col < cell.col)
    if (leftLabels.length) {
      const best = leftLabels.reduce((a, b) => b.col > a.col ? b : a)
      cell.label = best.text
    }
  }

  return cells
}
